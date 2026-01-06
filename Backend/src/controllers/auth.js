const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { hashPassword, comparePassword } = require('../utils/hash');
const firebaseAdmin = require('../config/firebase');

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

// Register using phone_number & password
exports.register = async (req, res) => {
  try {
    const { phone, password, firstName, lastName } = req.body;
    if (!phone || !password || !firstName || !lastName) return res.status(400).json({ message: 'Phone, firstName, lastName and password required' });

    const existing = await User.findByPhone(phone);
    if (existing) return res.status(409).json({ message: 'User with this phone already exists' });

    const hashed = await hashPassword(password);
    const user = await User.create({ phone_number: phone, password: hashed, phone_verified: false, first_name: firstName, last_name: lastName });

    const token = jwt.sign({ id: user.id, phone: user.phone_number }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ user: { id: user.id, phone: user.phone_number, firstName: user.first_name, lastName: user.last_name }, token });
  } catch (err) {
    console.error('register error', err);
    res.status(500).json({ message: 'Registration failed' });
  }
};

// Login using phone_number & password
exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ message: 'Phone number and password required' });

    const user = await User.findByPhone(phone);
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const ok = await comparePassword(password, user.password);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, phone: user.phone_number }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: { id: user.id, phone: user.phone_number }, token });
  } catch (err) {
    console.error('login error', err);
    res.status(500).json({ message: 'Login failed' });
  }
};

// Onboard using phone number verification via Firebase
// Flow: client performs Firebase phone verification (client SDK) and obtains a Firebase ID token.
// The client then sends { idToken, password } to this endpoint. We verify the idToken with
// Firebase Admin SDK, extract the phone number, and create the local user with phone_verified=true.
exports.onboardPhone = async (req, res) => {
  try {
    const { idToken, password, firstName, lastName } = req.body;
    if (!idToken || !password) return res.status(400).json({ message: 'idToken and password required' });

    // Verify the Firebase ID token
    const decoded = await firebaseAdmin.auth().verifyIdToken(idToken);
    // Firebase phone auth places phone number on the token
    const phone = decoded.phone_number;
    if (!phone) return res.status(400).json({ message: 'ID token does not contain a phone number' });

    // Check if user already exists with that phone
    const existing = await User.findByPhone(phone);
    if (existing) return res.status(409).json({ message: 'User with this phone already exists' });

  const hashed = await hashPassword(password);
  const user = await User.create({ phone_number: phone, password: hashed, phone_verified: true, first_name: firstName || null, last_name: lastName || null });

    const token = jwt.sign({ id: user.id, phone: user.phone_number }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ user: { id: user.id, phone: user.phone_number, firstName: user.first_name, lastName: user.last_name }, token });
  } catch (err) {
    console.error('onboardPhone error', err);
    res.status(500).json({ message: 'Phone onboarding failed' });
  }
};
