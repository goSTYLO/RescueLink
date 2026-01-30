const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth');

router.post('/register', authController.register);
router.post('/login', authController.login);
// Onboard via phone: client should obtain a Firebase ID token after phone verification
// then send it here along with the desired password.
router.post('/onboard-phone', authController.onboardPhone);
router.post('/reset-password', authController.resetPassword);

module.exports = router;
