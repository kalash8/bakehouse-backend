const router   = require('express').Router();
const adminAuth = require('../middleware/adminAuth');
const { generateAllQRs, generateTableQR } = require('../utils/generateQR');
const Settings = require('../models/Settings');

// ── Generate all QR codes for printing ───────────────────────────────────────
// GET /api/qr/all
router.get('/all', adminAuth, async (req, res) => {
  try {
    const settings = await Settings.findOne({ restaurantId: req.admin.restaurantId });
    const tableCount = settings?.tableCount || 10;
    const clientUrl  = process.env.CLIENT_URL;
    const qrs = await generateAllQRs(tableCount, clientUrl);
    res.json(qrs);
  } catch {
    res.status(500).json({ message: 'Failed to generate QR codes' });
  }
});

// ── Generate single table QR ──────────────────────────────────────────────────
router.get('/:tableNumber', adminAuth, async (req, res) => {
  try {
    const clientUrl = process.env.CLIENT_URL;
    const qr = await generateTableQR(Number(req.params.tableNumber), clientUrl);
    res.json(qr);
  } catch {
    res.status(500).json({ message: 'Failed to generate QR code' });
  }
});

module.exports = router;