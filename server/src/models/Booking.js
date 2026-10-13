const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    bookingCode: { type: String, unique: true, sparse: true, index: true },
    deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true, index: true },
    renterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    totalDays: { type: Number, required: true, min: 1 },
    pricePerDayAtBooking: { type: Number, required: true },
    rentalFee: { type: Number, required: true },
    discountPercent: { type: Number, default: 0 },
    depositFee: { type: Number, required: true, default: 0 },
    voucherCode: { type: String, default: '' },
    voucherDiscount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    deliveryMethod: { type: String, enum: ['pickup', 'delivery'], default: 'pickup' },
    deliveryAddress: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'active', 'completed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    completedAt: { type: Date, index: true },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'deposit_held', 'paid', 'refunded', 'disputed'],
      default: 'unpaid',
    },
    disputeStatus: { type: String, enum: ['none', 'pending', 'resolved'], default: 'none' },
    disputeNote: { type: String, default: '' },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

bookingSchema.index({ deviceId: 1, status: 1 });
bookingSchema.index({ renterId: 1, status: 1 });
bookingSchema.index({ ownerId: 1, status: 1 });
bookingSchema.index({ status: 1, completedAt: 1 });

const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);

module.exports = Booking;
