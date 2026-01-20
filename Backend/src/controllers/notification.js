const Notification = require('../models/notification');

const notificationController = {
  // Create new notification
  async create(req, res) {
    try {
      const { user_id, report_id, message, sent_via } = req.body;

      // Validate required fields
      if (!user_id || !message) {
        return res.status(400).json({ error: 'user_id and message are required' });
      }

      // Check if user exists
      const userExists = await Notification.userExists(user_id);
      if (!userExists) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if report exists (if provided)
      if (report_id) {
        const reportExists = await Notification.reportExists(report_id);
        if (!reportExists) {
          return res.status(404).json({ error: 'Incident report not found' });
        }
      }

      const notification = await Notification.create({
        user_id,
        report_id,
        message,
        sent_via
      });

      res.status(201).json(notification);
    } catch (error) {
      console.error('Error creating notification:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Get notification by ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const notification = await Notification.findById(id);

      if (!notification) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      res.json(notification);
    } catch (error) {
      console.error('Error fetching notification:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Get all notifications with pagination and filters
  async getAll(req, res) {
    try {
      const {
        limit = 20,
        offset = 0,
        user_id,
        report_id,
        sent_via
      } = req.query;

      const notifications = await Notification.findAll({
        limit: parseInt(limit),
        offset: parseInt(offset),
        user_id: user_id ? parseInt(user_id) : null,
        report_id: report_id ? parseInt(report_id) : null,
        sent_via
      });

      res.json(notifications);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Update notification (full update required)
  async update(req, res) {
    try {
      const { id } = req.params;
      const { user_id, report_id, message, sent_via } = req.body;

      // Validate required fields for full update
      if (!user_id || !message || report_id === undefined || sent_via === undefined) {
        return res.status(400).json({ 
          error: 'Full update required: user_id, report_id, message, and sent_via must be provided' 
        });
      }

      // Check if notification exists
      const existing = await Notification.findById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      // Check if user exists
      const userExists = await Notification.userExists(user_id);
      if (!userExists) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if report exists (if provided)
      if (report_id) {
        const reportExists = await Notification.reportExists(report_id);
        if (!reportExists) {
          return res.status(404).json({ error: 'Incident report not found' });
        }
      }

      const updated = await Notification.update(id, {
        user_id,
        report_id,
        message,
        sent_via
      });

      res.json(updated);
    } catch (error) {
      console.error('Error updating notification:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  // Delete notification
  async delete(req, res) {
    try {
      const { id } = req.params;

      const deleted = await Notification.delete(id);

      if (!deleted) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      res.json({ message: 'Notification deleted successfully', notification: deleted });
    } catch (error) {
      console.error('Error deleting notification:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

module.exports = notificationController;
