const mongoose = require('mongoose');

/**
 * Kết nối tới cơ sở dữ liệu MongoDB Atlas
 * @returns {Promise<typeof mongoose>}
 */
const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('MONGODB_URI chưa được thiết lập trong file .env');
  }

  if (!mongoose.connection.listenerCount('error')) {
    mongoose.connection.on('error', () => console.error('MongoDB connection error (connection details omitted).'));
  }
  if (!mongoose.connection.listenerCount('disconnected')) {
    mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected.'));
  }

  try {
    const conn = await mongoose.connect(mongoUri, { autoIndex: false, autoCreate: false });
    console.log('MongoDB connected successfully.');
    return conn;
  } catch (error) {
    console.error('MongoDB connection failed (connection details omitted).');
    throw error;
  }
};

module.exports = connectDB;
module.exports.connectDB = connectDB;
