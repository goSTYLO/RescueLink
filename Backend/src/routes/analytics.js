const express = require('express');
const router = express.Router();

const analyticsController = require('../controllers/analytics');
const authMiddleware = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { ROLES } = require('../config/roles');

router.use(authMiddleware);
router.use(authorize([ROLES.ADMIN, ROLES.DEPARTMENT_ADMIN]));

router.get('/overview', analyticsController.overview);
router.get('/incidents', analyticsController.incidents);
router.get('/export.csv', analyticsController.exportCsv);
router.get('/barangays.geojson', analyticsController.barangaysGeojson);

module.exports = router;
