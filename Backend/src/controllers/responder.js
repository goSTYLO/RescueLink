const Responder = require('../models/responder');

const responderController = {
  // Create new responder
  async create(req, res) {
    try {
      const { name, organization, contact_number, availability_status } = req.body;

      // Validate required fields
      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const responder = await Responder.create({
        name,
        organization,
        contact_number,
        availability_status
      });

      res.status(201).json(responder);
    } catch (error) {
      console.error('Error creating responder:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Get responder by ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const responder = await Responder.findById(id);

      if (!responder) {
        return res.status(404).json({ error: 'Responder not found' });
      }

      res.json(responder);
    } catch (error) {
      console.error('Error fetching responder:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Get all responders with pagination and filters
  async getAll(req, res) {
    try {
      const {
        limit = 20,
        offset = 0,
        organization,
        availability_status
      } = req.query;

      const responders = await Responder.findAll({
        limit: parseInt(limit),
        offset: parseInt(offset),
        organization,
        availability_status
      });

      res.json(responders);
    } catch (error) {
      console.error('Error fetching responders:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Update responder (full update required)
  async update(req, res) {
    try {
      const { id } = req.params;
      const { name, organization, contact_number, availability_status } = req.body;

      // Validate required fields for full update
      if (!name || organization === undefined || contact_number === undefined || availability_status === undefined) {
        return res.status(400).json({ 
          error: 'Full update required: name, organization, contact_number, and availability_status must be provided' 
        });
      }

      // Check if responder exists
      const existing = await Responder.findById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Responder not found' });
      }

      const updated = await Responder.update(id, {
        name,
        organization,
        contact_number,
        availability_status
      });

      res.json(updated);
    } catch (error) {
      console.error('Error updating responder:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Delete responder
  async delete(req, res) {
    try {
      const { id } = req.params;

      const deleted = await Responder.delete(id);

      if (!deleted) {
        return res.status(404).json({ error: 'Responder not found' });
      }

      res.json({ message: 'Responder deleted successfully', responder: deleted });
    } catch (error) {
      console.error('Error deleting responder:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

module.exports = responderController;
