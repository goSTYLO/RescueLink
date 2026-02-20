const Dispatch = require('../models/dispatch');
const { validateInteger, validateOptionalString, validatePagination } = require('../utils/validation');
const { logDispatcherAction } = require('../utils/auditLog');

const dispatchController = {
  // Create new dispatch
  async create(req, res) {
    try {
      const { report_id, responder_id, response_status, force_unverified = false } = req.body;

      // Validate required fields
      if (!report_id || !responder_id) {
        return res.status(400).json({ error: 'report_id and responder_id are required' });
      }

      // Validate and sanitize inputs
      const validatedReportId = validateInteger(report_id, 'report_id');
      const validatedResponderId = validateInteger(responder_id, 'responder_id');
      const validatedResponseStatus = validateOptionalString(response_status, 'response_status', 50);

      // Check if report exists
      const reportExists = await Dispatch.reportExists(validatedReportId);
      if (!reportExists) {
        return res.status(404).json({ error: 'Incident report not found' });
      }

      // Enforce manual verification before assignment unless explicitly overridden
      const incidentMeta = await Dispatch.getIncidentVerification(validatedReportId);
      const isVerified = incidentMeta?.verified === true || incidentMeta?.status === 'verified';
      if (!isVerified && force_unverified !== true) {
        return res.status(409).json({
          error: 'Incident is not verified yet. Verify first or confirm override to continue assignment.',
          code: 'INCIDENT_NOT_VERIFIED',
          requires_confirmation: true,
          report_id: validatedReportId
        });
      }

      // Check if responder exists
      const responderExists = await Dispatch.responderExists(validatedResponderId);
      if (!responderExists) {
        return res.status(404).json({ error: 'Responder not found' });
      }

      const dispatch = await Dispatch.create({
        report_id: validatedReportId,
        responder_id: validatedResponderId,
        response_status: validatedResponseStatus
      });

      await logDispatcherAction(req, 'dispatch_create', 'dispatch', dispatch.dispatch_id, {
        report_id: validatedReportId,
        responder_id: validatedResponderId,
        response_status: validatedResponseStatus,
        forced_unverified_assignment: !isVerified && force_unverified === true
      });
      res.status(201).json({
        ...dispatch,
        warning: !isVerified && force_unverified === true
          ? 'Dispatch was created for an unverified incident after manual confirmation.'
          : undefined
      });
    } catch (error) {
      console.error('Error creating dispatch:', error);
      if (error.message.includes('must be') || error.message.includes('must not')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Get dispatch by ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const validatedId = validateInteger(id, 'dispatch ID');
      
      const dispatch = await Dispatch.findById(validatedId);

      if (!dispatch) {
        return res.status(404).json({ error: 'Dispatch not found' });
      }

      res.json(dispatch);
    } catch (error) {
      console.error('Error fetching dispatch:', error);
      if (error.message.includes('must be')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Get all dispatches with pagination and filters
  async getAll(req, res) {
    try {
      const {
        limit,
        offset,
        report_id,
        responder_id,
        response_status
      } = req.query;

      // Validate pagination
      const { limit: validatedLimit, offset: validatedOffset } = validatePagination(limit, offset);
      
      // Validate optional filters
      const validatedReportId = report_id ? validateInteger(report_id, 'report_id') : null;
      const validatedResponderId = responder_id ? validateInteger(responder_id, 'responder_id') : null;
      const validatedResponseStatus = response_status ? validateOptionalString(response_status, 'response_status', 50) : null;

      const dispatches = await Dispatch.findAll({
        limit: validatedLimit,
        offset: validatedOffset,
        report_id: validatedReportId,
        responder_id: validatedResponderId,
        response_status: validatedResponseStatus
      });

      res.json(dispatches);
    } catch (error) {
      console.error('Error fetching dispatches:', error);
      if (error.message.includes('must be')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Update dispatch (full update required)
  async update(req, res) {
    try {
      const { id } = req.params;
      const { report_id, responder_id, response_status } = req.body;

      // Validate ID
      const validatedId = validateInteger(id, 'dispatch ID');

      // Validate required fields for full update
      if (!report_id || !responder_id || response_status === undefined) {
        return res.status(400).json({ 
          error: 'Full update required: report_id, responder_id, and response_status must be provided' 
        });
      }

      // Validate and sanitize inputs
      const validatedReportId = validateInteger(report_id, 'report_id');
      const validatedResponderId = validateInteger(responder_id, 'responder_id');
      const validatedResponseStatus = validateOptionalString(response_status, 'response_status', 50);

      // Check if dispatch exists
      const existing = await Dispatch.findById(validatedId);
      if (!existing) {
        return res.status(404).json({ error: 'Dispatch not found' });
      }

      // Check if report exists
      const reportExists = await Dispatch.reportExists(validatedReportId);
      if (!reportExists) {
        return res.status(404).json({ error: 'Incident report not found' });
      }

      // Check if responder exists
      const responderExists = await Dispatch.responderExists(validatedResponderId);
      if (!responderExists) {
        return res.status(404).json({ error: 'Responder not found' });
      }

      const updated = await Dispatch.update(validatedId, {
        report_id: validatedReportId,
        responder_id: validatedResponderId,
        response_status: validatedResponseStatus
      });

      await logDispatcherAction(req, 'dispatch_update', 'dispatch', validatedId, {
        report_id: validatedReportId,
        responder_id: validatedResponderId,
        response_status: validatedResponseStatus
      });
      res.json(updated);
    } catch (error) {
      console.error('Error updating dispatch:', error);
      if (error.message.includes('must be') || error.message.includes('must not')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Delete dispatch
  async delete(req, res) {
    try {
      const { id } = req.params;
      const validatedId = validateInteger(id, 'dispatch ID');

      const deleted = await Dispatch.delete(validatedId);

      if (!deleted) {
        return res.status(404).json({ error: 'Dispatch not found' });
      }

      await logDispatcherAction(req, 'dispatch_delete', 'dispatch', validatedId, {
        report_id: deleted.report_id,
        responder_id: deleted.responder_id
      });
      res.json({ message: 'Dispatch deleted successfully', dispatch: deleted });
    } catch (error) {
      console.error('Error deleting dispatch:', error);
      if (error.message.includes('must be')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

module.exports = dispatchController;
