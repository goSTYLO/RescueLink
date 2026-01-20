const Dispatch = require('../models/dispatch');

const dispatchController = {
  // Create new dispatch
  async create(req, res) {
    try {
      const { report_id, responder_id, response_status } = req.body;

      // Validate required fields
      if (!report_id || !responder_id) {
        return res.status(400).json({ error: 'report_id and responder_id are required' });
      }

      // Check if report exists
      const reportExists = await Dispatch.reportExists(report_id);
      if (!reportExists) {
        return res.status(404).json({ error: 'Incident report not found' });
      }

      // Check if responder exists
      const responderExists = await Dispatch.responderExists(responder_id);
      if (!responderExists) {
        return res.status(404).json({ error: 'Responder not found' });
      }

      const dispatch = await Dispatch.create({
        report_id,
        responder_id,
        response_status
      });

      res.status(201).json(dispatch);
    } catch (error) {
      console.error('Error creating dispatch:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Get dispatch by ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const dispatch = await Dispatch.findById(id);

      if (!dispatch) {
        return res.status(404).json({ error: 'Dispatch not found' });
      }

      res.json(dispatch);
    } catch (error) {
      console.error('Error fetching dispatch:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Get all dispatches with pagination and filters
  async getAll(req, res) {
    try {
      const {
        limit = 20,
        offset = 0,
        report_id,
        responder_id,
        response_status
      } = req.query;

      const dispatches = await Dispatch.findAll({
        limit: parseInt(limit),
        offset: parseInt(offset),
        report_id: report_id ? parseInt(report_id) : null,
        responder_id: responder_id ? parseInt(responder_id) : null,
        response_status
      });

      res.json(dispatches);
    } catch (error) {
      console.error('Error fetching dispatches:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Update dispatch (full update required)
  async update(req, res) {
    try {
      const { id } = req.params;
      const { report_id, responder_id, response_status } = req.body;

      // Validate required fields for full update
      if (!report_id || !responder_id || response_status === undefined) {
        return res.status(400).json({ 
          error: 'Full update required: report_id, responder_id, and response_status must be provided' 
        });
      }

      // Check if dispatch exists
      const existing = await Dispatch.findById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Dispatch not found' });
      }

      // Check if report exists
      const reportExists = await Dispatch.reportExists(report_id);
      if (!reportExists) {
        return res.status(404).json({ error: 'Incident report not found' });
      }

      // Check if responder exists
      const responderExists = await Dispatch.responderExists(responder_id);
      if (!responderExists) {
        return res.status(404).json({ error: 'Responder not found' });
      }

      const updated = await Dispatch.update(id, {
        report_id,
        responder_id,
        response_status
      });

      res.json(updated);
    } catch (error) {
      console.error('Error updating dispatch:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Delete dispatch
  async delete(req, res) {
    try {
      const { id } = req.params;

      const deleted = await Dispatch.delete(id);

      if (!deleted) {
        return res.status(404).json({ error: 'Dispatch not found' });
      }

      res.json({ message: 'Dispatch deleted successfully', dispatch: deleted });
    } catch (error) {
      console.error('Error deleting dispatch:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

module.exports = dispatchController;
