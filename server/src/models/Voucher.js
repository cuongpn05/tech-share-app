const mongoose = require('mongoose');

const voucherSchema = new mongoose.Schema({
  code: { type: String, unique: true, required: true, uppercase: true, trim: true },
  type: { type: String, enum: ['fixed', 'percent'], required: true },
  value: { type: Number, required: true, min: 0 },
  minDays: { type: Number, default: 0 },
  maxDiscount: { type: Number },
  expiryDate: { type: Date },
  usageLimit: { type: Number },
  usedCount: { type: Number, default: 0 },
  perUserLimit: { type: Number, default: 1 },
  isActive: { type: Boolean, default: true },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

const Voucher = mongoose.models.Voucher || mongoose.model('Voucher', voucherSchema, 'vouchers');

module.exports = Voucher;
