const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Đảm bảo 1 user không thể thêm trùng lặp 1 thiết bị nhiều lần, và tối ưu tốc độ tìm kiếm
wishlistSchema.index({ userId: 1, deviceId: 1 }, { unique: true });

module.exports = mongoose.models.Wishlist || mongoose.model('Wishlist', wishlistSchema, 'wishlists');
