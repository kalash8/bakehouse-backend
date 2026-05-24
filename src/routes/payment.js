const router   = require('express').Router();
const Order    = require('../models/Order');
const Settings = require('../models/Settings');
const adminAuth = require('../middleware/adminAuth');
const { sendWhatsAppReceipt } = require('../utils/whatsapp');
const { emitToOrder, emitToRestaurant } = require('../socket/orderSocket');

// ── Admin: Confirm payment received ──────────────────────────────────────────
// POST /api/payment/:orderId/confirm
router.post('/:orderId/confirm', adminAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('items.menuItem', 'name');

    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status === 'paid') return res.status(400).json({ message: 'Already paid' });

    order.status = 'paid';
    await order.save();

    const settings = await Settings.findOne({ restaurantId: order.restaurantId });

    // Send WhatsApp receipt if customer has a phone number
    if (order.customerPhone) {
      try {
        await sendWhatsAppReceipt({
          phone: order.customerPhone,
          order,
          restaurantName: settings?.restaurantName || 'BakeHouse',
        });
      } catch (waErr) {
        // Don't fail the whole request if WhatsApp fails
        console.error('WhatsApp send failed:', waErr.message);
      }
    }

    // Notify customer's page that payment is done
    emitToOrder(order._id.toString(), 'payment-confirmed', { orderId: order._id });
    emitToRestaurant(order.restaurantId, 'order-updated', order);

    res.json({ message: 'Payment confirmed', order });
  } catch (err) {
    console.error('payment confirm error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;