const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  type: { type: String, enum: ['text', 'image', 'location', 'quick_template'], default: 'text' },
  content: { type: String, default: '', trim: true, maxlength: 1000 },
  mediaUrl: { type: String, default: '' },
  location: { latitude: Number, longitude: Number, address: String },
  status: { type: String, enum: ['sent', 'delivered', 'read'], default: 'sent', index: true },
}, {
  timestamps: { createdAt: true, updatedAt: false },
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Virtual aliases
messageSchema.virtual('booking').get(function () { return this.bookingId; });
messageSchema.virtual('sender').get(function () { return this.senderId; });
messageSchema.virtual('recipient').get(function () { return this.receiverId; });
messageSchema.virtual('isRead').get(function () { return this.status === 'read'; });

// Indexes theo Mục 4
messageSchema.index({ bookingId: 1, createdAt: 1 });
messageSchema.index({ receiverId: 1, status: 1 }); // Tăng tốc đếm badge tin nhắn chưa đọc

const Message = mongoose.models.Message || mongoose.model('Message', messageSchema, 'messages');

module.exports = Message;
