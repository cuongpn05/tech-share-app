const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true, index: true },
  renterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ownerId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Reviewer reference & target entity type (Supports UC-R32, UC-R33, UC-O21)
  reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  targetType: {
    type: String,
    enum: ['device', 'owner'],
    default: 'device',
  },

  rating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, required: true, trim: true },
  ownerRating: { type: Number, min: 1, max: 5 },
  ownerFeedback: { type: String, default: '' },
  images: [{ type: String }],
}, {
  timestamps: { createdAt: true, updatedAt: false },
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Auto-assign reviewerId = renterId and sync unified rating/feedback
reviewSchema.pre('validate', function (next) {
  if (!this.reviewerId) {
    this.reviewerId = this.renterId;
  }
  if ((this.ownerRating === undefined || this.ownerRating === null) && this.rating) {
    this.ownerRating = this.rating;
  }
  if (!this.ownerFeedback && this.comment) {
    this.ownerFeedback = this.comment;
  }
  next();
});

// Compound unique index ensuring one review per targetType per participant per booking
reviewSchema.index({ bookingId: 1, reviewerId: 1, targetType: 1 }, { unique: true });
reviewSchema.index({ deviceId: 1, createdAt: -1 });

module.exports = mongoose.models.Review || mongoose.model('Review', reviewSchema, 'reviews');
