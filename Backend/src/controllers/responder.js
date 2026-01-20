const Responder = require('../models/responder');
const { validateInteger, validateString, validateOptionalString, validatePagination } = require('../utils/validation');

const responderController = {
  // Create new responder
  async create(req, res) {
    try {
      const { name, organization, contact_number, availability_status } = req.body;

      // Validate required fields
      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }

      // Validate and sanitize inputs
      const validatedName = validateString(name, 'name', 1, 150);
      const validatedOrganization = validateOptionalString(organization, 'organization', 150);
      const validatedContactNumber = validateOptionalString(contact_number, 'contact_number', 20);
      const validatedAvailabilityStatus = validateOptionalString(availability_status, 'availability_status', 50);

      const responder = await Responder.create({
        name: validatedName,
        organization: validatedOrganization,
        contact_number: validatedContactNumber,
        availability_status: validatedAvailabilityStatus
      });

      res.status(201).json(responder);
    } catch (error) {
      console.error('Error creating responder:', error);
      if (error.message.includes('must be') || error.message.includes('must not')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Get responder by ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const validatedId = validateInteger(id, 'responder ID');
      
      const responder = await Responder.findById(validatedId);

      if (!responder) {
        return res.status(404).json({ error: 'Responder not found' });
      }

      res.json(responder);
    } catch (error) {
      console.error('Error fetching responder:', error);
      if (error.message.includes('must be')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Get all responders with pagination and filters
  async getAll(req, res) {
    try {
      const {
        limit,
        offset,
        organization,
        availability_status
      } = req.query;

      // Validate pagination
      const { limit: validatedLimit, offset: validatedOffset } = validatePagination(limit, offset);
      
      // Validate optional filters
      const validatedOrganization = organization ? validateString(organization, 'organization', 1, 150) : null;
      const validatedAvailabilityStatus = availability_status ? validateString(availability_status, 'availability_status', 1, 50) : null;

      const responders = await Responder.findAll({
        limit: validatedLimit,
        offset: validatedOffset,
        organization: validatedOrganization,
        availability_status: validatedAvailabilityStatus
      });

      res.json(responders);
    } catch (error) {
      console.error('Error fetching responders:', error);
      if (error.message.includes('must be')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Update responder (full update required)
  async update(req, res) {
    try {
      const { id } = req.params;
      const { name, organization, contact_number, availability_status } = req.body;

      // Validate ID
      const validatedId = validateInteger(id, 'responder ID');

      // Validate required fields for full update
      if (!name || organization === undefined || contact_number === undefined || availability_status === undefined) {
        return res.status(400).json({ 
          error: 'Full update required: name, organization, contact_number, and availability_status must be provided' 
        });
      }

      // Validate and sanitize inputs
      const validatedName = validateString(name, 'name', 1, 150);
      const validatedOrganization = validateOptionalString(organization, 'organization', 150);
      const validatedContactNumber = validateOptionalString(contact_number, 'contact_number', 20);
      const validatedAvailabilityStatus = validateOptionalString(availability_status, 'availability_status', 50);

      // Check if responder exists
      const existing = await Responder.findById(validatedId);
      if (!existing) {
        return res.status(404).json({ error: 'Responder not found' });
      }

      const updated = await Responder.update(validatedId, {
        name: validatedName,
        organization: validatedOrganization,
        contact_number: validatedContactNumber,
        availability_status: validatedAvailabilityStatus
      });

      res.json(updated);
    } catch (error) {
      console.error('Error updating responder:', error);
      if (error.message.includes('must be') || error.message.includes('must not')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Delete responder
  async delete(req, res) {
    try {
      const { id } = req.params;
      const validatedId = validateInteger(id, 'responder ID');

      const deleted = await Responder.delete(validatedId);

      if (!deleted) {
        return res.status(404).json({ error: 'Responder not found' });
      }

      res.json({ message: 'Responder deleted successfully', responder: deleted });
    } catch (error) {
      console.error('Error deleting responder:', error);
      if (error.message.includes('must be')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

module.exports = responderController;
