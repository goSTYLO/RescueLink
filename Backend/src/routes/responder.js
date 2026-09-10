const express = require('express');
const router = express.Router();
const responderController = require('../controllers/responder');
const authMiddleware = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { ROLES } = require('../config/roles');

router.use(authMiddleware);

// Team APIs (department-admin can list/create/update/manage members; delete remains admin-only)
router.get('/teams', authorize([ROLES.DISPATCHER, ROLES.ADMIN, ROLES.DEPARTMENT_ADMIN, ROLES.DEPARTMENT_HEAD]), responderController.listTeams);
router.post('/teams', authorize([ROLES.ADMIN, ROLES.DEPARTMENT_ADMIN]), responderController.createTeam);
router.get('/teams/:teamId', authorize([ROLES.DISPATCHER, ROLES.ADMIN, ROLES.DEPARTMENT_ADMIN]), responderController.getTeamById);
router.put('/teams/:teamId', authorize([ROLES.ADMIN, ROLES.DEPARTMENT_ADMIN]), responderController.updateTeam);
router.patch('/teams/:teamId/status', authorize([ROLES.DISPATCHER, ROLES.ADMIN, ROLES.DEPARTMENT_ADMIN]), responderController.updateTeamStatus);
router.delete('/teams/:teamId', authorize([ROLES.ADMIN]), responderController.deleteTeam);
router.get('/teams/:teamId/members', authorize([ROLES.DISPATCHER, ROLES.ADMIN, ROLES.DEPARTMENT_ADMIN]), responderController.listTeamMembers);
router.post('/teams/:teamId/members', authorize([ROLES.ADMIN, ROLES.DEPARTMENT_ADMIN]), responderController.addTeamMember);
router.delete('/teams/:teamId/members/:responderId', authorize([ROLES.ADMIN, ROLES.DEPARTMENT_ADMIN]), responderController.removeTeamMember);

// Responder APIs (department-admin can list/create/update; delete remains admin-only)
router.get('/', authorize([ROLES.DISPATCHER, ROLES.ADMIN, ROLES.DEPARTMENT_ADMIN]), responderController.getAll);

// ── Phase 3: Responder self-service (must be before /:id to avoid shadowing) ──
router.patch('/me/online-status', authorize([ROLES.RESPONDER, ROLES.VOLUNTEER]), responderController.updateOnlineStatus);
router.get('/me/profile',         authorize([ROLES.RESPONDER, ROLES.VOLUNTEER]), responderController.getSelfProfile);
router.get('/me/assigned-incidents', authorize([ROLES.RESPONDER]), responderController.getAssignedIncidents);
router.get('/me/team', authorize([ROLES.RESPONDER]), responderController.getMyTeam);
router.post('/', authorize([ROLES.ADMIN, ROLES.DEPARTMENT_ADMIN]), responderController.create);
router.get('/:id', authorize([ROLES.DISPATCHER, ROLES.ADMIN, ROLES.DEPARTMENT_ADMIN]), responderController.getById);
router.put('/:id', authorize([ROLES.ADMIN, ROLES.DEPARTMENT_ADMIN]), responderController.update);
router.patch('/:id/status', authorize([ROLES.DISPATCHER, ROLES.ADMIN, ROLES.DEPARTMENT_ADMIN]), responderController.updateStatus);
router.delete('/:id', authorize([ROLES.ADMIN]), responderController.delete);

module.exports = router;
