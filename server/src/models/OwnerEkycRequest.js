const mongoose = require('mongoose');

/**
 * Schema lưu trữ hồ sơ eKYC nâng cấp từ Renter đã xác thực lên Owner.
 * Collection: owner_ekyc_requests
 */
const ownerEkycRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  idCardNumber: { type: String, required: true, trim: true },
  idCardFrontUrl: { type: String, required: true, trim: true },
  idCardBackUrl: { type: String, required: true, trim: true },
  selfieWithIdUrl: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true,
  },
  rejectReason: { type: String, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
}, {
  timestamps: { createdAt: true, updatedAt: true },
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

ownerEkycRequestSchema.index({ userId: 1 }, { unique: true });

const OwnerEkycRequest =
  mongoose.models.OwnerEkycRequest ||
  mongoose.model('OwnerEkycRequest', ownerEkycRequestSchema, 'owner_ekyc_requests');

module.exports = OwnerEkycRequest;

