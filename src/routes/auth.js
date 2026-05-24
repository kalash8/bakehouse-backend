const router   = require('express').Router();
const jwt      = require('jsonwebtoken');
const bcrypt   = require('bcryptjs');
const admin    = require('firebase-admin');
const Settings = require('../models/Settings');

// Initialise Firebase Admin from env vars — no JSON file needed
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // The private key comes from .env with literal \n — replace them back
      privateKey:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

// ── Customer: Exchange Firebase token for app JWT ─────────────────────────────
// POST /api/auth/firebase-verify
router.post('/firebase-verify', async (req, res) => {
  try {
    const { firebaseToken, name, phone, tableNumber } = req.body; // ← add tableNumber
    if (!firebaseToken) return res.status(400).json({ message: 'Missing token' });

    await admin.auth().verifyIdToken(firebaseToken);

    const token = jwt.sign(
      { phone, name: name || 'Guest', isAdmin: false, tableNumber }, // ← add tableNumber
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, phone, name: name || 'Guest', tableNumber });
  } catch (err) {
    console.error('firebase-verify error:', err.message);
    res.status(401).json({ message: 'Invalid Firebase token' });
  }
});

// ── Admin: Login ──────────────────────────────────────────────────────────────
// POST /api/auth/admin/login
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const settings = await Settings.findOne({ adminEmail: email });
    if (!settings) return res.status(401).json({ message: 'Invalid credentials' });

    const match = await settings.matchPassword(password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { email, isAdmin: true, restaurantId: settings.restaurantId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, restaurantId: settings.restaurantId });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Admin: First-time setup (run once) ────────────────────────────────────────
// POST /api/auth/admin/setup
router.post('/admin/setup', async (req, res) => {
  try {
    const existing = await Settings.findOne({ restaurantId: 'default' });
    if (existing) return res.status(400).json({ message: 'Setup already done. Use /login.' });

    const { email, password, restaurantName } = req.body;
    const hash = await bcrypt.hash(password, 10);
    await Settings.create({
      restaurantId: 'default',
      restaurantName: restaurantName || process.env.RESTAURANT_NAME || 'BakeHouse',
      adminEmail: email,
      adminPasswordHash: hash,
    });
    res.json({ message: 'Admin account created. You can now log in.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;