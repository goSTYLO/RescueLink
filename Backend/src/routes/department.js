const express = require('express');
const router = express.Router();

const departmentController = require('../controllers/department');
const authMiddleware = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');
const { ROLES } = require('../config/roles');

router.use(authMiddleware);
router.use(authorize([ROLES.ADMIN]));

router.get('/', departmentController.getAll);
router.get('/:id', departmentController.getById);
router.post('/', departmentController.create);
router.put('/:id', departmentController.update);
router.delete('/:id', departmentController.remove);

router.get('/:id/metrics', departmentController.metrics);

router.get('/:id/units', departmentController.listUnits);
router.post('/:id/units', departmentController.createUnit);
router.put('/:id/units/:unitId', departmentController.updateUnit);
router.delete('/:id/units/:unitId', departmentController.deleteUnit);

router.get('/:id/personnel', departmentController.listPersonnel);
router.post('/:id/personnel', departmentController.createPersonnel);
router.put('/:id/personnel/:personnelId', departmentController.updatePersonnel);
router.delete('/:id/personnel/:personnelId', departmentController.deletePersonnel);

module.exports = router;
