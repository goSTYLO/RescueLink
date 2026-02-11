const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth');
const authMiddleware = require('../middleware/auth');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/dispatcher/login', authController.dispatcherLogin);
router.post('/dispatcher/signup', authController.dispatcherSignup);
// Onboard via phone: client should obtain a Firebase ID token after phone verification
// then send it here along with the desired password.
router.post('/onboard-phone', authController.onboardPhone);
router.post('/reset-password', authController.resetPassword);
router.get('/me', authMiddleware, authController.getMe);

module.exports = router;
