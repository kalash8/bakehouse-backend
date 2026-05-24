const router    = require('express').Router();
const Order     = require('../models/Order');
const adminAuth = require('../middleware/adminAuth');

router.get('/', adminAuth, async (req, res) => {
  try {
    const restaurantId = req.admin.restaurantId;
    const { range = '7d' } = req.query;

    const now   = new Date();
    const start = new Date();
    if (range === '7d')  start.setDate(now.getDate() - 6);
    if (range === '30d') start.setDate(now.getDate() - 29);
    if (range === '90d') start.setDate(now.getDate() - 89);
    start.setHours(0, 0, 0, 0);

    const paidOrders = await Order.find({
      restaurantId,
      status: 'paid',
      createdAt: { $gte: start },
    });

    // ── Revenue over time ─────────────────────────────────────────────────────
    const revenueMap = {};
    paidOrders.forEach(o => {
      const day = o.createdAt.toISOString().slice(0, 10);
      revenueMap[day] = (revenueMap[day] || 0) + o.totalAmount;
    });
    const days = [];
    for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      days.push({ date: key, revenue: +(revenueMap[key] || 0).toFixed(2) });
    }

    // ── Summary cards ─────────────────────────────────────────────────────────
    const totalRevenue = paidOrders.reduce((s, o) => s + o.totalAmount, 0);
    const totalOrders  = paidOrders.length;
    const avgOrderValue = totalOrders ? totalRevenue / totalOrders : 0;

    // Today
    const todayStr = now.toISOString().slice(0, 10);
    const todayOrders  = paidOrders.filter(o => o.createdAt.toISOString().slice(0, 10) === todayStr);
    const todayRevenue = todayOrders.reduce((s, o) => s + o.totalAmount, 0);

    // ── Best & worst selling items ────────────────────────────────────────────
    const itemMap = {};
    paidOrders.forEach(o => {
      o.items.forEach(i => {
        if (!itemMap[i.name]) itemMap[i.name] = { name: i.name, qty: 0, revenue: 0 };
        itemMap[i.name].qty     += i.quantity;
        itemMap[i.name].revenue += i.price * i.quantity;
      });
    });
    const itemList = Object.values(itemMap).sort((a, b) => b.qty - a.qty);
    const topItems    = itemList.slice(0, 5);
    const bottomItems = itemList.slice(-5).reverse();

    // ── Peak hours ────────────────────────────────────────────────────────────
    const hourMap = Array(24).fill(0);
    paidOrders.forEach(o => { hourMap[o.createdAt.getHours()] += 1; });
    const peakHours = hourMap.map((count, hour) => ({
      hour: `${hour.toString().padStart(2, '0')}:00`,
      orders: count,
    }));

    // ── Table performance ─────────────────────────────────────────────────────
    const tableMap = {};
    paidOrders.forEach(o => {
      const t = `Table ${o.tableNumber}`;
      if (!tableMap[t]) tableMap[t] = { table: t, orders: 0, revenue: 0 };
      tableMap[t].orders  += 1;
      tableMap[t].revenue += o.totalAmount;
    });
    const tableStats = Object.values(tableMap).sort((a, b) => b.revenue - a.revenue);

    // ── Customer insights ─────────────────────────────────────────────────────
    const phoneMap = {};
    paidOrders.forEach(o => {
      if (!o.customerPhone) return;
      if (!phoneMap[o.customerPhone]) {
        phoneMap[o.customerPhone] = { phone: o.customerPhone, name: o.customerName, visits: 0, spent: 0 };
      }
      phoneMap[o.customerPhone].visits += 1;
      phoneMap[o.customerPhone].spent  += o.totalAmount;
    });
    const repeatCustomers = Object.values(phoneMap)
      .filter(c => c.visits > 1)
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10);

    res.json({
      summary: {
        totalRevenue:   +totalRevenue.toFixed(2),
        totalOrders,
        avgOrderValue:  +avgOrderValue.toFixed(2),
        todayRevenue:   +todayRevenue.toFixed(2),
        todayOrders:    todayOrders.length,
      },
      revenueByDay:   days,
      topItems,
      bottomItems,
      peakHours,
      tableStats,
      repeatCustomers,
    });
  } catch (err) {
    console.error('analytics error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;