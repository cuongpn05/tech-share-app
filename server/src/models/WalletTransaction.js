const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: ['topup', 'payment', 'deposit_hold', 'deposit_release', 'rental_income', 'withdrawal'],
    required: true,
  },
  amount: { type: Number, required: true },
  balanceAfter: { type: Number },
  relatedBookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
  status: { type: String, enum: ['success', 'pending', 'failed'], default: 'success' },
}, {
  timestamps: { createdAt: true, updatedAt: false },
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Index theo Mục 4
walletTransactionSchema.index({ userId: 1, createdAt: -1 });

const WalletTransaction = mongoose.models.WalletTransaction || mongoose.model('WalletTransaction', walletTransactionSchema, 'wallet_transactions');

module.exports = WalletTransaction;
