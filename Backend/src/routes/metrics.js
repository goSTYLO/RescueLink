const express = require('express');
const router = express.Router();

const metricsController = require('../controllers/metrics');
const authMiddleware = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { ROLES } = require('../config/roles');

router.use(authMiddleware);
router.use(authorize([ROLES.ADMIN]));

router.get('/', metricsController.getSummary);
router.post('/reset', metricsController.reset);

module.exports = router;
