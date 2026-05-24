const router   = require('express').Router();
const Order    = require('../models/Order');
const Settings = require('../models/Settings');
const adminAuth = require('../middleware/adminAuth');
const { emitToRestaurant, emitToOrder } = require('../socket/orderSocket');

// ── Customer: Place / add-to order ───────────────────────────────────────────
// POST /api/orders
router.post('/', async (req, res) => {
  try {
    const { tableNumber, sessionId, items, customerPhone, customerName, restaurantId = 'default' } = req.body;

    if (!tableNumber || !sessionId || !items?.length) {
      return res.status(400).json({ message: 'tableNumber, sessionId, and items are required' });
    }

    const settings = await Settings.findOne({ restaurantId });
    const taxRate  = settings?.taxRate || 5;

    const subtotal   = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const taxAmount  = +(subtotal * taxRate / 100).toFixed(2);
    const totalAmount = +(subtotal + taxAmount).toFixed(2);

    // Check if an active order exists for this session (customer re-ordering)
    let order = await Order.findOne({ sessionId, status: 'active' });

    if (order) {
      // Append items to existing order
      order.items.push(...items);
      order.subtotal    = +(order.subtotal + subtotal).toFixed(2);
      order.taxAmount   = +(order.subtotal * taxRate / 100).toFixed(2);
      order.totalAmount = +(order.subtotal + order.taxAmount).toFixed(2);
      await order.save();
    } else {
      // New order
      const payload = {
        tableNumber, sessionId, restaurantId,
        items, taxRate, subtotal, taxAmount, totalAmount,
      };
      // Only save customer data if admin opted in
      if (settings?.saveCustomerData) {
        payload.customerPhone = customerPhone || null;
        payload.customerName  = customerName  || null;
      }
      order = await Order.create(payload);
    }

    await order.populate('items.menuItem', 'name photo');

    // Notify admin dashboard in real-time
    emitToRestaurant(restaurantId, 'new-order', order);

    res.status(201).json(order);
  } catch (err) {
    console.error('order error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Customer: Get their order by sessionId ────────────────────────────────────
// GET /api/orders/session/:sessionId
router.get('/session/:sessionId', async (req, res) => {
  try {
    const order = await Order.findOne({ sessionId: req.params.sessionId })
      .populate('items.menuItem', 'name photo price');
    if (!order) return res.status(404).json({ message: 'No active order' });
    res.json(order);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Admin: Remove an item from an order ──────────────────────────────────────
// DELETE /api/orders/:orderId/items/:itemId
router.delete('/:orderId/items/:itemId', adminAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (order.status === 'paid') {
      return res.status(400).json({ message: 'Cannot modify a paid order' });
    }

    const item = order.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    // Remove the item
    order.items.pull(req.params.itemId);

    if (order.items.length === 0) {
      // No items left — delete the whole order
      await order.deleteOne();
      emitToRestaurant(order.restaurantId, 'order-updated', { _id: order._id, deleted: true });
      return res.json({ deleted: true });
    }

    // Recalculate totals
    const subtotal    = order.items.reduce((s, i) => s + i.price * i.quantity, 0);
    const taxAmount   = +(subtotal * order.taxRate / 100).toFixed(2);
    const totalAmount = +(subtotal + taxAmount).toFixed(2);
    order.subtotal    = +subtotal.toFixed(2);
    order.taxAmount   = taxAmount;
    order.totalAmount = totalAmount;

    await order.save();

    emitToOrder(order._id.toString(), 'order-updated', order);
    emitToRestaurant(order.restaurantId, 'order-updated', order);

    res.json(order);
  } catch (err) {
    console.error('remove item error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Customer: Get order by ID (for order tracking page) ──────────────────────
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('items.menuItem', 'name photo');
    if (!order) return res.status(404).json({ message: 'Not found' });
    res.json(order);
  } catch {
    res.status(404).json({ message: 'Not found' });
  }
});

// ── Admin: Get all active orders for restaurant ───────────────────────────────
// GET /api/orders/admin/all?restaurantId=default&status=active
router.get('/admin/all', adminAuth, async (req, res) => {
  try {
    const { status, restaurantId } = req.query;
    const query = { restaurantId: restaurantId || req.admin.restaurantId };
    if (status) query.status = status;
    const orders = await Order.find(query)
      .populate('items.menuItem', 'name photo')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Admin: Mark a specific order item as delivered ────────────────────────────
// PATCH /api/orders/:orderId/items/:itemId/deliver
router.patch('/:orderId/items/:itemId/deliver', adminAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const item = order.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ message: 'Item not found' });

    item.status = 'delivered';
    await order.save();

    // Notify customer's order-tracking page
    emitToOrder(order._id.toString(), 'order-updated', order);
    emitToRestaurant(order.restaurantId, 'order-updated', order);

    res.json(order);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── Admin: Mark order as billed (generate bill) ───────────────────────────────
router.patch('/:id/bill', adminAuth, async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status: 'billed' },
      { new: true }
    ).populate('items.menuItem', 'name');

    emitToOrder(order._id.toString(), 'order-billed', order);
    emitToRestaurant(order.restaurantId, 'order-updated', order);
    res.json(order);
  } catch {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;