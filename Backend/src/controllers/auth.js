const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { hashPassword, comparePassword } = require('../utils/hash');
const firebaseAdmin = require('../config/firebase');
const { validatePhone, validateString, validateEmail, validatePassword, validateAddress, validateLatitude, validateLongitude } = require('../utils/validation');
const { isPointInDagupan } = require('../utils/geolocation');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

// Register using phone_number
exports.register = async (req, res) => {
  console.log('📝 Registration attempt:', { phone: req.body.phone, firstName: req.body.firstName, lastName: req.body.lastName });
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
    if (existing) return res.status(409).json({ message: 'User with this phone already exists' });

    // Hash the password
    const passwordHash = await hashPassword(validatedPassword);

    const user = await User.create({ phone_number: validatedPhone, email: validatedEmail, address: validatedAddress, password: passwordHash, phone_verified: false, first_name: validatedFirstName, last_name: validatedLastName });

    const token = jwt.sign({ user_id: user.user_id, phone: user.phone_number, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    console.log('✅ Registration successful:', { user_id: user.user_id, phone: user.phone_number });
    res.status(201).json({ user: { user_id: user.user_id, phone: user.phone_number, firstName: user.first_name, lastName: user.last_name, role: user.role }, token });
  } catch (err) {
    console.error('❌ Registration error:', err.message);
    if (err.message.includes('must be') || err.message.includes('Invalid')) {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Registration failed' });
  }
};

// Login using phone_number and password
exports.login = async (req, res) => {
  console.log('🔐 Login attempt:', { phone: req.body.phone });
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
    console.log('✅ Login successful:', { user_id: user.user_id, phone: user.phone_number });
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
  console.log('📤 Request headers:', req.headers);
  console.log('📤 Request body:', req.body);
  
  try {
    const { idToken } = req.body;
    if (!idToken) {
      console.log('❌ Missing idToken in request');
      return res.status(400).json({ message: 'idToken required' });
    }

    // Validate idToken is a string
    const validatedToken = validateString(idToken, 'idToken', 1, 2048);
    console.log('✅ idToken validated, length:', validatedToken.length);

    // Verify the Firebase ID token
    console.log('🔐 Verifying Firebase ID token...');
    const decoded = await firebaseAdmin.auth().verifyIdToken(validatedToken);
    console.log('✅ Firebase ID token verified. Decoded:', { uid: decoded.uid, phone_number: decoded.phone_number });
    
    // Firebase phone auth places phone number on the token
    const phone = decoded.phone_number;
    if (!phone) {
      console.log('❌ ID token does not contain a phone number');
      return res.status(400).json({ message: 'ID token does not contain a phone number' });
    }

    console.log('👤 Looking for user with phone:', phone);
    // Check if user exists with that phone
    const existing = await User.findByPhone(phone);
    if (!existing) {
      console.log('❌ User not found with phone:', phone);
      return res.status(404).json({ message: 'User not found. Please register first.' });
    }

    console.log('✅ User found:', { user_id: existing.user_id, phone: existing.phone_number });

    // Update phone_verified to true
    console.log('🔄 Updating phone_verified to true for user:', existing.user_id);
    let user = await User.updatePhoneVerified(phone, true);
    console.log('✅ phone_verified updated. User:', { user_id: user.user_id, phone_verified: user.phone_verified });

    const token = jwt.sign({ user_id: user.user_id, phone: user.phone_number, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    console.log('✅ Phone onboarding successful:', { user_id: user.user_id, phone: user.phone_number });
    res.json({ user: { user_id: user.user_id, phone: user.phone_number, firstName: user.first_name, lastName: user.last_name, role: user.role }, token });
  } catch (err) {
    console.error('❌ Phone onboarding error:', err.message);
    console.error('❌ Error stack:', err.stack);
    if (err.message.includes('must be') || err.message.includes('Invalid')) {
      return res.status(400).json({ message: err.message });
    }
    // Firebase-specific errors
    if (err.code === 'auth/invalid-id-token') {
      console.error('❌ Firebase error: Invalid ID token');
      return res.status(401).json({ message: 'Invalid or expired Firebase ID token' });
    }
    if (err.code === 'auth/id-token-expired') {
      console.error('❌ Firebase error: ID token expired');
      return res.status(401).json({ message: 'Firebase ID token has expired' });
    }
    res.status(500).json({ message: 'Phone onboarding failed', error: err.message });
  }
};

// Reset password (forgot password flow): verify Firebase idToken, find user by phone, update password.
exports.resetPassword = async (req, res) => {
  console.log('🔑 Reset password attempt');
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

// Dispatcher login: email + password, only users with role 'dispatcher' can log in
exports.dispatcherLogin = async (req, res) => {
  console.log('🔐 Dispatcher login attempt:', { email: req.body.email });
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

    const validatedEmail = validateEmail(email);
    const user = await User.findByEmail(validatedEmail);
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    if (user.role !== 'dispatcher') return res.status(401).json({ message: 'Invalid credentials' });
    if (!user.password) return res.status(401).json({ message: 'Invalid credentials' });

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ user_id: user.user_id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    console.log('✅ Dispatcher login successful:', { user_id: user.user_id, email: user.email });
    res.json({ user: { user_id: user.user_id, email: user.email, role: user.role }, token });
  } catch (err) {
    console.error('❌ Dispatcher login error:', err.message);
    if (err.message.includes('must be') || err.message.includes('Invalid')) {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Login failed' });
  }
};

// Dispatcher signup: email, password, first name, last name; creates user with role 'dispatcher'
exports.dispatcherSignup = async (req, res) => {
  console.log('📝 Dispatcher signup attempt:', { email: req.body.email });
  try {
    const { email, password, firstName, lastName } = req.body;
    if (!email || !password || !firstName || !lastName) return res.status(400).json({ message: 'Email, password, firstName, and lastName are required' });

    const validatedEmail = validateEmail(email);
    const validatedPassword = validatePassword(password);
    const validatedFirstName = validateString(firstName, 'firstName', 1, 100);
    const validatedLastName = validateString(lastName, 'lastName', 1, 100);

    const existing = await User.findByEmail(validatedEmail);
    if (existing) return res.status(409).json({ message: 'An account with this email already exists' });

    const passwordHash = await hashPassword(validatedPassword);
    const user = await User.create({
      email: validatedEmail,
      password: passwordHash,
      role: 'dispatcher',
      phone_number: null,
      address: null,
      phone_verified: false,
      first_name: validatedFirstName,
      last_name: validatedLastName,
    });

    const token = jwt.sign({ user_id: user.user_id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    console.log('✅ Dispatcher signup successful:', { user_id: user.user_id, email: user.email });
    res.status(201).json({ user: { user_id: user.user_id, email: user.email, firstName: user.first_name, lastName: user.last_name, role: user.role }, token });
  } catch (err) {
    console.error('❌ Dispatcher signup error:', err.message);
    if (err.message.includes('must be') || err.message.includes('Invalid') || err.message.includes('at least')) {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Signup failed' });
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
        created_at: user.created_at,
      },
    });
  } catch (err) {
    console.error('❌ Get profile error:', err.message);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
};
