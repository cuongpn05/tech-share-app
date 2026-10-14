const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const deviceRoutes = require('./routes/deviceRoutes');
const adminRoutes = require('./routes/adminRoutes');
const ownerRoutes = require('./routes/ownerRoutes');
const authRoutes = require('./routes/authRoutes');
const morgan = require('morgan');
const { notFound, errorHandler } = require('./middlewares/errorHandler');
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev', { skip: () => process.env.NODE_ENV === 'test' }));
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));
app.get('/', (req, res) => res.json({ success: true, message: 'TechShare Backend API is running.', version: '1.0.0' }));
app.get('/api/health', (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({ status: connected ? 'ONLINE' : 'OFFLINE', database: connected ? 'Connected' : 'Disconnected', uptime: process.uptime(), timestamp: new Date().toISOString() });
});
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/owner', ownerRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = { app };
