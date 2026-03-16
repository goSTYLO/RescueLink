const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth');
const authMiddleware = require('../middleware/auth');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/dispatcher/login', authController.dispatcherLogin);
router.post('/dispatcher/verify-otp', authController.dispatcherVerifyOtp);
router.post('/dispatcher/signup', authController.dispatcherSignup);
// Onboard via phone: client should obtain a Firebase ID token after phone verification
// then send it here along with the desired password.
router.post('/onboard-phone', authController.onboardPhone);
router.post('/reset-password', authController.resetPassword);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password-with-token', authController.resetPasswordWithToken);
router.get('/me', authMiddleware, authController.getMe);
router.patch('/me', authMiddleware, authController.updateMe);
router.post('/change-password', authMiddleware, authController.changePassword);
router.post('/logout', authMiddleware, authController.logout);

module.exports = router;
