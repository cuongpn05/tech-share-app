const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');
const adminRoutes = require('./routes/adminRoutes');
const ownerRoutes = require('./routes/ownerRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Kết nối cơ sở dữ liệu MongoDB Atlas
connectDB();

// Cấu hình Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Tuyến đường API Quản trị viên & Chủ thiết bị
app.use('/api/admin', adminRoutes);
app.use('/api/owner', ownerRoutes);

// Tuyến đường mặc định & kiểm tra sức khỏe hệ thống
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'TechShare Backend API is running.',
    version: '1.0.0',
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Khởi chạy máy chủ Express
app.listen(PORT, () => {
  console.log(`[Server] TechShare Backend đang chạy tại http://localhost:${PORT}`);
});

module.exports = app;
