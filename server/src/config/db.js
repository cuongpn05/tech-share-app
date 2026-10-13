const mongoose = require('mongoose');
const path = require('path');

// Nạp biến môi trường từ file .env
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();

/**
 * Kết nối tới cơ sở dữ liệu MongoDB Atlas bằng Mongoose
 * @returns {Promise<typeof mongoose>}
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('[MongoDB Error] Lỗi: Chưa cấu hình biến môi trường MONGODB_URI trong file .env');
    process.exit(1);
  }

  // Lắng nghe các sự kiện của Mongoose connection
  mongoose.connection.on('error', (err) => {
    console.error(`[MongoDB Error] Lỗi kết nối CSDL: ${err.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB Warning] CSDL đã bị ngắt kết nối (Disconnected).');
  });

  try {
    const conn = await mongoose.connect(uri);

    console.log(`[MongoDB] Kết nối thành công tới MongoDB Atlas!`);
    console.log(`[MongoDB] Host: ${conn.connection.host}`);
    console.log(`[MongoDB] Database: ${conn.connection.name}`);

    return conn;
  } catch (error) {
    console.error(`[MongoDB Error] Kết nối thất bại: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
