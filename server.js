require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./src/config/db');
const { initSocket } = require('./src/socket/orderSocket');

// ─── Routes ──────────────────────────────────────────────────────────────────
const menuRoutes    = require('./src/routes/menu');
const orderRoutes   = require('./src/routes/orders');
const authRoutes    = require('./src/routes/auth');
const adminRoutes   = require('./src/routes/admin');
const paymentRoutes = require('./src/routes/payment');
const qrRoutes      = require('./src/routes/qr');
const analyticsRoutes = require('./src/routes/analytics')
const app    = express();
const server = http.createServer(app);

// ─── Socket.io ───────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: [
      process.env.CLIENT_URL,
      process.env.ADMIN_URL,
      'http://localhost:5173',
      'http://localhost:5174',
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
initSocket(io);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    process.env.CLIENT_URL,
    process.env.ADMIN_URL,
    'https://admin-zeta-lovat.vercel.app',
    'https://bakehouse-menu.vercel.app',
    'http://localhost:5173',
    'http://localhost:5174',
  ],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Attach io to every request so routes can emit events
app.use((req, _res, next) => { req.io = io; next(); });

// ─── Health check (Render pings this to keep the service alive) ───────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date() }));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',    authRoutes);
app.use('/api/menu',    menuRoutes);
app.use('/api/orders',  orderRoutes);
app.use('/api/admin',   adminRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/qr',      qrRoutes);
app.use('/api/analytics', analyticsRoutes);

// ─── 404 + Global error handler ───────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ message: 'Route not found' }));
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  server.listen(PORT, () => console.log(`🍞 Server running on port ${PORT}`));
});