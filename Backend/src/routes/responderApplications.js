/**
 * Responder Applications Route — Phase 2 Volunteer Responder Onboarding
 */

const express = require('express');
const router = express.Router();
const responderApplicationController = require('../controllers/responderApplication');
const authMiddleware = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { ROLES } = require('../config/roles');
const { documentUploadMiddleware } = require('../middleware/documentUpload');

router.use(authMiddleware);

// Citizen endpoints
// GET  /api/responder-applications/me — Get user's own application status
router.get('/me', responderApplicationController.getMyApplication);

// POST /api/responder-applications — Citizen submits volunteer application with credentials
router.post('/', documentUploadMiddleware, responderApplicationController.submitApplication);

// Dispatcher / Admin endpoints
// GET  /api/responder-applications — List applications
router.get('/', authorize([ROLES.DISPATCHER, ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.DEPARTMENT_ADMIN]), responderApplicationController.listApplications);

// GET  /api/responder-applications/:id — View single application detail
router.get('/:id', responderApplicationController.getApplicationById);

// PATCH /api/responder-applications/:id/status — Dispatcher approves or rejects application
router.patch('/:id/status', authorize([ROLES.DISPATCHER, ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.DEPARTMENT_ADMIN]), responderApplicationController.updateApplicationStatus);

// GET  /api/responder-applications/:id/documents/:filename — Access control protected document download
router.get('/:id/documents/:filename', responderApplicationController.serveDocument);

module.exports = router;
