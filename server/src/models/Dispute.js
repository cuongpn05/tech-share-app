const mongoose = require('mongoose');

const disputeSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
    raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true, trim: true },
    evidenceImages: [{ type: String }],
    requestedDeductAmount: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'resolved'], default: 'pending', index: true },
    adminDecision: { type: String, enum: ['full_refund', 'partial_deduct', 'full_deduct'] },
    finalDeductAmount: { type: Number, default: 0 },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const Dispute = mongoose.models.Dispute || mongoose.model('Dispute', disputeSchema);

module.exports = Dispute;
