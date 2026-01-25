const Incident = require('../models/incident');
const { validateLatitude, validateLongitude, validateInteger, validatePagination, validateOptionalString } = require('../utils/validation');

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
  }
};

module.exports = incidentController;
