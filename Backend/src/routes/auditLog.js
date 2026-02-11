const express = require('express');
const router = express.Router();
const auditLogController = require('../controllers/auditLog');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, auditLogController.getAll);

module.exports = router;
