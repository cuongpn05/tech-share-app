const mongoose = require('mongoose');

const FALLBACK_MONGODB_URI =
  'mongodb+srv://qnhat202005_db_user:qnhat202005@tech-share.0srn8rv.mongodb.net/techshare?retryWrites=true&w=majority&appName=tech-share';

/**
 * Kết nối tới cơ sở dữ liệu MongoDB Atlas bằng Mongoose
 * @returns {Promise<typeof mongoose>}
 */
const connectDB = async () => {
  const uri = process.env.MONGODB_URI || FALLBACK_MONGODB_URI;

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
