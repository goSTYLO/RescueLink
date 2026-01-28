const Incident = require('../models/incident');
const pool = require('../config/db');
const { validateLatitude, validateLongitude, validateInteger, validatePagination, validateOptionalString } = require('../utils/validation');
const { processIncidentWithAudio } = require('../services/aiService');
const { saveAudioFile, saveMediaFiles, deleteIncidentFiles, fileExists, getAbsolutePath } = require('../utils/fileValidation');
const path = require('path');
const fs = require('fs').promises;

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

      // Create emergency incident with high severity
      const incident = await Incident.create({
        user_id: user_id,
        incident_type: null, // No type for emergency reports
        severity_level: 'high', // Automatically set to high priority
        description: null,
        latitude: validatedLat,
        longitude: validatedLng,
        media_url: null,
        status: 'pending'
      });

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
      const { limit, offset, severity_level, status } = req.query;
      const { limit: validatedLimit, offset: validatedOffset } = validatePagination(limit, offset);

      const incidents = await Incident.findAll({
        limit: validatedLimit,
        offset: validatedOffset,
        severity_level: severity_level || null,
        status: status || null
      });

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

      const { limit, offset } = req.query;
      const { limit: validatedLimit, offset: validatedOffset } = validatePagination(limit, offset);

      const incidents = await Incident.findByUserId(user_id, {
        limit: validatedLimit,
        offset: validatedOffset
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

      // Check if audio file is provided
      const audioFile = req.files?.audio?.[0];
      if (!audioFile) {
        return res.status(400).json({ error: 'Audio file is required' });
      }

      // Get media files if provided
      const mediaFiles = req.files?.media || [];

      console.log(`📝 Creating incident with audio for user ${user_id}`);
      console.log(`   - Audio: ${audioFile.originalname} (${audioFile.size} bytes)`);
      console.log(`   - Media files: ${mediaFiles.length}`);

      // Create initial incident record (without AI classification)
      const incident = await Incident.createWithAi({
        user_id,
        incident_type: null, // Will be filled by AI
        severity_level: 'medium', // Temporary, will be updated by AI
        description: description || null,
        latitude: validatedLat,
        longitude: validatedLng,
        transcription: null, // Will be filled by AI
        audio_path: null, // Will be updated after file save
        media_paths: [],
        ai_pending: true, // Mark as pending AI processing
        ai_attempted: false,
        status: 'pending'
      });

      const reportId = incident.report_id;
      let audioPath = null;
      let mediaPaths = [];

      try {
        // Save audio file to disk
        audioPath = await saveAudioFile(audioFile, reportId);
        console.log(`💾 Audio saved: ${audioPath}`);

        // Save media files to disk
        if (mediaFiles.length > 0) {
          mediaPaths = await saveMediaFiles(mediaFiles, reportId);
          console.log(`💾 Media saved: ${mediaPaths.length} files`);
        }

        // Process with AI
        console.log('🤖 Starting AI classification...');
        const aiResult = await processIncidentWithAudio(
          audioFile.buffer,
          audioFile.originalname,
          description
        );

        // Update incident with AI results
        const updatedIncident = await Incident.updateWithAiResults(reportId, {
          incident_type: aiResult.primaryType,
          severity_level: aiResult.severity,
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

        console.log(`✅ Incident ${reportId} created successfully with AI classification`);

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
            severity: aiResult.severity,
            confidence: aiResult.maxConfidence,
            low_confidence_flag: aiResult.lowConfidenceFlag,
            transcription: aiResult.transcription
          }
        });

      } catch (aiError) {
        console.error('❌ AI processing failed:', aiError.message);

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

        console.log(`⏳ Incident ${reportId} created, AI classification pending retry`);

        res.status(201).json({
          success: true,
          message: 'Incident reported successfully, AI classification pending',
          incident: {
            ...incident,
            audio_path: audioPath,
            media_paths: mediaPaths
          },
          ai_status: 'pending',
          ai_error: 'AI classification will be retried automatically'
        });
      }

    } catch (error) {
      console.error('Error creating incident with audio:', error);
      if (error.message.includes('must be') || error.message.includes('required')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to create incident' });
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

  // Get incident with AI classification
  async getByIdWithAi(req, res) {
    try {
      const { id } = req.params;
      const validatedId = validateInteger(id, 'report_id');

      const incident = await Incident.findById(validatedId);
      if (!incident) {
        return res.status(404).json({ error: 'Incident not found' });
      }

      // Get AI classification if exists
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
