const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const Settings = require('../models/Settings');
const adminAuth = require('../middleware/adminAuth');


// ── Public: restaurant info (no auth) ────────────────────────────────────────
router.get('/public', async (req, res) => {
  try {
    const s = await Settings.findOne({ restaurantId: 'default' });
    if (!s) return res.status(404).json({ message: 'Not found' });
    res.json({ restaurantName: s.restaurantName });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Get settings ──────────────────────────────────────────────────────────────
router.get('/', adminAuth, async (req, res) => {
  try {
    const s = await Settings.findOne({ restaurantId: req.admin.restaurantId });
    if (!s) return res.status(404).json({ message: 'Settings not found' });
    // Never send password hash
    const { adminPasswordHash, ...safe } = s.toObject();
    res.json(safe);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Update settings ───────────────────────────────────────────────────────────
router.put('/', adminAuth, async (req, res) => {
  try {
    const { taxRate, saveCustomerData, restaurantName, tableCount, newPassword } = req.body;
    const updates = {};
    if (taxRate !== undefined)          updates.taxRate = Number(taxRate);
    if (saveCustomerData !== undefined) updates.saveCustomerData = Boolean(saveCustomerData);
    if (restaurantName)                 updates.restaurantName = restaurantName;
    if (tableCount !== undefined)       updates.tableCount = Number(tableCount);
    if (newPassword)                    updates.adminPasswordHash = await bcrypt.hash(newPassword, 10);

    const s = await Settings.findOneAndUpdate(
      { restaurantId: req.admin.restaurantId },
      updates,
      { new: true }
    );
    const { adminPasswordHash, ...safe } = s.toObject();
    res.json(safe);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;