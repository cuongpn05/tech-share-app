const mongoose = require('mongoose');

const ekycRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  idCardNumber: { type: String, default: '', trim: true },
  idCardFrontUrl: { type: String, required: true },
  idCardBackUrl: { type: String, required: true },
  selfieUrl: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  rejectReason: { type: String, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date },
}, {
  timestamps: { createdAt: true, updatedAt: true },
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Index theo Mục 4
ekycRequestSchema.index({ userId: 1 }, { unique: true });

const EkycRequest = mongoose.models.EkycRequest || mongoose.model('EkycRequest', ekycRequestSchema, 'ekyc_requests');

module.exports = EkycRequest;
