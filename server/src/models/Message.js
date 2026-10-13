const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking reference is required'],
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender reference is required'],
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Receiver reference is required'],
    },
    type: {
      type: String,
      enum: ['text', 'image', 'location', 'quick_template', 'template'],
      default: 'text',
    },
    content: {
      type: String,
      default: '',
      trim: true,
    },
    mediaUrl: {
      type: String,
      default: '',
    },
    location: {
      latitude: Number,
      longitude: Number,
      address: String,
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual aliases
messageSchema.virtual('booking').get(function () {
  return this.bookingId;
});
messageSchema.virtual('sender').get(function () {
  return this.senderId;
});
messageSchema.virtual('recipient').get(function () {
  return this.receiverId;
});
messageSchema.virtual('isRead').get(function () {
  return this.status === 'read';
});

// Index tối ưu truy vấn theo đơn thuê và thời gian
messageSchema.index({ bookingId: 1, createdAt: 1 });

const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);

module.exports = Message;
