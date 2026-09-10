const path = require('path');
const fs = require('fs').promises;
const ResponderApplication = require('../models/responderApplication');
const User = require('../models/user');
const Responder = require('../models/responder');
const Notification = require('../models/notification');
const pool = require('../config/db');
const { logDispatcherAction, logAdminAction } = require('../utils/auditLog');
const { comparePassword } = require('../utils/hash');
const {
  REVOKE_REASONS,
  VALID_REVOKE_REASON_CODES,
  formatRevokeNotes,
} = require('../constants/responderRevokeReasons');
const { validateInteger, validatePagination } = require('../utils/validation');

const UPLOAD_BASE_DIR = path.join(process.cwd(), 'uploads', 'responder-applications');

function emitApplicationEvent(req, event, payload) {
  try {
    const wss = req.app?.locals?.wss;
    if (wss && typeof wss.broadcast === 'function') {
      wss.broadcast(event, payload).catch(() => {});
    }
  } catch (err) {
    console.warn('[emitApplicationEvent] WebSocket broadcast notice:', err.message);
  }
}

/**
 * Save in-memory file buffer to local disk safely
 */
async function saveFileToDisk(userId, file) {
  const userDir = path.join(UPLOAD_BASE_DIR, String(userId));
  await fs.mkdir(userDir, { recursive: true });

  const ext = path.extname(file.originalname || file.filename || '').toLowerCase() || '.bin';
  const safeBaseName = path.basename(file.originalname || 'file', ext).replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${Date.now()}_${safeBaseName}${ext}`;
  const filePath = path.join(userDir, filename);

  await fs.writeFile(filePath, file.buffer);
  return path.join('uploads', 'responder-applications', String(userId), filename).replace(/\\/g, '/');
}

const responderApplicationController = {
  /**
   * POST /api/responder-applications
   * Submit volunteer responder application with documents
   */
  async submitApplication(req, res) {
    try {
      const userId = req.user.user_id;

      // Check if user already has an active application
      const existing = await ResponderApplication.findByUserId(userId);
      if (existing && (existing.status === 'pending' || existing.status === 'approved')) {
        return res.status(409).json({
          error: `You already have an active application with status '${existing.status}'.`,
          application: existing,
        });
      }

      // Parse specialization fields & validate
      let specializationFields = [];
      if (req.body.specialization_fields) {
        try {
          specializationFields = typeof req.body.specialization_fields === 'string'
            ? JSON.parse(req.body.specialization_fields)
            : req.body.specialization_fields;
        } catch {
          specializationFields = [];
        }
      }
      if (!Array.isArray(specializationFields)) specializationFields = [];
      const validSpecializations = ['fire', 'medical', 'police', 'disaster'];
      specializationFields = specializationFields
        .map((s) => String(s).toLowerCase().trim())
        .filter((s) => validSpecializations.includes(s));

      if (specializationFields.length === 0) {
        return res.status(400).json({ error: 'Please select at least one specialization field (Fire, Medical, Police, Disaster).' });
      }

      if (!req.files?.gov_id?.[0]) {
        return res.status(400).json({ error: 'Government ID upload is required.' });
      }

      // Check per-field proof files
      const fieldProofPaths = {};
      for (const field of specializationFields) {
        const fileKey = `proof_${field}`;
        if (!req.files || !req.files[fileKey] || req.files[fileKey].length === 0) {
          if (req.files && req.files.certificates && req.files.certificates.length > 0) {
            // Fallback for legacy general certificate uploads
          } else {
            return res.status(400).json({ error: `Proof of qualification is required for field '${field}'.` });
          }
        } else {
          const savedPath = await saveFileToDisk(userId, req.files[fileKey][0]);
          fieldProofPaths[field] = savedPath;
        }
      }

      // Save Government ID
      const govIdPath = await saveFileToDisk(userId, req.files.gov_id[0]);

      // Save Certificates (legacy fallback)
      const certificatePaths = [];
      if (req.files.certificates && req.files.certificates.length > 0) {
        for (const file of req.files.certificates) {
          const savedPath = await saveFileToDisk(userId, file);
          certificatePaths.push(savedPath);
        }
      }

      // Save Other Documents
      const otherDocPaths = [];
      if (req.files.other_docs && req.files.other_docs.length > 0) {
        for (const file of req.files.other_docs) {
          const savedPath = await saveFileToDisk(userId, file);
          otherDocPaths.push(savedPath);
        }
      }

      // Parse personal details
      let personalDetails = {};
      if (req.body.personal_details) {
        try {
          personalDetails = typeof req.body.personal_details === 'string'
            ? JSON.parse(req.body.personal_details)
            : req.body.personal_details;
        } catch {
          personalDetails = {};
        }
      } else {
        // Fallback to top-level body parameters if sent individually
        personalDetails = {
          full_name: req.body.full_name || `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim(),
          phone_number: req.body.phone_number || req.user.phone_number,
          email: req.body.email || req.user.email,
          address: req.body.address || req.user.address,
          emergency_contact_name: req.body.emergency_contact_name || '',
          emergency_contact_phone: req.body.emergency_contact_phone || '',
          emergency_contact_relationship: req.body.emergency_contact_relationship || '',
        };
      }

      const application = await ResponderApplication.create({
        user_id: userId,
        gov_id_path: govIdPath,
        certificate_paths: certificatePaths,
        other_doc_paths: otherDocPaths,
        personal_details: personalDetails,
        specialization_fields: specializationFields,
        field_proof_paths: fieldProofPaths,
      });

      // Emit WebSocket event for real-time dispatcher dashboard update
      emitApplicationEvent(req, 'application:submitted', {
        id: application.id,
        user_id: userId,
        submitted_at: application.submitted_at,
      });

      res.status(201).json({
        message: 'Responder application submitted successfully.',
        application,
      });
    } catch (error) {
      console.error('Error submitting responder application:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * GET /api/responder-applications/me
   * Get current authenticated user's application
   */
  async getMyApplication(req, res) {
    try {
      const application = await ResponderApplication.findByUserId(req.user.user_id);
      if (!application) {
        return res.json({ hasApplication: false, application: null });
      }
      res.json({ hasApplication: true, application });
    } catch (error) {
      console.error('Error fetching own application:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * GET /api/responder-applications
   * List all responder applications for Dispatcher/Admin
   */
  async listApplications(req, res) {
    try {
      const { status, limit, offset } = req.query;
      const { limit: validatedLimit, offset: validatedOffset } = validatePagination(limit, offset);
      const validStatuses = ['pending', 'approved', 'rejected', 'revoked'];
      const filteredStatus = status && validStatuses.includes(status.toLowerCase()) ? status.toLowerCase() : null;

      const result = await ResponderApplication.findAll({
        status: filteredStatus,
        limit: validatedLimit,
        offset: validatedOffset,
      });

      res.setHeader('x-total-count', result.total);
      res.json(result);
    } catch (error) {
      console.error('Error listing responder applications:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * GET /api/responder-applications/:id
   * View application details
   */
  async getApplicationById(req, res) {
    try {
      const appId = validateInteger(req.params.id, 'application ID');
      const application = await ResponderApplication.findById(appId);

      if (!application) {
        return res.status(404).json({ error: 'Application not found.' });
      }

      // Ensure user is authorized (dispatcher, admin, or applicant)
      const userRole = (req.user.role || '').toLowerCase();
      const isStaff = ['admin', 'super-admin', 'dispatcher', 'department-admin', 'supervisor'].includes(userRole);
      if (!isStaff && application.user_id !== req.user.user_id) {
        return res.status(403).json({ error: 'Forbidden. You cannot view this application.' });
      }

      res.json(application);
    } catch (error) {
      console.error('Error fetching application details:', error);
      if (error.message.includes('must be')) return res.status(400).json({ error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * PATCH /api/responder-applications/:id/status
   * Dispatcher approves or rejects an application
   */
  async updateApplicationStatus(req, res) {
    try {
      const appId = validateInteger(req.params.id, 'application ID');
      const { status, notes } = req.body;

      if (!status || !['approved', 'rejected'].includes(status.toLowerCase())) {
        return res.status(400).json({ error: "Status must be 'approved' or 'rejected'." });
      }

      const normalizedStatus = status.toLowerCase();
      const application = await ResponderApplication.findById(appId);

      if (!application) {
        return res.status(404).json({ error: 'Application not found.' });
      }

      const updated = await ResponderApplication.updateStatus(appId, {
        status: normalizedStatus,
        notes: notes || null,
        reviewed_by: req.user.user_id,
      });

      // If approved: Promote user to volunteer first-responder and add to volunteer pool
      if (normalizedStatus === 'approved') {
        await pool.query("UPDATE users SET role = 'volunteer' WHERE user_id = $1", [application.user_id]);

        // Add to responders table pool if not present
        const applicantUser = await User.findById(application.user_id);
        const fullName = applicantUser
          ? `${applicantUser.first_name || ''} ${applicantUser.last_name || ''}`.trim()
          : (application.personal_details?.full_name || `Volunteer ${application.user_id}`);

        const appSpecFields = Array.isArray(application.specialization_fields) && application.specialization_fields.length > 0
          ? application.specialization_fields
          : ['fire', 'medical', 'police', 'disaster'];

        try {
          await Responder.create({
            name: fullName || `Responder ${application.user_id}`,
            organization: 'Volunteer First Responder Pool',
            contact_number: applicantUser?.phone_number || application.personal_details?.phone_number || null,
            availability_status: 'Available',
            source_type: 'account',
            team_name: 'Volunteer Responders',
            supported_incident_types: appSpecFields,
            user_id: application.user_id,
          });
        } catch (responderErr) {
          console.warn('Responder creation warning (may already exist):', responderErr.message);
        }
      }

      // Create notification for the applicant
      const notifyMessage = normalizedStatus === 'approved'
        ? 'Your volunteer first responder application was approved. Responder features are now available.'
        : `Your volunteer first responder application was not approved.${notes ? ` Reason: ${notes}` : ''}`;

      await Notification.create({
        user_id: application.user_id,
        report_id: null,
        message: notifyMessage,
        sent_via: 'websocket',
        event_type: `application_${normalizedStatus}`,
      });

      // Audit log dispatcher action
      await logDispatcherAction(req, `responder_application_${normalizedStatus}`, 'responder_application', appId, {
        applicant_user_id: application.user_id,
        notes: notes || null,
      });

      // Emit WebSocket event
      emitApplicationEvent(req, 'application:status_changed', {
        id: appId,
        user_id: application.user_id,
        status: normalizedStatus,
        notes: notes || null,
      });

      res.json({
        message: `Application ${normalizedStatus} successfully.`,
        application: updated,
      });
    } catch (error) {
      console.error('Error updating application status:', error);
      if (error.message.includes('must be')) return res.status(400).json({ error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * POST /api/responder-applications/:id/revoke
   * Admin revokes an approved volunteer first-responder role
   */
  async revokeResponderRole(req, res) {
    try {
      const appId = validateInteger(req.params.id, 'application ID');
      const { reason, reason_other: reasonOther, admin_password: adminPassword } = req.body;

      if (!reason || !VALID_REVOKE_REASON_CODES.includes(String(reason).toLowerCase())) {
        return res.status(400).json({
          error: `Invalid reason. Must be one of: ${VALID_REVOKE_REASON_CODES.join(', ')}`,
        });
      }

      const normalizedReason = String(reason).toLowerCase();
      const trimmedOther = reasonOther != null ? String(reasonOther).trim() : '';

      if (normalizedReason === REVOKE_REASONS.OTHER) {
        if (!trimmedOther || trimmedOther.length < 10) {
          return res.status(400).json({
            error: "When reason is 'other', reason_other is required (minimum 10 characters).",
          });
        }
      }

      if (!adminPassword || String(adminPassword).length === 0) {
        return res.status(400).json({ error: 'Admin password is required to revoke responder role.' });
      }

      const application = await ResponderApplication.findById(appId);
      if (!application) {
        return res.status(404).json({ error: 'Application not found.' });
      }

      if (application.status !== 'approved') {
        return res.status(400).json({
          error: 'Only approved applications can be revoked.',
          current_status: application.status,
        });
      }

      const applicantUser = await User.findById(application.user_id);
      if (!applicantUser) {
        return res.status(404).json({ error: 'Applicant user not found.' });
      }

      if ((applicantUser.role || '').toLowerCase() !== 'volunteer') {
        return res.status(400).json({
          error: 'User is not currently a volunteer first responder.',
          current_role: applicantUser.role,
        });
      }

      const activeIncidents = await pool.query(
        `SELECT report_id, incident_type, responder_status
           FROM incident_reports
          WHERE accepted_by_user_id = $1
            AND (responder_status IS NULL OR responder_status != 'Resolved')`,
        [application.user_id]
      );

      if (activeIncidents.rows.length > 0) {
        return res.status(409).json({
          error: 'Cannot revoke responder role while the user has active incident assignments. Resolve all incidents first.',
          active_incidents: activeIncidents.rows.map((row) => ({
            report_id: row.report_id,
            incident_type: row.incident_type,
            responder_status: row.responder_status,
          })),
        });
      }

      const actingAdmin = await User.findById(req.user.user_id);
      if (!actingAdmin || !actingAdmin.password) {
        return res.status(403).json({ error: 'Unable to verify admin credentials.' });
      }

      const passwordValid = await comparePassword(String(adminPassword), actingAdmin.password);
      if (!passwordValid) {
        return res.status(403).json({ error: 'Invalid admin password.' });
      }

      const humanNotes = formatRevokeNotes(normalizedReason, trimmedOther);

      const updated = await ResponderApplication.revoke(appId, {
        notes: humanNotes,
        revoke_reason: normalizedReason,
        revoke_reason_other: normalizedReason === REVOKE_REASONS.OTHER ? trimmedOther : null,
        revoked_by: req.user.user_id,
      });

      await pool.query(
        "UPDATE users SET role = 'user', responder_online = false WHERE user_id = $1",
        [application.user_id]
      );

      await Responder.deleteByUserId(application.user_id, 'account');

      const notifyMessage = `Your volunteer first responder status has been removed. Reason: ${humanNotes} You may apply again at any time.`;

      await Notification.create({
        user_id: application.user_id,
        report_id: null,
        message: notifyMessage,
        sent_via: 'websocket',
        event_type: 'application_revoked',
      });

      await logAdminAction(req, 'responder_application_revoked', 'responder_application', appId, {
        applicant_user_id: application.user_id,
        reason: normalizedReason,
        reason_other: normalizedReason === REVOKE_REASONS.OTHER ? trimmedOther : null,
      });

      emitApplicationEvent(req, 'application:status_changed', {
        id: appId,
        user_id: application.user_id,
        status: 'revoked',
        reason: normalizedReason,
        notes: humanNotes,
      });

      res.json({
        message: 'Volunteer first responder role revoked successfully.',
        application: updated,
      });
    } catch (error) {
      console.error('Error revoking responder role:', error);
      if (error.message.includes('must be')) return res.status(400).json({ error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * GET /api/responder-applications/:id/documents/:filename
   * Secure file access for application documents (Option A: Protected file serving)
   */
  async serveDocument(req, res) {
    try {
      const appId = validateInteger(req.params.id, 'application ID');
      const filename = path.basename(req.params.filename);

      const application = await ResponderApplication.findById(appId);
      if (!application) {
        return res.status(404).json({ error: 'Application not found.' });
      }

      // Check authorization (Staff or owning user)
      const userRole = (req.user.role || '').toLowerCase();
      const isStaff = ['admin', 'super-admin', 'dispatcher', 'department-admin', 'supervisor'].includes(userRole);
      if (!isStaff && application.user_id !== req.user.user_id) {
        return res.status(403).json({ error: 'Forbidden. You do not have access to these documents.' });
      }

      const filePath = path.join(UPLOAD_BASE_DIR, String(application.user_id), filename);

      // Guard against path traversal
      if (!filePath.startsWith(UPLOAD_BASE_DIR)) {
        return res.status(400).json({ error: 'Invalid document path.' });
      }

      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({ error: 'Document file not found.' });
      }

      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.sendFile(filePath);
    } catch (error) {
      console.error('Error serving application document:', error);
      if (error.message.includes('must be')) return res.status(400).json({ error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  },
};

module.exports = responderApplicationController;
