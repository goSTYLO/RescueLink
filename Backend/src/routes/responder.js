const express = require('express');
const router = express.Router();
const responderController = require('../controllers/responder');
const authMiddleware = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { ROLES } = require('../config/roles');

router.use(authMiddleware);

// Team APIs
router.get('/teams', authorize([ROLES.DISPATCHER, ROLES.ADMIN]), responderController.listTeams);
router.post('/teams', authorize([ROLES.ADMIN]), responderController.createTeam);
router.get('/teams/:teamId', authorize([ROLES.DISPATCHER, ROLES.ADMIN]), responderController.getTeamById);
router.put('/teams/:teamId', authorize([ROLES.ADMIN]), responderController.updateTeam);
router.patch('/teams/:teamId/status', authorize([ROLES.DISPATCHER, ROLES.ADMIN]), responderController.updateTeamStatus);
router.delete('/teams/:teamId', authorize([ROLES.ADMIN]), responderController.deleteTeam);
router.get('/teams/:teamId/members', authorize([ROLES.DISPATCHER, ROLES.ADMIN]), responderController.listTeamMembers);
router.post('/teams/:teamId/members', authorize([ROLES.ADMIN]), responderController.addTeamMember);
router.delete('/teams/:teamId/members/:responderId', authorize([ROLES.ADMIN]), responderController.removeTeamMember);

// Responder APIs
router.get('/', authorize([ROLES.DISPATCHER, ROLES.ADMIN]), responderController.getAll);
router.post('/', authorize([ROLES.ADMIN]), responderController.create);
router.get('/:id', authorize([ROLES.DISPATCHER, ROLES.ADMIN]), responderController.getById);
router.put('/:id', authorize([ROLES.ADMIN]), responderController.update);
router.patch('/:id/status', authorize([ROLES.DISPATCHER, ROLES.ADMIN]), responderController.updateStatus);
router.delete('/:id', authorize([ROLES.ADMIN]), responderController.delete);

module.exports = router;
