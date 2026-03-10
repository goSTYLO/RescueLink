const Incident = require('../models/incident');
const User = require('../models/user');
const Department = require('../models/department');
const Dispatch = require('../models/dispatch');
const Responder = require('../models/responder');
const pool = require('../config/db');
const { validateLatitude, validateLongitude, validateInteger, validatePagination, validateOptionalString, validateAllowedValue } = require('../utils/validation');
const { getBarangayFromCoordinates } = require('../utils/geolocation');
const { processIncidentWithAudio } = require('../services/aiService');
const { queueDeepScanJob, computeInitialScanStatus } = require('../services/fileScanService');
const { verifyIncidentOnBlockchain } = require('../services/blockchainService');
const { saveAudioFile, saveMediaFiles, deleteIncidentFiles, fileExists, getAbsolutePath } = require('../utils/fileValidation');
const { logDispatcherAction, logUserAction } = require('../utils/auditLog');
const { ROLES } = require('../config/roles');
const { isResourceOwner, getOwnershipFilter } = require('../utils/ownership');
const path = require('path');
const fs = require('fs').promises;

/**
 * Helper function for role-appropriate audit logging
 * Automatically calls the correct logging function based on user role
 */
async function logIncidentAction(req, action, resourceId, details) {
  if (!req.user) return;
  try {
    if (req.user.role === ROLES.DISPATCHER || req.user.role === ROLES.ADMIN) {
      await logDispatcherAction(req, action, 'incident', resourceId, details);
    } else if (req.user.role === ROLES.USER) {
      await logUserAction(req, action, 'incident', resourceId, details);
    }
  } catch (err) {
    console.error('Audit logging error:', err.message);
  }
}

/**
 * Attach assigned_department, assigned_department_code, and assigned_team_name from dispatches for the report.
 * Mutates incident in place; returns incident for chaining.
 * Resolves department name from departments table when dispatch has department_code but no department_name.
 * assigned_team_name comes from the first dispatch (by dispatched_at) that has team_name set (the assigned team).
 */
async function attachAssignedDepartment(incident, reportId) {
  if (!incident || reportId == null) return incident;
  try {
    const dispatches = await Dispatch.findAll({ report_id: reportId, limit: 20 });
    if (dispatches && dispatches.length > 0) {
      const d = dispatches[0];
      const code = d.department_code ?? d.department_Code ?? null;
      let name = d.department_name ?? d.department_Name ?? null;
      if ((!name || String(name).trim() === '') && code) {
        const dept = await Department.findByCode(code);
        name = dept?.name ?? null;
      }
      incident.assigned_department = name && String(name).trim() !== '' ? String(name).trim() : null;
      incident.assigned_department_code = code && String(code).trim() !== '' ? String(code).trim() : null;
      const withTeam = dispatches.find((row) => row.team_name && String(row.team_name).trim() !== '');
      if (withTeam) {
        incident.assigned_team_name = String(withTeam.team_name).trim();
        incident.assigned_team_department_code = (withTeam.department_code ?? withTeam.department_Code) && String(withTeam.department_code || withTeam.department_Code).trim() !== ''
          ? String(withTeam.department_code || withTeam.department_Code).trim()
          : incident.assigned_department_code;
      } else {
        incident.assigned_team_name = null;
        incident.assigned_team_department_code = null;
      }
    }
  } catch (err) {
    console.error('Error attaching assigned department:', err.message);
  }
  return incident;
}

async function releaseIncidentResources(reportId) {
  try {
    const dispatches = await Dispatch.findAll({ report_id: reportId, limit: 100 });
    const seenTeams = new Set();

    for (const d of dispatches || []) {
      const dc = d.department_code;
      const tn = d.team_name;
      if (dc && tn) {
        const key = `${String(dc).toLowerCase()}::${String(tn).toLowerCase()}`;
        if (!seenTeams.has(key)) {
          seenTeams.add(key);
          try {
            const team = await Responder.findTeamByDepartmentAndName(dc, tn);
            if (team && team.team_id) {
              await Responder.updateTeamStatus(team.team_id, 'available');
            }
          } catch (err) {
            console.error('Failed to release team status:', err.message);
          }
        }
      }

      if (d.responder_id) {
        try {
          await Responder.updateStatus(d.responder_id, 'available');
        } catch (err) {
          console.error('Failed to release responder status:', err.message);
        }
      }
    }

    try {
      await Department.releaseUnitsFromReport(reportId);
    } catch (err) {
      console.error('Failed to release units:', err.message);
    }
  } catch (err) {
    console.error('Error releasing incident resources:', err.message);
  }
}

const incidentController = {
  // Create emergency incident report (fast endpoint, no AI classification)
  async createEmergency(req, res) {
    try {
      const { latitude, longitude } = req.body;
      const user_id = req.user?.user_id;

      // Validate authentication
      if (!user_id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Validate required fields
      if (latitude === undefined || latitude === null) {
        return res.status(400).json({ error: 'Latitude is required' });
      }
      if (longitude === undefined || longitude === null) {
        return res.status(400).json({ error: 'Longitude is required' });
      }

      // Validate and parse coordinates
      const validatedLat = validateLatitude(latitude);
      const validatedLng = validateLongitude(longitude);

      // Resolve barangay from incident location (dagupan_barangays.geojson)
      const barangay = getBarangayFromCoordinates(validatedLat, validatedLng);

      // Create emergency incident with high severity
      const incident = await Incident.create({
        user_id: user_id,
        incident_type: null, // No type for emergency reports
        severity_level: 'high', // Automatically set to high priority
        description: null,
        latitude: validatedLat,
        longitude: validatedLng,
        barangay,
        media_url: null,
        status: 'pending'
      });

      await logIncidentAction(req, 'incident_create', incident.report_id, { type: 'emergency', severity_level: 'high' });

      res.status(201).json({
        success: true,
        message: 'Emergency incident reported successfully',
        incident: incident
      });
    } catch (error) {
      console.error('Error creating emergency incident:', error);
      if (error.message.includes('must be') || error.message.includes('Latitude') || error.message.includes('Longitude')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to create emergency incident' });
    }
  },

  // Get incident by ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const validatedId = validateInteger(id, 'report_id');

      const incident = await Incident.findById(validatedId);
      if (!incident) {
        return res.status(404).json({ error: 'Incident not found' });
      }

      // Check ownership: dispatchers/admins see all; department-head/department-admin see if assigned to their department; users see own only
      const deptRole = req.user.role === ROLES.DEPARTMENT_HEAD || req.user.role === ROLES.DEPARTMENT_ADMIN;
      if (deptRole && req.user.user_id) {
        const fullUser = await User.findById(req.user.user_id);
        if (fullUser && fullUser.department_id) {
          const dept = await Department.findById(fullUser.department_id);
          if (dept && dept.code) {
            const dispatches = await Dispatch.findAll({ report_id: validatedId, department_code: dept.code, limit: 1 });
            if (dispatches && dispatches.length > 0) {
              await attachAssignedDepartment(incident, validatedId);
              return res.json(incident);
            }
          }
        }
      }
      if (!isResourceOwner(req.user, incident.user_id)) {
        return res.status(403).json({ error: 'Forbidden. You can only access your own incidents.' });
      }

      await attachAssignedDepartment(incident, validatedId);
      res.json(incident);
    } catch (error) {
      console.error('Error fetching incident:', error);
      if (error.message.includes('must be') || error.message.includes('must not')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Get all incidents with pagination and filters
  async getAll(req, res) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { limit, offset, severity_level, status, incident_type, barangay } = req.query;
      const { limit: validatedLimit, offset: validatedOffset } = validatePagination(limit, offset);
      const validatedSeverityLevel = validateAllowedValue(severity_level, ['low', 'medium', 'high'], 'severity_level');
      const validatedStatus = validateAllowedValue(status, ['pending', 'verified', 'in_progress', 'resolved', 'closed'], 'status');
      const validatedIncidentType = validateAllowedValue(incident_type, ['fire', 'medical', 'police', 'disaster'], 'incident_type');
      const validatedBarangay = validateOptionalString(barangay, 'barangay', 150);

      // Regular users only see their own incidents; dispatcher/admin see all; department-head/admin/personnel see only incidents assigned to their department
      let incidents;
      let totalCount;
      let departmentCode = null;
      const roleNeedsDeptFilter = user.role === ROLES.DEPARTMENT_HEAD || user.role === ROLES.DEPARTMENT_ADMIN || user.role === ROLES.USER;
      if (user.user_id && roleNeedsDeptFilter) {
        const fullUser = await User.findById(user.user_id);
        if (fullUser && fullUser.department_id) {
          const dept = await Department.findById(fullUser.department_id);
          if (dept && dept.code) departmentCode = dept.code;
        }
      }

      if (user.role === ROLES.USER && !departmentCode) {
        incidents = await Incident.findByUserId(user.user_id, {
          limit: validatedLimit,
          offset: validatedOffset,
          severity_level: validatedSeverityLevel,
          status: validatedStatus,
          incident_type: validatedIncidentType,
          barangay: validatedBarangay,
        });
        totalCount = await Incident.countAll({
          user_id: user.user_id,
          severity_level: validatedSeverityLevel,
          status: validatedStatus,
          incident_type: validatedIncidentType,
          barangay: validatedBarangay,
        });
      } else {
        incidents = await Incident.findAll({
          limit: validatedLimit,
          offset: validatedOffset,
          severity_level: validatedSeverityLevel,
          status: validatedStatus,
          incident_type: validatedIncidentType,
          barangay: validatedBarangay,
          department_code: departmentCode,
        });
        totalCount = await Incident.countAll({
          severity_level: validatedSeverityLevel,
          status: validatedStatus,
          incident_type: validatedIncidentType,
          barangay: validatedBarangay,
          department_code: departmentCode,
        });
      }

      res.setHeader('x-total-count', String(totalCount));
      res.setHeader('x-limit', String(validatedLimit));
      res.setHeader('x-offset', String(validatedOffset));
      res.json(incidents);
    } catch (error) {
      console.error('Error fetching incidents:', error);
      if (error.message.includes('must be') || error.message.includes('must not')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Get current user's incidents
  async getMyIncidents(req, res) {
    try {
      const user_id = req.user?.user_id;
      if (!user_id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { limit, offset, status, incident_type } = req.query;
      const { limit: validatedLimit, offset: validatedOffset } = validatePagination(limit, offset);
      const validatedStatus = validateAllowedValue(status, ['pending', 'verified', 'in_progress', 'resolved', 'closed'], 'status');
      const validatedIncidentType = validateAllowedValue(incident_type, ['fire', 'medical', 'police', 'disaster'], 'incident_type');

      const incidents = await Incident.findByUserId(user_id, {
        limit: validatedLimit,
        offset: validatedOffset,
        status: validatedStatus,
        incident_type: validatedIncidentType
      });

      res.json(incidents);
    } catch (error) {
      console.error('Error fetching user incidents:', error);
      if (error.message.includes('must be') || error.message.includes('must not')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Create incident with audio and optional media files (AI-enhanced)
  async createWithAudio(req, res) {
    const startedAt = Date.now();
    const requestId = req.requestId || 'none';
    try {
      const { latitude, longitude, description } = req.body;
      const user_id = req.user?.user_id;

      // Validate authentication
      if (!user_id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Validate required fields
      if (latitude === undefined || latitude === null) {
        return res.status(400).json({ error: 'Latitude is required' });
      }
      if (longitude === undefined || longitude === null) {
        return res.status(400).json({ error: 'Longitude is required' });
      }

      // Validate coordinates
      const validatedLat = validateLatitude(latitude);
      const validatedLng = validateLongitude(longitude);

      // Validate optional description (max 2000 chars)
      const validatedDescription = description != null && description !== ''
        ? validateOptionalString(description, 'description', 2000)
        : null;

      // Resolve barangay from incident location (dagupan_barangays.geojson)
      const barangay = getBarangayFromCoordinates(validatedLat, validatedLng);

      // Check if audio file is provided
      const audioFile = req.files?.audio?.[0];
      if (!audioFile) {
        return res.status(400).json({ error: 'Audio file is required' });
      }

      // Get media files if provided
      const mediaFiles = req.files?.media || [];

      console.log(`[backend][incident][createWithAudio] request_id=${requestId} status=start user_id=${user_id} audio_name=${audioFile.originalname} audio_bytes=${audioFile.size} media_count=${mediaFiles.length}`);

      // Create initial incident record (without AI classification)
      const incident = await Incident.createWithAi({
        user_id,
        incident_type: null, // Will be filled by AI
        severity_level: 'medium', // Temporary, will be updated by AI
        description: validatedDescription,
        latitude: validatedLat,
        longitude: validatedLng,
        barangay,
        transcription: null, // Will be filled by AI
        audio_path: null, // Will be updated after file save
        media_paths: [],
        ai_pending: true, // Mark as pending AI processing
        ai_attempted: false,
        scan_status: 'pending',
        scan_engine: 'stub',
        scan_error: null,
        status: 'pending'
      });

      const reportId = incident.report_id;
      await logIncidentAction(req, 'incident_create', reportId, { type: 'with_audio', severity_level: 'medium' });

      let audioPath = null;
      let mediaPaths = [];
      let deepScanResult = null;

      try {
        // Save audio file to disk
        const saveStart = Date.now();
        audioPath = await saveAudioFile(audioFile, reportId);
        console.log(`[backend][incident][createWithAudio] request_id=${requestId} report_id=${reportId} stage=save_audio latency_ms=${Date.now() - saveStart}`);

        // Save media files to disk
        if (mediaFiles.length > 0) {
          const mediaStart = Date.now();
          mediaPaths = await saveMediaFiles(mediaFiles, reportId);
          console.log(`[backend][incident][createWithAudio] request_id=${requestId} report_id=${reportId} stage=save_media latency_ms=${Date.now() - mediaStart} media_count=${mediaPaths.length}`);
        }

        const scanStart = Date.now();
        deepScanResult = await queueDeepScanJob({
          reportId,
          filePaths: [audioPath, ...mediaPaths].filter(Boolean)
        });
        console.log(`[backend][incident][createWithAudio] request_id=${requestId} report_id=${reportId} stage=deep_scan latency_ms=${Date.now() - scanStart} deep_scan_status=${deepScanResult?.status || 'unknown'}`);
        const initialScanStatus = computeInitialScanStatus({
          uploadSecurity: req.uploadSecurity,
          deepScanResult,
        });

        await Incident.updateScanStatus(reportId, {
          scan_status: initialScanStatus.scan_status,
          scan_engine: initialScanStatus.scan_engine,
          scan_error: initialScanStatus.scan_error,
          scanned_at: initialScanStatus.scan_status === 'clean' ? new Date() : null,
          quarantined: false,
          quarantine_reason: null,
        });

        // Process with AI
        const aiStart = Date.now();
        const aiResult = await processIncidentWithAudio(
          audioFile.buffer,
          audioFile.originalname,
          validatedDescription,
          { requestId }
        );
        console.log(`[backend][incident][createWithAudio] request_id=${requestId} report_id=${reportId} stage=ai_classification latency_ms=${Date.now() - aiStart} primary_type=${aiResult.primaryType || 'unknown'} severity=${aiResult.severity}`);

        // Update incident with AI results
        const updatedIncident = await Incident.updateWithAiResults(reportId, {
          incident_type: aiResult.primaryType,
          severity_level: aiResult.severity,
          primary_classification: aiResult.primaryType,
          primary_confidence: aiResult.maxConfidence,
          secondary_classification: aiResult.secondaryType,
          secondary_confidence: aiResult.secondaryConfidence,
          transcription: aiResult.transcription,
          ai_pending: false,
          ai_attempted: true
        });

        // Create AI classification record
        await Incident.createClassification({
          report_id: reportId,
          predicted_type: aiResult.primaryType,
          predicted_severity: aiResult.severity,
          confidence_score: aiResult.maxConfidence,
          secondary_predicted_type: aiResult.secondaryType,
          secondary_confidence_score: aiResult.secondaryConfidence,
          low_confidence_flag: aiResult.lowConfidenceFlag,
          is_duplicate: false,
          is_override: false,
          retry_count: 0
        });

        // Update incident with file paths
        await pool.query(
          `UPDATE incident_reports 
           SET audio_path = $1, media_paths = $2 
           WHERE report_id = $3`,
          [audioPath, JSON.stringify(mediaPaths), reportId]
        );

        console.log(`[backend][incident][createWithAudio] request_id=${requestId} report_id=${reportId} status=success latency_ms=${Date.now() - startedAt} ai_pending=false`);

        res.status(201).json({
          success: true,
          message: 'Incident reported successfully with AI classification',
          incident: {
            ...updatedIncident,
            audio_path: audioPath,
            media_paths: mediaPaths
          },
          ai_classification: {
            incident_types: aiResult.incidentTypes,
            primary_type: aiResult.primaryType,
            secondary_type: aiResult.secondaryType || null,
            severity: aiResult.severity,
            confidence: aiResult.maxConfidence,
            secondary_confidence: aiResult.secondaryConfidence ?? null,
            low_confidence_flag: aiResult.lowConfidenceFlag,
            transcription: aiResult.transcription
          },
          security_scan: {
            quick_scan: req.uploadSecurity?.quick || null,
            deep_scan: deepScanResult,
            fail_open_flagged: Boolean(req.uploadSecurity?.requires_follow_up)
          }
        });

      } catch (aiError) {
        console.error(`[backend][incident][createWithAudio] request_id=${requestId} report_id=${reportId} status=ai_fallback error=${aiError.message}`);

        // AI processing failed, but incident was created
        // Mark as pending for retry by background job
        await Incident.markAiPending(reportId, true);

        // Update file paths
        await pool.query(
          `UPDATE incident_reports 
           SET audio_path = $1, media_paths = $2 
           WHERE report_id = $3`,
          [audioPath, JSON.stringify(mediaPaths), reportId]
        );

        console.log(`[backend][incident][createWithAudio] request_id=${requestId} report_id=${reportId} status=pending_ai_retry latency_ms=${Date.now() - startedAt}`);

        res.status(201).json({
          success: true,
          message: 'Incident reported successfully, AI classification pending',
          incident: {
            ...incident,
            audio_path: audioPath,
            media_paths: mediaPaths
          },
          ai_status: 'pending',
          ai_error: 'AI classification will be retried automatically',
          security_scan: {
            quick_scan: req.uploadSecurity?.quick || null,
            deep_scan: deepScanResult,
            fail_open_flagged: Boolean(req.uploadSecurity?.requires_follow_up)
          }
        });
      }

    } catch (error) {
      console.error(`[backend][incident][createWithAudio] request_id=${requestId} status=error latency_ms=${Date.now() - startedAt} error=${error.message}`);
      if (error.message.includes('must be') || error.message.includes('required')) {
        return res.status(400).json({ error: error.message });
      }
      const isDev = (process.env.NODE_ENV || 'development') !== 'production';
      res.status(500).json({
        error: 'Failed to create incident',
        ...(isDev ? { detail: error.message } : {}),
      });
    }
  },

  // Download audio file
  async downloadAudio(req, res) {
    try {
      const { id } = req.params;
      const validatedId = validateInteger(id, 'report_id');

      const incident = await Incident.findById(validatedId);
      if (!incident) {
        return res.status(404).json({ error: 'Incident not found' });
      }

      if (!incident.audio_path) {
        return res.status(404).json({ error: 'No audio file found for this incident' });
      }

      if (incident.quarantined) {
        return res.status(403).json({ error: 'Audio file is quarantined and unavailable for download' });
      }

      const absolutePath = getAbsolutePath(incident.audio_path);
      const exists = await fileExists(incident.audio_path);

      if (!exists) {
        return res.status(404).json({ error: 'Audio file not found on server' });
      }

      const filename = path.basename(incident.audio_path);
      res.download(absolutePath, filename, (err) => {
        if (err) {
          console.error('Error downloading audio:', err);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to download audio file' });
          }
        }
      });

    } catch (error) {
      console.error('Error downloading audio:', error);
      if (error.message.includes('must be')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Download media file by index
  async downloadMedia(req, res) {
    try {
      const { id, index } = req.params;
      const validatedId = validateInteger(id, 'report_id');
      const validatedIndex = validateInteger(index, 'index');

      const incident = await Incident.findById(validatedId);
      if (!incident) {
        return res.status(404).json({ error: 'Incident not found' });
      }

      const mediaPaths = incident.media_paths || [];
      if (mediaPaths.length === 0) {
        return res.status(404).json({ error: 'No media files found for this incident' });
      }

      if (validatedIndex < 0 || validatedIndex >= mediaPaths.length) {
        return res.status(404).json({ 
          error: `Invalid media index. Available: 0-${mediaPaths.length - 1}` 
        });
      }

      if (incident.quarantined) {
        return res.status(403).json({ error: 'Media files are quarantined and unavailable for download' });
      }

      const mediaPath = mediaPaths[validatedIndex];
      const absolutePath = getAbsolutePath(mediaPath);
      const exists = await fileExists(mediaPath);

      if (!exists) {
        return res.status(404).json({ error: 'Media file not found on server' });
      }

      const filename = path.basename(mediaPath);
      res.download(absolutePath, filename, (err) => {
        if (err) {
          console.error('Error downloading media:', err);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to download media file' });
          }
        }
      });

    } catch (error) {
      console.error('Error downloading media:', error);
      if (error.message.includes('must be')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Verify incident and record on blockchain
  async verifyIncident(req, res) {
    const startedAt = Date.now();
    const requestId = req.requestId || 'none';
    try {
      const { id } = req.params;
      const validatedId = validateInteger(id, 'report_id');

      console.log(`[backend][incident][verify] request_id=${requestId} report_id=${validatedId} status=start`);

      const incident = await Incident.findById(validatedId);
      if (!incident) {
        return res.status(404).json({ error: 'Incident not found' });
      }

      if (incident.verified) {
        return res.status(400).json({ error: 'Incident is already verified' });
      }

      const incidentData = {
        report_id: incident.report_id,
        incident_type: incident.incident_type,
        severity_level: incident.severity_level,
        description: incident.description,
        latitude: incident.latitude,
        longitude: incident.longitude,
        barangay: incident.barangay,
        status: incident.status,
        created_at: incident.created_at
      };

      const blockchainResult = await verifyIncidentOnBlockchain(validatedId, incidentData, { requestId });

      const networkReference = `${blockchainResult.tx_hash}#block${blockchainResult.block_number}`;
      await Incident.createBlockchainRecord({
        report_id: validatedId,
        hash_value: blockchainResult.hash_value,
        network_reference: networkReference
      });

      await Incident.setVerified(validatedId);

      await logIncidentAction(req, 'incident_verify', validatedId, {
        tx_hash: blockchainResult.tx_hash,
        block_number: blockchainResult.block_number,
        hash_value: blockchainResult.hash_value,
        gas_used: blockchainResult.gas_used,
        effective_gas_price: blockchainResult.effective_gas_price,
        gas_cost_wei: blockchainResult.gas_cost_wei,
        already_recorded: Boolean(blockchainResult.already_recorded)
      });

      res.json({
        success: true,
        verified: true,
        blockchain: {
          tx_hash: blockchainResult.tx_hash,
          block_number: blockchainResult.block_number,
          hash_value: blockchainResult.hash_value,
          gas_used: blockchainResult.gas_used,
          effective_gas_price: blockchainResult.effective_gas_price,
          gas_cost_wei: blockchainResult.gas_cost_wei,
          already_recorded: Boolean(blockchainResult.already_recorded)
        }
      });
      console.log(`[backend][incident][verify] request_id=${requestId} report_id=${validatedId} status=success latency_ms=${Date.now() - startedAt} block_number=${blockchainResult.block_number}`);
    } catch (error) {
      console.error(`[backend][incident][verify] request_id=${requestId} status=error latency_ms=${Date.now() - startedAt} error=${error.message}`);
      if (error.message.includes('must be') || error.message.includes('must not')) {
        return res.status(400).json({ error: error.message });
      }
      if (error.message.includes('Blockchain')) {
        return res.status(503).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to verify incident' });
    }
  },

  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const validatedId = validateInteger(id, 'report_id');
      const nextStatus = validateAllowedValue(req.body?.status, ['verified', 'in_progress', 'resolved'], 'status');
      if (!nextStatus) {
        return res.status(400).json({ error: 'status is required' });
      }

      if (req.user.role === ROLES.DEPARTMENT_ADMIN && nextStatus === 'resolved' && req.user.user_id) {
        const fullUser = await User.findById(req.user.user_id);
        if (!fullUser || fullUser.department_id == null) {
          return res.status(403).json({ error: 'You can only mark incidents as resolved when they are assigned to your department.' });
        }
        const dept = await Department.findById(fullUser.department_id);
        if (!dept || !dept.code) {
          return res.status(403).json({ error: 'You can only mark incidents as resolved when they are assigned to your department.' });
        }
        const dispatches = await Dispatch.findAll({ report_id: validatedId, department_code: dept.code, limit: 1 });
        if (!dispatches || dispatches.length === 0) {
          return res.status(403).json({ error: 'You can only mark incidents as resolved when they are assigned to your department.' });
        }
      }

      const updatedIncident = await Incident.transitionStatus(validatedId, {
        next_status: nextStatus,
        actor_user_id: req.user?.user_id || null,
        actor_role: req.user?.role || null,
      });

      if (!updatedIncident) {
        return res.status(404).json({ error: 'Incident not found' });
      }

      if (nextStatus === 'resolved' || nextStatus === 'closed') {
        await releaseIncidentResources(validatedId);
      }

      await logIncidentAction(req, 'incident_status_update', validatedId, {
        next_status: nextStatus,
      });
      res.json({
        success: true,
        incident: updatedIncident,
      });
    } catch (error) {
      console.error('Error updating incident status:', error);
      if (error.httpStatus) {
        return res.status(error.httpStatus).json({ error: error.message, code: error.code });
      }
      if (error.message.includes('must be') || error.message.includes('must not')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to update incident status' });
    }
  },

  async confirmResolution(req, res) {
    try {
      const { id } = req.params;
      const validatedId = validateInteger(id, 'report_id');
      const userId = req.user?.user_id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const updatedIncident = await Incident.confirmResolution(validatedId, userId);
      if (!updatedIncident) {
        return res.status(404).json({ error: 'Incident not found' });
      }

      if (updatedIncident.status === 'closed') {
        await releaseIncidentResources(validatedId);
      }

      await logIncidentAction(req, 'incident_reporter_confirm_resolution', validatedId, {});
      res.json({
        success: true,
        incident: updatedIncident,
      });
    } catch (error) {
      console.error('Error confirming incident resolution:', error);
      if (error.httpStatus) {
        return res.status(error.httpStatus).json({ error: error.message, code: error.code });
      }
      if (error.message.includes('must be') || error.message.includes('must not')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to confirm incident resolution' });
    }
  },

  // Manually reclassify incident (human override with AI audit trail)
  async reclassifyIncident(req, res) {
    try {
      const { id } = req.params;
      const validatedId = validateInteger(id, 'report_id');
      const validatedType = validateAllowedValue(req.body?.incident_type, ['fire', 'medical', 'police', 'disaster'], 'incident_type');
      const validatedSeverity = validateAllowedValue(req.body?.severity_level, ['low', 'medium', 'high'], 'severity_level');
      const reason = req.body?.reason != null && req.body?.reason !== ''
        ? validateOptionalString(req.body.reason, 'reason', 500)
        : null;

      if (!validatedType || !validatedSeverity) {
        return res.status(400).json({ error: 'incident_type and severity_level are required' });
      }

      if (!reason || String(reason).trim().length < 10) {
        return res.status(400).json({ error: 'A manual override reason with at least 10 characters is required' });
      }

      const incident = await Incident.findById(validatedId);
      if (!incident) {
        return res.status(404).json({ error: 'Incident not found' });
      }

      const previousClassification = await Incident.getClassificationByReportId(validatedId);

      const updatedIncident = await Incident.updateClassification(validatedId, {
        incident_type: validatedType,
        severity_level: validatedSeverity,
      });

      const overrideClassification = await Incident.createClassification({
        report_id: validatedId,
        predicted_type: validatedType,
        predicted_severity: validatedSeverity,
        confidence_score: previousClassification?.confidence_score ?? null,
        secondary_predicted_type: previousClassification?.secondary_predicted_type ?? null,
        secondary_confidence_score: previousClassification?.secondary_confidence_score ?? null,
        low_confidence_flag: false,
        is_duplicate: false,
        is_override: true,
        retry_count: previousClassification?.retry_count ?? 0,
      });

      await logIncidentAction(req, 'incident_reclassify', validatedId, {
        previous_type: incident.incident_type,
        previous_severity: incident.severity_level,
        new_type: validatedType,
        new_severity: validatedSeverity,
        reason,
        previous_confidence_score: previousClassification?.confidence_score ?? null,
        was_low_confidence: Boolean(previousClassification?.low_confidence_flag),
      });

      res.json({
        success: true,
        message: 'Incident reclassified successfully',
        incident: updatedIncident,
        ai_classification: overrideClassification,
      });
    } catch (error) {
      console.error('Error reclassifying incident:', error);
      if (error.message.includes('must be') || error.message.includes('must not')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to reclassify incident' });
    }
  },

  // Get incident with AI classification
  async getByIdWithAi(req, res) {
    try {
      const { id } = req.params;
      const validatedId = validateInteger(id, 'report_id');

      const incident = await Incident.findById(validatedId);
      if (!incident) {
        return res.status(404).json({ error: 'Incident not found' });
      }

      // Same access rules as getById: department-head/department-admin can see if assigned to their department
      const deptRoleWithAi = req.user.role === ROLES.DEPARTMENT_HEAD || req.user.role === ROLES.DEPARTMENT_ADMIN;
      if (deptRoleWithAi && req.user.user_id) {
        const fullUser = await User.findById(req.user.user_id);
        if (fullUser && fullUser.department_id) {
          const dept = await Department.findById(fullUser.department_id);
          if (dept && dept.code) {
            const dispatches = await Dispatch.findAll({ report_id: validatedId, department_code: dept.code, limit: 1 });
            if (dispatches && dispatches.length > 0) {
              await attachAssignedDepartment(incident, validatedId);
              const classification = await Incident.getClassificationByReportId(validatedId);
              return res.json({ incident, ai_classification: classification || null });
            }
          }
        }
      }
      if (!isResourceOwner(req.user, incident.user_id)) {
        return res.status(403).json({ error: 'Forbidden. You can only access your own incidents.' });
      }

      // Get AI classification if exists
      await attachAssignedDepartment(incident, validatedId);
      const classification = await Incident.getClassificationByReportId(validatedId);

      res.json({
        incident,
        ai_classification: classification || null
      });

    } catch (error) {
      console.error('Error fetching incident with AI:', error);
      if (error.message.includes('must be')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

module.exports = incidentController;
