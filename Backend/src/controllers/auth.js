const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { hashPassword, comparePassword } = require('../utils/hash');
const firebaseAdmin = require('../config/firebase');
const { validatePhone, validateString, validateEmail, validatePassword, validateAddress, validateLatitude, validateLongitude, validateSessionToken } = require('../utils/validation');
const { isPointInDagupan } = require('../utils/geolocation');
const { sendPasswordResetEmail } = require('../services/email');
const { logDispatcherAction, logDispatcherActionByUser } = require('../utils/auditLog');
const { JWT_SECRET } = require('../config/jwt');
const TokenBlacklist = require('../models/tokenBlacklist');
const DispatcherOtp = require('../models/dispatcherOtp');
const { sendOtpEmail } = require('../services/email');
const { ROLES } = require('../config/roles');
const Department = require('../models/department');

const WEB_EMAIL_AUTH_ROLES = [
  ROLES.DISPATCHER,
  ROLES.ADMIN,
  ROLES.SUPERVISOR,
  ROLES.RESPONDER,
  ROLES.DEPARTMENT_ADMIN,
  ROLES.DEPARTMENT_HEAD,
];

function canUseWebEmailAuth(role) {
  return WEB_EMAIL_AUTH_ROLES.includes(role);
}

// Register using phone_number
exports.register = async (req, res) => {
  console.log('📝 Registration attempt');
  try {
    const { phone, firstName, lastName, email, address, password, latitude, longitude } = req.body;
    if (!phone || !firstName || !lastName || !password) return res.status(400).json({ message: 'Phone, firstName, lastName, and password are required' });

    // Validate and sanitize inputs
    const validatedPhone = validatePhone(phone);
    const validatedFirstName = validateString(firstName, 'firstName', 1, 100);
    const validatedLastName = validateString(lastName, 'lastName', 1, 100);
    const validatedEmail = email ? validateEmail(email) : null;
    const validatedAddress = validateAddress(address);
    const validatedPassword = validatePassword(password);

    // Validate location if provided
    if (latitude !== undefined && longitude !== undefined) {
      const validatedLatitude = validateLatitude(latitude);
      const validatedLongitude = validateLongitude(longitude);
      
      // Check if location is within Dagupan
      const inDagupan = isPointInDagupan(validatedLatitude, validatedLongitude);
      if (!inDagupan) {
        return res.status(403).json({ 
          message: 'Your location is outside Dagupan City. Only residents of Dagupan can register.',
          locationOutside: true
        });
      }
    }

    const existing = await User.findByPhone(validatedPhone);
    if (existing) return res.status(400).json({ message: 'Registration could not be completed. If you already have an account, please sign in.' });

    // Hash the password
    const passwordHash = await hashPassword(validatedPassword);

    const user = await User.create({ phone_number: validatedPhone, email: validatedEmail, address: validatedAddress, password: passwordHash, phone_verified: false, first_name: validatedFirstName, last_name: validatedLastName });

    const token = jwt.sign({ user_id: user.user_id, phone: user.phone_number, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    console.log('✅ Registration successful:', { user_id: user.user_id });
    res.status(201).json({ user: { user_id: user.user_id, phone: user.phone_number, firstName: user.first_name, lastName: user.last_name, role: user.role }, token });
  } catch (err) {
    console.error('❌ Registration error:', err.message);
    if (err.message.includes('must be') || err.message.includes('Invalid') || err.message.includes('required') || err.message.includes('at least')) {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Registration failed' });
  }
};

// Login using phone_number and password
exports.login = async (req, res) => {
  console.log('🔐 Login attempt');
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ message: 'Phone number and password are required' });

    // Validate and sanitize input
    const validatedPhone = validatePhone(phone);

    const user = await User.findByPhone(validatedPhone);
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    // Check if user has a password set
    if (!user.password) return res.status(401).json({ message: 'Invalid credentials' });

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ user_id: user.user_id, phone: user.phone_number, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    console.log('✅ Login successful:', { user_id: user.user_id });
    res.json({ user: { user_id: user.user_id, phone: user.phone_number, role: user.role }, token });
  } catch (err) {
    console.error('❌ Login error:', err.message);
    if (err.message.includes('must be') || err.message.includes('Invalid')) {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Login failed' });
  }
};

// Onboard using phone number verification via Firebase
// Flow: client performs Firebase phone verification (client SDK) and obtains a Firebase ID token.
// The client then sends { idToken } to this endpoint. We verify the idToken with
// Firebase Admin SDK, extract the phone number, and mark the user as phone_verified=true.
exports.onboardPhone = async (req, res) => {
  console.log('📱 Phone onboarding attempt');
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ message: 'idToken required' });
    }

    // Validate idToken is a string
    const validatedToken = validateString(idToken, 'idToken', 1, 2048);

    // Verify the Firebase ID token
    const decoded = await firebaseAdmin.auth().verifyIdToken(validatedToken);

    // Firebase phone auth places phone number on the token
    const phone = decoded.phone_number;
    if (!phone) {
      return res.status(400).json({ message: 'ID token does not contain a phone number' });
    }

    // Check if user exists with that phone
    const existing = await User.findByPhone(phone);
    if (!existing) {
      return res.status(404).json({ message: 'User not found. Please register first.' });
    }

    // Update phone_verified to true
    let user = await User.updatePhoneVerified(phone, true);

    const token = jwt.sign({ user_id: user.user_id, phone: user.phone_number, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    console.log('✅ Phone onboarding successful:', { user_id: user.user_id });
    res.json({ user: { user_id: user.user_id, phone: user.phone_number, firstName: user.first_name, lastName: user.last_name, role: user.role }, token });
  } catch (err) {
    console.error('❌ Phone onboarding error:', err.message);
    console.error('❌ Error stack:', err.stack);
    if (err.message.includes('must be') || err.message.includes('Invalid')) {
      return res.status(400).json({ message: err.message });
    }
    // Firebase-specific errors
    if (err.code === 'auth/invalid-id-token') {
      return res.status(401).json({ message: 'Invalid or expired Firebase ID token' });
    }
    if (err.code === 'auth/id-token-expired') {
      return res.status(401).json({ message: 'Firebase ID token has expired' });
    }
    res.status(500).json({ message: 'Phone onboarding failed', error: err.message });
  }
};

// Reset password (forgot password flow): verify Firebase idToken, find user by phone, update password.
exports.resetPassword = async (req, res) => {
  try {
    const { idToken, newPassword } = req.body;
    if (!idToken || !newPassword) {
      return res.status(400).json({ message: 'idToken and newPassword are required' });
    }

    const validatedToken = validateString(idToken, 'idToken', 1, 2048);
    const validatedPassword = validatePassword(newPassword);

    const decoded = await firebaseAdmin.auth().verifyIdToken(validatedToken);
    const phone = decoded.phone_number;
    if (!phone) {
      return res.status(400).json({ message: 'ID token does not contain a phone number' });
    }

    const user = await User.findByPhone(phone);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const passwordHash = await hashPassword(validatedPassword);
    await User.updatePassword(user.user_id, passwordHash);
    console.log('✅ Password updated for user:', user.user_id);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('❌ Reset password error:', err.message);
    if (err.message.includes('must be') || err.message.includes('Invalid') || err.message.includes('at least')) {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === 'auth/invalid-id-token' || err.code === 'auth/id-token-expired') {
      return res.status(401).json({ message: 'Invalid or expired verification. Please request a new code.' });
    }
    res.status(500).json({ message: 'Password reset failed' });
  }
};

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Forgot password (web): send reset link via SMTP. Generic response so we don't reveal if email exists.
exports.forgotPassword = async (req, res) => {
  const genericMessage = 'If an account exists with this email, you will receive instructions to reset your password.';
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ message: 'Email is required' });
    }
    const validatedEmail = validateEmail(email.trim());

    const user = await User.findByEmail(validatedEmail);
    if (!user || !canUseWebEmailAuth(user.role)) {
      return res.json({ message: genericMessage });
    }

    const token = jwt.sign(
      { email: validatedEmail, purpose: 'password_reset' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const resetLink = `${FRONTEND_URL.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`;
    const sent = await sendPasswordResetEmail(validatedEmail, resetLink);
    if (!sent) {
      console.warn('⚠️ Forgot password: email not sent (SMTP not configured or failed)');
    }
    return res.json({ message: genericMessage });
  } catch (err) {
    if (err.message && (err.message.includes('must be') || err.message.includes('Invalid'))) {
      return res.status(400).json({ message: 'Email is required' });
    }
    console.error('❌ Forgot password error:', err.message);
    return res.json({ message: genericMessage });
  }
};

// Reset password with token from email link (web). No auth middleware.
exports.resetPasswordWithToken = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and newPassword are required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.purpose !== 'password_reset' || !decoded.email) {
      return res.status(401).json({ message: 'Invalid or expired reset link. Please request a new one.' });
    }

    const user = await User.findByEmail(decoded.email);
    if (!user || !canUseWebEmailAuth(user.role)) {
      return res.status(401).json({ message: 'Invalid or expired reset link. Please request a new one.' });
    }

    const validatedPassword = validatePassword(newPassword);
    const passwordHash = await hashPassword(validatedPassword);
    await User.updatePassword(user.user_id, passwordHash);
    await logDispatcherActionByUser(user, req, 'password_reset', 'auth', null, { via: 'email_link' });
    console.log('✅ Password reset with token for user:', user.user_id);
    return res.json({ message: 'Password updated successfully' });
  } catch (err) {
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid or expired reset link. Please request a new one.' });
    }
    if (err.message && (err.message.includes('must be') || err.message.includes('at least'))) {
      return res.status(400).json({ message: err.message });
    }
    console.error('❌ Reset password with token error:', err.message);
    return res.status(500).json({ message: 'Password reset failed' });
  }
};

const DISPATCHER_MFA_ENABLED = process.env.DISPATCHER_MFA_ENABLED !== 'false';

// Dispatcher login: email + password. When MFA enabled, returns sessionToken for OTP step.
exports.dispatcherLogin = async (req, res) => {
  console.log('🔐 Dispatcher login attempt');
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

    const validatedEmail = validateEmail(email);
    const user = await User.findByEmail(validatedEmail);
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    if (!canUseWebEmailAuth(user.role)) return res.status(401).json({ message: 'Invalid credentials' });
    if (!user.password) return res.status(401).json({ message: 'Invalid credentials' });

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) return res.status(401).json({ message: 'Invalid credentials' });

    if (DISPATCHER_MFA_ENABLED) {
      const { otp, sessionToken } = await DispatcherOtp.create(user.user_id);
      const sent = await sendOtpEmail(user.email, otp);
      if (!sent) {
        return res.status(503).json({ message: 'MFA is enabled but email service is not configured. Set DISPATCHER_MFA_ENABLED=false for development.' });
      }
      await DispatcherOtp.cleanupExpired();
      console.log('✅ Dispatcher OTP sent:', { user_id: user.user_id });
      return res.json({ sessionToken, message: 'Verification code sent to your email' });
    }

    const token = jwt.sign({ user_id: user.user_id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    await logDispatcherActionByUser(user, req, 'dispatcher_login', 'auth', null, { method: 'email' });
    console.log('✅ Dispatcher login successful:', { user_id: user.user_id });
    let department = null;
    if (user.department_id) {
      const dept = await Department.findById(user.department_id);
      department = dept ? dept.name : null;
    }
    res.json({
      user: {
        user_id: user.user_id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        department_id: user.department_id ?? null,
        department: department ?? null,
      },
      token,
    });
  } catch (err) {
    console.error('❌ Dispatcher login error:', err.message);
    const isValidationError = /required|must be|Invalid|not exceed/i.test(err.message);
    if (isValidationError) {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Login failed' });
  }
};

// Dispatcher MFA: verify OTP and return JWT
exports.dispatcherVerifyOtp = async (req, res) => {
  try {
    const { sessionToken, otp } = req.body;
    if (!sessionToken || !otp) return res.status(400).json({ message: 'Session token and OTP are required' });

    const validatedSessionToken = validateSessionToken(sessionToken);
    const validatedOtp = String(otp).trim();
    if (!/^\d{6}$/.test(validatedOtp)) return res.status(400).json({ message: 'OTP must be 6 digits' });

    const userId = await DispatcherOtp.verify(validatedSessionToken, validatedOtp);
    if (!userId) return res.status(401).json({ message: 'Invalid or expired verification code' });

    const user = await User.findById(userId);
    if (!user || !canUseWebEmailAuth(user.role)) return res.status(401).json({ message: 'Invalid session' });

    const token = jwt.sign({ user_id: user.user_id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    await logDispatcherActionByUser(user, req, 'dispatcher_login', 'auth', null, { method: 'email', mfa: true });
    console.log('✅ Dispatcher MFA verified:', { user_id: user.user_id });
    let department = null;
    if (user.department_id) {
      const dept = await Department.findById(user.department_id);
      department = dept ? dept.name : null;
    }
    res.json({
      user: {
        user_id: user.user_id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        department_id: user.department_id ?? null,
        department: department ?? null,
      },
      token,
    });
  } catch (err) {
    console.error('❌ Dispatcher verify OTP error:', err.message);
    if (err.message && /required|Invalid|must be/i.test(err.message)) {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Verification failed' });
  }
};

// Dispatcher signup: email, password, first name, last name; creates user with role 'dispatcher'
exports.dispatcherSignup = async (req, res) => {
  console.log('📝 Dispatcher signup attempt');
  try {
    const { email, password, firstName, lastName } = req.body;
    if (!email || !password || !firstName || !lastName) return res.status(400).json({ message: 'Email, password, firstName, and lastName are required' });

    const validatedEmail = validateEmail(email);
    const validatedPassword = validatePassword(password);
    const validatedFirstName = validateString(firstName, 'firstName', 1, 100);
    const validatedLastName = validateString(lastName, 'lastName', 1, 100);

    const existing = await User.findByEmail(validatedEmail);
    if (existing) return res.status(400).json({ message: 'Registration could not be completed. If you already have an account, please sign in.' });

    const passwordHash = await hashPassword(validatedPassword);
    const user = await User.create({
      email: validatedEmail,
      password: passwordHash,
      role: ROLES.DISPATCHER,
      phone_number: null,
      address: null,
      phone_verified: false,
      first_name: validatedFirstName,
      last_name: validatedLastName,
    });

    const token = jwt.sign({ user_id: user.user_id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    await logDispatcherActionByUser(user, req, 'dispatcher_signup', 'auth', null, { method: 'email', note: 'New dispatcher account' });
    console.log('✅ Dispatcher signup successful:', { user_id: user.user_id });
    res.status(201).json({ user: { user_id: user.user_id, email: user.email, firstName: user.first_name, lastName: user.last_name, role: user.role }, token });
  } catch (err) {
    console.error('❌ Dispatcher signup error:', err.message);
    const isValidationError = /required|must be|Invalid|at least|not exceed/i.test(err.message);
    if (isValidationError) {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Signup failed' });
  }
};

// Update current user's profile (address/barangay)
exports.updateMe = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { address } = req.body;
    let validatedAddress = null;
    try {
      validatedAddress = validateAddress(address);
    } catch (err) {
      if (err.message?.includes('must be') || err.message?.includes('must not')) {
        return res.status(400).json({ message: err.message });
      }
    }

    await User.updateAddress(userId, validatedAddress);
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let department = null;
    if (user.department_id) {
      const dept = await Department.findById(user.department_id);
      department = dept ? dept.name : null;
    }

    res.json({
      user: {
        user_id: user.user_id,
        phone: user.phone_number,
        email: user.email,
        address: user.address,
        phone_verified: user.phone_verified,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        department_id: user.department_id ?? null,
        department: department ?? null,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    console.error('❌ Update profile error:', err.message);
    res.status(500).json({ message: 'Failed to update profile' });
  }
};

// Get current authenticated user's profile
exports.getMe = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let department = null;
    if (user.department_id) {
      const dept = await Department.findById(user.department_id);
      department = dept ? dept.name : null;
    }

    res.json({
      user: {
        user_id: user.user_id,
        phone: user.phone_number,
        email: user.email,
        address: user.address,
        phone_verified: user.phone_verified,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        department_id: user.department_id ?? null,
        department: department ?? null,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    console.error('❌ Get profile error:', err.message);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
};

// Change password for authenticated user (current + new)
exports.changePassword = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    const user = await User.findById(userId);
    if (!user || !user.password) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    const isCurrentValid = await comparePassword(currentPassword, user.password);
    if (!isCurrentValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    const validatedPassword = validatePassword(newPassword);
    const passwordHash = await hashPassword(validatedPassword);
    await User.updatePassword(userId, passwordHash);
    await logDispatcherAction(req, 'password_change', 'auth', null, { note: 'Password updated' });
    console.log('✅ Password changed for user:', userId);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    if (err.message && (err.message.includes('must be') || err.message.includes('at least') || err.message.includes('Invalid'))) {
      return res.status(400).json({ message: err.message });
    }
    console.error('❌ Change password error:', err.message);
    res.status(500).json({ message: 'Failed to change password' });
  }
};

// Logout: invalidate token (add to blacklist), record audit log for dispatchers
exports.logout = async (req, res) => {
  try {
    const token = req.token;
    if (token) {
      try {
        const decoded = jwt.decode(token);
        if (decoded?.exp) {
          const expiresAt = new Date(decoded.exp * 1000);
          await TokenBlacklist.add(token, expiresAt);
          await TokenBlacklist.cleanupExpired();
        }
      } catch (blacklistErr) {
        console.error('❌ Logout blacklist error:', blacklistErr.message);
      }
    }
    if (req.user?.role === ROLES.DISPATCHER) {
      await logDispatcherAction(req, 'dispatcher_logout', 'auth', null, { note: 'Session ended' });
    }
    res.json({ message: 'Logged out' });
  } catch (err) {
    console.error('❌ Logout error:', err.message);
    res.json({ message: 'Logged out' });
  }
};
