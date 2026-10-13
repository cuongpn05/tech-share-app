const mongoose = require('mongoose');

const ekycRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    idCardFrontUrl: { type: String, required: true },
    idCardBackUrl: { type: String, required: true },
    selfieUrl: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    rejectReason: { type: String, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const EkycRequest =
  mongoose.models.EkycRequest || mongoose.model('EkycRequest', ekycRequestSchema);

module.exports = EkycRequest;
