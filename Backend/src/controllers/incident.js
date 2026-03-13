const Incident = require('../models/incident');
const User = require('../models/user');
const Department = require('../models/department');
const Dispatch = require('../models/dispatch');
const Responder = require('../models/responder');
const IncidentCoordinationNote = require('../models/incidentCoordinationNote');
const pool = require('../config/db');
const { validateLatitude, validateLongitude, validateInteger, validatePagination, validateOptionalString, validateAllowedValue } = require('../utils/validation');
const { getBarangayFromCoordinates, calculateDistance } = require('../utils/geolocation');
const { processIncidentWithAudio } = require('../services/aiService');
const { queueDeepScanJob, computeInitialScanStatus } = require('../services/fileScanService');
const { verifyIncidentOnBlockchain } = require('../services/blockchainService');
const { saveAudioFile, saveMediaFiles, deleteIncidentFiles, fileExists, getAbsolutePath } = require('../utils/fileValidation');
const { logDispatcherAction, logUserAction } = require('../utils/auditLog');
const { ROLES } = require('../config/roles');
const { isResourceOwner, getOwnershipFilter } = require('../utils/ownership');
const path = require('path');
const fs = require('fs').promises;

function estimateEtaMinutes(distanceMeters, speedKmh = 35) {
  const speedMetersPerMinute = (speedKmh * 1000) / 60;
  return Math.max(1, Math.round(distanceMeters / speedMetersPerMinute));
}

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

async function getDispatchesForReport(reportId, limit = 50) {
  if (reportId == null) return [];
  try {
    const rows = await Dispatch.findAll({ report_id: reportId, limit });
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    console.error('Error loading dispatches for report:', error.message);
    return [];
  }
}

/**
 * Attach assigned_department, assigned_department_code, and assigned_team_name from dispatches for the report.
 * Mutates incident in place; returns incident for chaining.
 * Resolves department name from departments table when dispatch has department_code but no department_name.
 * assigned_team_name comes from the first dispatch (by dispatched_at) that has team_name set (the assigned team).
 */
async function attachAssignedDepartment(incident, reportId, dispatches = null) {
  if (!incident || reportId == null) return incident;
  try {
    const sourceDispatches = Array.isArray(dispatches) ? dispatches : await getDispatchesForReport(reportId, 20);
    incident.assigned_department = null;
    incident.assigned_department_code = null;
    incident.assigned_team_name = null;
    incident.assigned_team_department_code = null;
    incident.assigned_departments = [];
    incident.lead_department = null;

    if (sourceDispatches.length > 0) {
      const departmentNameByCode = new Map();
      const departmentEntries = [];

      for (const dispatch of sourceDispatches) {
        const code = dispatch.department_code ?? dispatch.department_Code ?? null;
        if (!code || String(code).trim() === '') continue;
        const normalizedCode = String(code).trim();

        let name = dispatch.department_name ?? dispatch.department_Name ?? null;
        if ((!name || String(name).trim() === '') && !departmentNameByCode.has(normalizedCode)) {
          const dept = await Department.findByCode(normalizedCode);
          departmentNameByCode.set(normalizedCode, dept?.name ? String(dept.name).trim() : null);
        }
        if ((!name || String(name).trim() === '') && departmentNameByCode.has(normalizedCode)) {
          name = departmentNameByCode.get(normalizedCode);
        }

        const normalizedName = name && String(name).trim() !== '' ? String(name).trim() : normalizedCode;
        departmentEntries.push({ code: normalizedCode, name: normalizedName });
      }

      const uniqueDepartments = [];
      const seenDepartmentCodes = new Set();
      for (const entry of departmentEntries) {
        if (seenDepartmentCodes.has(entry.code)) continue;
        seenDepartmentCodes.add(entry.code);
        uniqueDepartments.push(entry);
      }

      const leadDepartmentEntry = uniqueDepartments[0] || null;
      incident.assigned_department = leadDepartmentEntry?.name || null;
      incident.assigned_department_code = leadDepartmentEntry?.code || null;
      incident.assigned_departments = uniqueDepartments
        .map((entry) => entry.name)
        .filter((name) => name && String(name).trim() !== '');
      incident.lead_department = leadDepartmentEntry?.name || null;

      const withTeam = sourceDispatches.find((row) => row.team_name && String(row.team_name).trim() !== '');
      if (withTeam) {
        incident.assigned_team_name = String(withTeam.team_name).trim();
        incident.assigned_team_department_code = (withTeam.department_code ?? withTeam.department_Code) && String(withTeam.department_code || withTeam.department_Code).trim() !== ''
          ? String(withTeam.department_code || withTeam.department_Code).trim()
          : incident.assigned_department_code;
      }
    }
  } catch (err) {
    console.error('Error attaching assigned department:', err.message);
  }
  return incident;
}

/**
 * Build incident timeline from created_at, dispatches, resolved_at, and closed_at.
 * Returns array of events sorted chronologically by timestamp.
 */
async function buildIncidentTimeline(incident, reportId, dispatches = null) {
  if (!incident || reportId == null) return incident;
  try {
    const events = [];

    // 1. Created event
    if (incident.created_at) {
      events.push({
        type: 'created',
        timestamp: incident.created_at,
        label: 'Incident created',
        detail: incident.reporter_name || incident.reporterName || null,
      });
    }

    // 2. Assignment events from dispatches
    const sourceDispatches = Array.isArray(dispatches) ? dispatches : await getDispatchesForReport(reportId, 50);
    if (sourceDispatches.length > 0) {
      // Sort by dispatched_at ascending
      const sortedDispatches = sourceDispatches
        .filter(d => d.dispatched_at)
        .sort((a, b) => new Date(a.dispatched_at) - new Date(b.dispatched_at));

      for (const d of sortedDispatches) {
        const deptName = d.department_name || d.department_code || 'Department';
        const teamPart = d.team_name ? ` (${d.team_name})` : '';
        events.push({
          type: 'assigned',
          timestamp: d.dispatched_at,
          label: `Assigned to ${deptName}${teamPart}`,
          detail: {
            department_name: d.department_name || null,
            department_code: d.department_code || null,
            team_name: d.team_name || null,
            assigned_by_user_id: d.assigned_by_user_id || null,
            estimated_eta_minutes: Number.isFinite(Number(d.estimated_eta_minutes)) ? Number(d.estimated_eta_minutes) : null,
            estimated_arrival_at: d.estimated_arrival_at || null,
            actual_arrival_at: d.actual_arrival_at || null,
          },
        });
      }
    }

    // 3. Resolved event
    if (incident.resolved_at || (incident.status === 'resolved' && incident.resolved_by_user_id)) {
      events.push({
        type: 'resolved',
        timestamp: incident.resolved_at || incident.updated_at || null,
        label: 'Marked as done',
        detail: incident.resolved_by_user_id ? { resolved_by_user_id: incident.resolved_by_user_id } : null,
      });
    }

    // 4. Closed event
    if (incident.closed_at || incident.status === 'closed') {
      events.push({
        type: 'closed',
        timestamp: incident.closed_at || incident.updated_at || null,
        label: 'Closed',
        detail: {
          closed_by_user_id: incident.closed_by_user_id || null,
          closure_method: incident.closure_method || null,
        },
      });
    }

    // Sort all events by timestamp ascending
    events.sort((a, b) => {
      if (!a.timestamp) return 1;
      if (!b.timestamp) return -1;
      return new Date(a.timestamp) - new Date(b.timestamp);
    });

    incident.timeline = events;
  } catch (err) {
    console.error('Error building incident timeline:', err.message);
    incident.timeline = [];
  }
  return incident;
}

async function attachDispatchEta(incident, reportId, dispatches = null) {
  if (!incident || reportId == null) return incident;
  try {
    const sourceDispatches = Array.isArray(dispatches) ? dispatches : await getDispatchesForReport(reportId, 20);
    if (sourceDispatches.length === 0) {
      incident.estimated_eta_minutes = null;
      incident.estimated_arrival_at = null;
      incident.actual_arrival_at = null;
      return incident;
    }

    const earliest = [...sourceDispatches].sort((a, b) => {
      const aTime = new Date(a.dispatched_at || 0).getTime();
      const bTime = new Date(b.dispatched_at || 0).getTime();
      return aTime - bTime;
    })[0];

    let etaMinutes = Number.isFinite(Number(earliest?.estimated_eta_minutes)) ? Number(earliest.estimated_eta_minutes) : null;
    let etaArrivalAt = earliest?.estimated_arrival_at || null;

    if (!etaMinutes && Number.isFinite(Number(incident.latitude)) && Number.isFinite(Number(incident.longitude))) {
      const departmentCode = earliest?.department_code || null;
      if (departmentCode) {
        const dept = await Department.findByCode(departmentCode);
        const deptLat = Number(dept?.latitude);
        const deptLng = Number(dept?.longitude);
        if (Number.isFinite(deptLat) && Number.isFinite(deptLng)) {
          const distanceMeters = calculateDistance(Number(incident.latitude), Number(incident.longitude), deptLat, deptLng);
          etaMinutes = estimateEtaMinutes(distanceMeters);
          const dispatchedAt = earliest?.dispatched_at ? new Date(earliest.dispatched_at) : new Date();
          etaArrivalAt = new Date(dispatchedAt.getTime() + (etaMinutes * 60 * 1000)).toISOString();
        }
      }
    }

    incident.estimated_eta_minutes = etaMinutes;
    incident.estimated_arrival_at = etaArrivalAt;
    incident.actual_arrival_at = earliest?.actual_arrival_at || null;
  } catch (err) {
    console.error('Error attaching dispatch ETA:', err.message);
    incident.estimated_eta_minutes = null;
    incident.estimated_arrival_at = null;
    incident.actual_arrival_at = null;
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

async function ensureIncidentBarangay(incident) {
  if (!incident) return incident;
  const currentBarangay = String(incident.barangay || '').trim();
  if (currentBarangay) return incident;

  const latitude = Number(incident.latitude);
  const longitude = Number(incident.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return incident;

  const derivedBarangay = getBarangayFromCoordinates(latitude, longitude);
  if (!derivedBarangay) return incident;

  incident.barangay = derivedBarangay;
  try {
    await pool.query(
      `UPDATE incident_reports SET barangay = $1 WHERE report_id = $2`,
      [derivedBarangay, incident.report_id]
    );
  } catch (error) {
    console.error('Error persisting derived barangay:', error.message);
  }
  return incident;
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
              const incidentDispatches = await getDispatchesForReport(validatedId, 50);
              await attachAssignedDepartment(incident, validatedId, incidentDispatches);
              await ensureIncidentBarangay(incident);
              await attachDispatchEta(incident, validatedId, incidentDispatches);
              await buildIncidentTimeline(incident, validatedId, incidentDispatches);
              return res.json(incident);
            }
          }
        }
      }
      if (!isResourceOwner(req.user, incident.user_id)) {
        return res.status(403).json({ error: 'Forbidden. You can only access your own incidents.' });
      }

      const incidentDispatches = await getDispatchesForReport(validatedId, 50);
      await attachAssignedDepartment(incident, validatedId, incidentDispatches);
      await ensureIncidentBarangay(incident);
      await attachDispatchEta(incident, validatedId, incidentDispatches);
      await buildIncidentTimeline(incident, validatedId, incidentDispatches);
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
    const startedAt = Date.now();
    const requestId = req.requestId || 'none';
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

      // Regular users only see their own incidents; dispatcher/admin see all; department-scoped roles see incidents assigned to their department
      let incidents = [];
      let totalCount = 0;
      let departmentCode = null;
      const deptFilterStart = Date.now();
      const roleNeedsDeptFilter =
        user.role === ROLES.DEPARTMENT_HEAD
        || user.role === ROLES.DEPARTMENT_ADMIN
        || user.role === ROLES.PERSONNEL;
      if (user.user_id && roleNeedsDeptFilter) {
        const fullUser = await User.findById(user.user_id);
        if (!fullUser || !fullUser.department_id) {
          return res.status(403).json({ error: 'You are not assigned to a department.' });
        }
        const dept = await Department.findById(fullUser.department_id);
        if (!dept || !dept.code) {
          return res.status(400).json({ error: 'Department code is missing. Please contact system admin.' });
        }
        departmentCode = dept.code;
      }
      const deptFilterLatencyMs = Date.now() - deptFilterStart;

      const dataFetchStart = Date.now();
      if (user.role === ROLES.USER) {
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
      const dataFetchLatencyMs = Date.now() - dataFetchStart;

      res.setHeader('x-total-count', String(totalCount));
      res.setHeader('x-limit', String(validatedLimit));
      res.setHeader('x-offset', String(validatedOffset));
      const totalLatencyMs = Date.now() - startedAt;
      if (totalLatencyMs >= 1000) {
        console.warn(
          `[backend][incident][getAll] request_id=${requestId} status=slow total_latency_ms=${totalLatencyMs} dept_filter_latency_ms=${deptFilterLatencyMs} data_fetch_latency_ms=${dataFetchLatencyMs} rows=${Array.isArray(incidents) ? incidents.length : 0} total_count=${Number(totalCount || 0)}`
        );
      }
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

      if (nextStatus === 'resolved') {
        const isDepartmentResolver = req.user.role === ROLES.DEPARTMENT_ADMIN || req.user.role === ROLES.DEPARTMENT_HEAD;
        if (!isDepartmentResolver) {
          return res.status(403).json({ error: 'Only department admin or department head can mark incidents as resolved.' });
        }
        if (!req.user.user_id) {
          return res.status(403).json({ error: 'Department context is required to resolve incidents.' });
        }

        const fullUser = await User.findById(req.user.user_id);
        if (!fullUser || fullUser.department_id == null) {
          return res.status(403).json({ error: 'You can only mark incidents as resolved when they are assigned to your department.' });
        }
        const dept = await Department.findById(fullUser.department_id);
        if (!dept || !dept.code) {
          return res.status(403).json({ error: 'You can only mark incidents as resolved when they are assigned to your department.' });
        }
        const dispatches = await Dispatch.findAll({ report_id: validatedId, department_code: dept.code, limit: 200 });
        if (!dispatches || dispatches.length === 0) {
          return res.status(403).json({ error: 'You can only mark incidents as resolved when they are assigned to your department.' });
        }
        const hasAssignedTeam = dispatches.some((row) => String(row.team_name || '').trim() !== '');
        if (!hasAssignedTeam) {
          return res.status(409).json({ error: 'Assign a team first before marking this incident as resolved.' });
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

  // Get coordination notes for an incident
  async getCoordinationNotes(req, res) {
    try {
      const { id } = req.params;
      const validatedId = validateInteger(id, 'report_id');

      const incident = await Incident.findById(validatedId);
      if (!incident) {
        return res.status(404).json({ error: 'Incident not found' });
      }

      // Same access check as getById: dispatchers/admins see all; department-head/department-admin see if assigned to their department; users see own only
      const deptRole = req.user.role === ROLES.DEPARTMENT_HEAD || req.user.role === ROLES.DEPARTMENT_ADMIN;
      if (deptRole && req.user.user_id) {
        const fullUser = await User.findById(req.user.user_id);
        if (fullUser && fullUser.department_id) {
          const dept = await Department.findById(fullUser.department_id);
          if (dept && dept.code) {
            const dispatches = await Dispatch.findAll({ report_id: validatedId, department_code: dept.code, limit: 1 });
            if (dispatches && dispatches.length > 0) {
              // Allowed - fall through to fetch notes
            } else {
              return res.status(403).json({ error: 'Forbidden. You can only access incidents assigned to your department.' });
            }
          } else {
            return res.status(403).json({ error: 'Forbidden. Department not found.' });
          }
        } else {
          return res.status(403).json({ error: 'Forbidden. User department not set.' });
        }
      } else if (!isResourceOwner(req.user, incident.user_id)) {
        return res.status(403).json({ error: 'Forbidden. You can only access your own incidents.' });
      }

      const notes = await IncidentCoordinationNote.findByReportId(validatedId);

      // Format notes for frontend compatibility
      const formattedNotes = notes.map((n) => ({
        id: n.id,
        report_id: n.report_id,
        user_id: n.user_id,
        author: n.author_name,
        role: n.author_role,
        department: n.department,
        note: n.note,
        source: n.source,
        timestamp: new Date(n.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }),
        created_at: n.created_at,
      }));

      res.json(formattedNotes);
    } catch (error) {
      console.error('Error fetching coordination notes:', error);
      if (error.message.includes('must be') || error.message.includes('must not')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Add a coordination note to an incident
  async addCoordinationNote(req, res) {
    try {
      const { id } = req.params;
      const { note } = req.body;
      const validatedId = validateInteger(id, 'report_id');

      // Validate note content
      if (!note || typeof note !== 'string' || note.trim().length === 0) {
        return res.status(400).json({ error: 'Note is required and must be a non-empty string.' });
      }
      const trimmedNote = note.trim();
      if (trimmedNote.length > 2000) {
        return res.status(400).json({ error: 'Note must not exceed 2000 characters.' });
      }

      const incident = await Incident.findById(validatedId);
      if (!incident) {
        return res.status(404).json({ error: 'Incident not found' });
      }

      // Same access check as getById
      const deptRole = req.user.role === ROLES.DEPARTMENT_HEAD || req.user.role === ROLES.DEPARTMENT_ADMIN;
      if (deptRole && req.user.user_id) {
        const fullUser = await User.findById(req.user.user_id);
        if (fullUser && fullUser.department_id) {
          const dept = await Department.findById(fullUser.department_id);
          if (dept && dept.code) {
            const dispatches = await Dispatch.findAll({ report_id: validatedId, department_code: dept.code, limit: 1 });
            if (dispatches && dispatches.length === 0) {
              return res.status(403).json({ error: 'Forbidden. You can only add notes to incidents assigned to your department.' });
            }
          } else {
            return res.status(403).json({ error: 'Forbidden. Department not found.' });
          }
        } else {
          return res.status(403).json({ error: 'Forbidden. User department not set.' });
        }
      } else if (!isResourceOwner(req.user, incident.user_id)) {
        return res.status(403).json({ error: 'Forbidden. You can only add notes to your own incidents.' });
      }

      // Build author info
      const authorName = req.user.first_name && req.user.last_name
        ? `${req.user.first_name} ${req.user.last_name}`.trim()
        : (req.user.email || req.user.username || 'Dispatcher');

      // Determine department for the note
      let noteDepartment = 'Operations';
      if (deptRole && req.user.user_id) {
        const fullUser = await User.findById(req.user.user_id);
        if (fullUser && fullUser.department_id) {
          const dept = await Department.findById(fullUser.department_id);
          if (dept && dept.name) {
            noteDepartment = dept.name;
          }
        }
      } else {
        // Try to get from incident's assigned department
        noteDepartment = incident.assigned_department || incident.assignedDepartment || 'Operations';
      }

      const createdNote = await IncidentCoordinationNote.create({
        report_id: validatedId,
        user_id: req.user.user_id,
        author_name: authorName,
        author_role: req.user.role || 'dispatcher',
        department: noteDepartment,
        note: trimmedNote,
        source: 'Dispatcher UI',
      });

      // Log the action for audit trail
      await logIncidentAction(req, 'add_coordination_note', validatedId, {
        note_id: createdNote.id,
        author: authorName,
        role: req.user.role,
      });

      // Return formatted note for frontend compatibility
      const formattedNote = {
        id: createdNote.id,
        report_id: createdNote.report_id,
        user_id: createdNote.user_id,
        author: createdNote.author_name,
        role: createdNote.author_role,
        department: createdNote.department,
        note: createdNote.note,
        source: createdNote.source,
        timestamp: new Date(createdNote.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }),
        created_at: createdNote.created_at,
      };

      res.status(201).json(formattedNote);
    } catch (error) {
      console.error('Error adding coordination note:', error);
      if (error.message.includes('must be') || error.message.includes('must not')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
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
              const incidentDispatches = await getDispatchesForReport(validatedId, 50);
              await attachAssignedDepartment(incident, validatedId, incidentDispatches);
              await ensureIncidentBarangay(incident);
              await attachDispatchEta(incident, validatedId, incidentDispatches);
              await buildIncidentTimeline(incident, validatedId, incidentDispatches);
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
      const incidentDispatches = await getDispatchesForReport(validatedId, 50);
      await attachAssignedDepartment(incident, validatedId, incidentDispatches);
      await ensureIncidentBarangay(incident);
      await attachDispatchEta(incident, validatedId, incidentDispatches);
      await buildIncidentTimeline(incident, validatedId, incidentDispatches);
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
