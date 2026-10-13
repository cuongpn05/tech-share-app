const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');
const { initSocket } = require('./socket');
const adminRoutes = require('./routes/adminRoutes');
const ownerRoutes = require('./routes/ownerRoutes');
const chatRoutes = require('./routes/chatRoutes');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Khởi tạo Socket.IO Server
initSocket(server);

// Kết nối cơ sở dữ liệu MongoDB Atlas
connectDB();

// Cấu hình Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Tuyến đường API Quản trị viên, Chủ thiết bị & Trò chuyện
app.use('/api/admin', adminRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api/chats', chatRoutes);

// Tuyến đường mặc định & kiểm tra sức khỏe hệ thống
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'TechShare Backend API with Socket.IO is running.',
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

// Khởi chạy máy chủ HTTP + Socket.IO
server.listen(PORT, () => {
  console.log(`[Server] TechShare Backend đang chạy tại http://localhost:${PORT}`);
});

module.exports = app;
