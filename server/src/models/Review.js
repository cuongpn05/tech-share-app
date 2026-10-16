const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true, index: true },
  renterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ownerId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Người thực hiện đánh giá & Loại đối tượng được đánh giá (Hỗ trợ Mục 32, 33, 48)
  reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  targetType: {
    type: String,
    enum: ['device', 'owner', 'renter'],
    default: 'device',
  },

  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, required: true, trim: true },
  images: [{ type: String }],
}, {
  timestamps: { createdAt: true, updatedAt: false },
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Tự động gán reviewerId = renterId nếu code cũ của App không truyền reviewerId
reviewSchema.pre('validate', function (next) {
  if (!this.reviewerId) {
    this.reviewerId = this.targetType === 'renter' ? this.ownerId : this.renterId;
  }
  next();
});

// Cho phép 1 đơn hàng có đủ: Renter đánh giá Device, Renter đánh giá Owner, và Owner đánh giá Renter
reviewSchema.index({ bookingId: 1, reviewerId: 1, targetType: 1 }, { unique: true });
reviewSchema.index({ deviceId: 1, createdAt: -1 });

module.exports = mongoose.models.Review || mongoose.model('Review', reviewSchema, 'reviews');
