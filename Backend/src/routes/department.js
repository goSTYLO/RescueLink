const express = require('express');
const router = express.Router();

const departmentController = require('../controllers/department');
const authMiddleware = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { ROLES } = require('../config/roles');

router.use(authMiddleware);

// List all and create/update/delete: admin only
router.get('/', authorize([ROLES.ADMIN]), departmentController.getAll);
router.post('/', authorize([ROLES.ADMIN]), departmentController.create);
router.put('/:id', authorize([ROLES.ADMIN]), departmentController.update);
router.delete('/:id', authorize([ROLES.ADMIN]), departmentController.remove);

// Get by ID: admin, department-admin, and department-head (controller restricts dept admin/head to own department)
router.get('/:id', authorize([ROLES.ADMIN, ROLES.DEPARTMENT_ADMIN, ROLES.DEPARTMENT_HEAD]), departmentController.getById);

// Nested routes: admin only (units: dept admin/head can list; dept admin can create)
router.get('/:id/metrics', authorize([ROLES.ADMIN]), departmentController.metrics);
router.get('/:id/units', authorize([ROLES.ADMIN, ROLES.DEPARTMENT_ADMIN, ROLES.DEPARTMENT_HEAD]), departmentController.listUnits);
router.post('/:id/units', authorize([ROLES.ADMIN, ROLES.DEPARTMENT_ADMIN]), departmentController.createUnit);
router.put('/:id/units/:unitId', authorize([ROLES.ADMIN]), departmentController.updateUnit);
router.post('/:id/units/:unitId/assign', authorize([ROLES.ADMIN, ROLES.DEPARTMENT_ADMIN]), departmentController.assignUnit);
router.delete('/:id/units/:unitId', authorize([ROLES.ADMIN]), departmentController.deleteUnit);
router.get('/:id/personnel', authorize([ROLES.ADMIN]), departmentController.listPersonnel);
router.post('/:id/personnel', authorize([ROLES.ADMIN]), departmentController.createPersonnel);
router.put('/:id/personnel/:personnelId', authorize([ROLES.ADMIN]), departmentController.updatePersonnel);
router.delete('/:id/personnel/:personnelId', authorize([ROLES.ADMIN]), departmentController.deletePersonnel);

module.exports = router;
