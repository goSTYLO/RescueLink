const Notification = require('../models/notification');
const { validateInteger, validateString, validateOptionalString, validatePagination } = require('../utils/validation');
const { ROLES } = require('../config/roles');

const notificationController = {
  // Create new notification
  async create(req, res) {
    try {
      const { user_id, report_id, message, sent_via } = req.body;

      // Validate required fields
      if (!user_id || !message) {
        return res.status(400).json({ error: 'user_id and message are required' });
      }

      // Validate and sanitize inputs
      const validatedUserId = validateInteger(user_id, 'user_id');
      const validatedReportId = report_id ? validateInteger(report_id, 'report_id') : null;
      const validatedMessage = validateString(message, 'message', 1, 500);
      const validatedSentVia = validateOptionalString(sent_via, 'sent_via', 50);

      // Check if user exists
      const userExists = await Notification.userExists(validatedUserId);
      if (!userExists) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if report exists (if provided)
      if (validatedReportId) {
        const reportExists = await Notification.reportExists(validatedReportId);
        if (!reportExists) {
          return res.status(404).json({ error: 'Incident report not found' });
        }
      }

      const notification = await Notification.create({
        user_id: validatedUserId,
        report_id: validatedReportId,
        message: validatedMessage,
        sent_via: validatedSentVia
      });

      res.status(201).json(notification);
    } catch (error) {
      console.error('Error creating notification:', error);
      if (error.message.includes('must be') || error.message.includes('must not')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Get notification by ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const validatedId = validateInteger(id, 'notification ID');
      
      const notification = await Notification.findById(validatedId);

      if (!notification) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      const isUserRole = String(req.user?.role || '').toLowerCase() === ROLES.USER;
      if (isUserRole && notification.user_id !== req.user.user_id) {
        return res.status(403).json({ error: 'Forbidden. You can only access your own notifications.' });
      }

      res.json(notification);
    } catch (error) {
      console.error('Error fetching notification:', error);
      if (error.message.includes('must be')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Get all notifications with pagination and filters
  async getAll(req, res) {
    try {
      const {
        limit,
        offset,
        user_id,
        report_id,
        sent_via
      } = req.query;

      // Validate pagination
      const { limit: validatedLimit, offset: validatedOffset } = validatePagination(limit, offset);
      
      // Validate optional filters
      let validatedUserId = user_id ? validateInteger(user_id, 'user_id') : null;
      const validatedReportId = report_id ? validateInteger(report_id, 'report_id') : null;
      const validatedSentVia = sent_via ? validateString(sent_via, 'sent_via', 1, 50) : null;

      const isUserRole = String(req.user?.role || '').toLowerCase() === ROLES.USER;
      if (isUserRole) {
        validatedUserId = req.user.user_id;
      }

      const notifications = await Notification.findAll({
        limit: validatedLimit,
        offset: validatedOffset,
        user_id: validatedUserId,
        report_id: validatedReportId,
        sent_via: validatedSentVia
      });

      res.json(notifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      if (error.message.includes('must be')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Update notification (full update required)
  async update(req, res) {
    try {
      const { id } = req.params;
      const { user_id, report_id, message, sent_via } = req.body;

      // Validate ID
      const validatedId = validateInteger(id, 'notification ID');

      // Validate required fields for full update
      if (!user_id || !message || report_id === undefined || sent_via === undefined) {
        return res.status(400).json({ 
          error: 'Full update required: user_id, report_id, message, and sent_via must be provided' 
        });
      }

      // Validate and sanitize inputs
      const validatedUserId = validateInteger(user_id, 'user_id');
      const validatedReportId = report_id ? validateInteger(report_id, 'report_id') : null;
      const validatedMessage = validateString(message, 'message', 1, 500);
      const validatedSentVia = validateOptionalString(sent_via, 'sent_via', 50);

      // Check if notification exists
      const existing = await Notification.findById(validatedId);
      if (!existing) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      // Check if user exists
      const userExists = await Notification.userExists(validatedUserId);
      if (!userExists) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if report exists (if provided)
      if (validatedReportId) {
        const reportExists = await Notification.reportExists(validatedReportId);
        if (!reportExists) {
          return res.status(404).json({ error: 'Incident report not found' });
        }
      }

      const updated = await Notification.update(validatedId, {
        user_id: validatedUserId,
        report_id: validatedReportId,
        message: validatedMessage,
        sent_via: validatedSentVia
      });

      res.json(updated);
    } catch (error) {
      console.error('Error updating notification:', error);
      if (error.message.includes('must be') || error.message.includes('must not')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Delete notification
  async delete(req, res) {
    try {
      const { id } = req.params;
      const validatedId = validateInteger(id, 'notification ID');

      const deleted = await Notification.delete(validatedId);

      if (!deleted) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      res.json({ message: 'Notification deleted successfully', notification: deleted });
    } catch (error) {
      console.error('Error deleting notification:', error);
      if (error.message.includes('must be')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

module.exports = notificationController;
