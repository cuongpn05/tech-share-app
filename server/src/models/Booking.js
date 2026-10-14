const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    bookingCode: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      required: [true, 'Device reference is required'],
      index: true,
    },
    renterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Renter reference is required'],
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner reference is required'],
      index: true,
    },

    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    totalDays: {
      type: Number,
      required: [true, 'Total rental days is required'],
      min: [1, 'Rental duration must be at least 1 day'],
    },

    pricePerDayAtBooking: {
      type: Number,
      required: [true, 'Daily rental price at booking is required'],
    },
    rentalFee: {
      type: Number,
      required: [true, 'Rental fee is required'],
    },
    discountPercent: {
      type: Number,
      default: 0,
    },
    depositFee: {
      type: Number,
      required: [true, 'Deposit fee is required'],
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
    },

    deliveryMethod: {
      type: String,
      enum: ['pickup', 'delivery'],
      default: 'pickup',
    },
    deliveryAddress: {
      type: String,
      default: '',
    },

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'active', 'completed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'deposit_held', 'paid', 'refunded', 'disputed'],
      default: 'unpaid',
    },
    rejectReason: {
      type: String,
      default: '',
    },
    cancelReason: {
      type: String,
      default: '',
    },

    qrToken: {
      type: String,
      unique: true,
      sparse: true,
    },

    handoverPhotos: {
      beforeRental: [{ type: String }],
      afterRental: [{ type: String }],
    },
    conditionNotes: {
      before: { type: String, default: '' },
      after: { type: String, default: '' },
    },

    timeline: [
      {
        status: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        note: { type: String, default: '' },
      },
    ],

    extensionRequest: {
      requestedEndDate: { type: Date },
      requestedDays: { type: Number, default: 0 },
      additionalFee: { type: Number, default: 0 },
      status: {
        type: String,
        enum: ['none', 'pending', 'approved', 'rejected'],
        default: 'none',
      },
    },

    disputeStatus: {
      type: String,
      enum: ['none', 'pending', 'resolved'],
      default: 'none',
    },
    disputeNote: {
      type: String,
      default: '',
    },
    reminder6hSent: {
      type: Boolean,
      default: false,
    },
    reminder2hSent: {
      type: Boolean,
      default: false,
    },
    isReviewed: {
      type: Boolean,
      default: false,
      index: true,
    },
    reviewId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Review',
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Virtual aliases for backward compatibility
bookingSchema.virtual('device').get(function () {
  return this.deviceId;
}).set(function (val) {
  this.deviceId = val;
});
bookingSchema.virtual('renter').get(function () {
  return this.renterId;
}).set(function (val) {
  this.renterId = val;
});
bookingSchema.virtual('owner').get(function () {
  return this.ownerId;
}).set(function (val) {
  this.ownerId = val;
});
bookingSchema.virtual('dailyRate').get(function () {
  return this.pricePerDayAtBooking;
});
bookingSchema.virtual('depositValue').get(function () {
  return this.depositFee;
});

// Indexes
bookingSchema.index({ deviceId: 1, status: 1, startDate: 1 });
bookingSchema.index({ renterId: 1, status: 1 });
bookingSchema.index({ ownerId: 1, status: 1 });

const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);

module.exports = Booking;
