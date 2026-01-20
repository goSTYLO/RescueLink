const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { hashPassword, comparePassword } = require('../utils/hash');
const firebaseAdmin = require('../config/firebase');
const { validatePhone, validateString, validateOptionalString } = require('../utils/validation');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

// Register using phone_number
exports.register = async (req, res) => {
  try {
    const { phone, firstName, lastName, email } = req.body;
    if (!phone || !firstName || !lastName) return res.status(400).json({ message: 'Phone, firstName, and lastName required' });

    // Validate and sanitize inputs
    const validatedPhone = validatePhone(phone);
    const validatedFirstName = validateString(firstName, 'firstName', 1, 100);
    const validatedLastName = validateString(lastName, 'lastName', 1, 100);
    const validatedEmail = email ? validateOptionalString(email, 'email', 255) : null;

    const existing = await User.findByPhone(validatedPhone);
    if (existing) return res.status(409).json({ message: 'User with this phone already exists' });

    const user = await User.create({ phone_number: validatedPhone, email: validatedEmail, phone_verified: false, first_name: validatedFirstName, last_name: validatedLastName });

    const token = jwt.sign({ user_id: user.user_id, phone: user.phone_number, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ user: { user_id: user.user_id, phone: user.phone_number, firstName: user.first_name, lastName: user.last_name, role: user.role }, token });
  } catch (err) {
    console.error('register error', err);
    if (err.message.includes('must be') || err.message.includes('Invalid')) {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Registration failed' });
  }
};

// Login using phone_number (authentication via Firebase in production)
exports.login = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: 'Phone number required' });

    // Validate and sanitize input
    const validatedPhone = validatePhone(phone);

    const user = await User.findByPhone(validatedPhone);
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ user_id: user.user_id, phone: user.phone_number, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: { user_id: user.user_id, phone: user.phone_number, role: user.role }, token });
  } catch (err) {
    console.error('login error', err);
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
  try {
    const { idToken } = req.body;
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
    const user = await User.updatePhoneVerified(phone, true);

    const token = jwt.sign({ user_id: user.user_id, phone: user.phone_number, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: { user_id: user.user_id, phone: user.phone_number, firstName: user.first_name, lastName: user.last_name, role: user.role }, token });
  } catch (err) {
    console.error('onboardPhone error', err);
    if (err.message.includes('must be') || err.message.includes('Invalid')) {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Phone onboarding failed' });
  }
};
