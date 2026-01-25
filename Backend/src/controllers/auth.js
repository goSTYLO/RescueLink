const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { hashPassword, comparePassword } = require('../utils/hash');
const firebaseAdmin = require('../config/firebase');
const { validatePhone, validateString, validateEmail, validatePassword, validateAddress, validateLatitude, validateLongitude } = require('../utils/validation');
const { isLocationInDagupan } = require('../utils/geolocation');

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
      const inDagupan = isLocationInDagupan(validatedLatitude, validatedLongitude);
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
// The client then sends { idToken, password } to this endpoint. We verify the idToken with
// Firebase Admin SDK, extract the phone number, and create the local user with phone_verified=true.
exports.onboardPhone = async (req, res) => {
  console.log('📱 Phone onboarding attempt');
  try {
    const { idToken, password } = req.body;
    if (!idToken) return res.status(400).json({ message: 'idToken required' });

    // Validate idToken is a string
    const validatedToken = validateString(idToken, 'idToken', 1, 2048);

    // Verify the Firebase ID token
    const decoded = await firebaseAdmin.auth().verifyIdToken(validatedToken);
    // Firebase phone auth places phone number on the token
    const phone = decoded.phone_number;
    if (!phone) return res.status(400).json({ message: 'ID token does not contain a phone number' });

    // Check if user exists with that phone
    const existing = await User.findByPhone(phone);
    if (!existing) return res.status(404).json({ message: 'User not found. Please register first.' });

    // Update phone_verified to true
    let user = await User.updatePhoneVerified(phone, true);

    // If password is provided, validate, hash, and store it
    if (password) {
      const validatedPassword = validatePassword(password);
      const passwordHash = await hashPassword(validatedPassword);
      user = await User.updatePassword(user.user_id, passwordHash);
    }

    const token = jwt.sign({ user_id: user.user_id, phone: user.phone_number, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    console.log('✅ Phone onboarding successful:', { user_id: user.user_id, phone: user.phone_number });
    res.json({ user: { user_id: user.user_id, phone: user.phone_number, firstName: user.first_name, lastName: user.last_name, role: user.role }, token });
  } catch (err) {
    console.error('❌ Phone onboarding error:', err.message);
    if (err.message.includes('must be') || err.message.includes('Invalid')) {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Phone onboarding failed' });
  }
};
