const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
      unique: true,
      index: true,
    },
    username: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    avatar: {
      type: String,
      default: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400',
    },
    isVerified: { type: Boolean, default: false },
    trustScore: { type: Number, default: 100, min: 0, max: 100 },
    badges: [{ type: String }],
    referralCode: { type: String, unique: true, sparse: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Device' }],
    walletBalance: { type: Number, default: 0, min: 0 },
    walletEscrowBalance: { type: Number, default: 0, min: 0 },
    expoPushToken: { type: String, default: '' },
    pushTokens: [{ type: String }],
    fcmTokens: [{ type: String }],
    biometricEnabled: { type: Boolean, default: false },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [105.7826, 21.0285] },
    },
    rating: { type: Number, default: 5.0, min: 1.0, max: 5.0 },
    totalReviews: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
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

userSchema.virtual('account', {
  ref: 'Account',
  localField: 'accountId',
  foreignField: '_id',
  justOne: true,
});

userSchema.index({ location: '2dsphere' });
userSchema.index({ trustScore: -1 });

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;
