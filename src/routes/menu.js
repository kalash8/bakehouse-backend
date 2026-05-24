const router    = require('express').Router();
const MenuItem  = require('../models/MenuItem');
const adminAuth = require('../middleware/adminAuth');
const upload    = require('../middleware/upload');
const cloudinary = require('../config/cloudinary');

// ── Public: Get all available menu items ─────────────────────────────────────
// GET /api/menu
router.get('/', async (req, res) => {
  try {
    const { search, dietType, minPrice, maxPrice, popular, restaurantId = 'default' } = req.query;
    const query = { restaurantId };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
      ];
    }
    if (dietType && dietType !== 'all') query.dietType = dietType;
    if (popular === 'true') query.isPopular = true;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    const items = await MenuItem.find(query).sort({ isAvailable: -1, createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Public: Get single item ───────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json(item);
  } catch {
    res.status(404).json({ message: 'Item not found' });
  }
});

// ── Admin: Add item ───────────────────────────────────────────────────────────
// POST /api/menu
router.post('/', adminAuth, upload.single('photo'), async (req, res) => {
  try {
    const { name, description, price, category, dietType, isAvailable, isPopular, restaurantId } = req.body;
    const item = await MenuItem.create({
      name, description, price: Number(price),
      category, dietType,
      isAvailable: isAvailable !== 'false',
      isPopular: isPopular === 'true',
      restaurantId: restaurantId || req.admin.restaurantId || 'default',
      photo: req.file?.path || '',
      photoPublicId: req.file?.filename || '',
    });
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── Admin: Edit item ──────────────────────────────────────────────────────────
router.put('/:id', adminAuth, upload.single('photo'), async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found' });

    // If a new photo was uploaded, delete the old one from Cloudinary
    if (req.file && item.photoPublicId) {
      await cloudinary.uploader.destroy(item.photoPublicId).catch(() => {});
    }

    const updates = { ...req.body };
    if (req.file) {
      updates.photo = req.file.path;
      updates.photoPublicId = req.file.filename;
    }
    if (updates.price) updates.price = Number(updates.price);
    if (updates.isAvailable !== undefined) updates.isAvailable = updates.isAvailable !== 'false';
    if (updates.isPopular !== undefined) updates.isPopular = updates.isPopular === 'true';

    const updated = await MenuItem.findByIdAndUpdate(req.params.id, updates, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// ── Admin: Toggle availability (quick action) ─────────────────────────────────
router.patch('/:id/toggle', adminAuth, async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found' });
    item.isAvailable = !item.isAvailable;
    await item.save();
    res.json(item);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Admin: Delete item ────────────────────────────────────────────────────────
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found' });
    if (item.photoPublicId) {
      await cloudinary.uploader.destroy(item.photoPublicId).catch(() => {});
    }
    await item.deleteOne();
    res.json({ message: 'Deleted' });
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;