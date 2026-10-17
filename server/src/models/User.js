const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Account',
    required: true,
    unique: true,
    index: true,
  },
  username: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
  name: { type: String, required: true, trim: true },
  phone: { type: String, default: '', trim: true },
  address: { type: String, default: '' },
  avatar: {
    type: String,
    default: '',
  },

  // 1. Nhóm Tín nhiệm & Định danh (Issue #7, #8)
  trust: {
    isVerified: { type: Boolean, default: false },
    score: { type: Number, default: 100, min: 0, max: 200 },
    badges: [{ type: String }],
  },

  // 2. Nhóm Ví Ký quỹ Nội bộ (Issue #39)
  wallet: {
    balance: { type: Number, default: 0, min: 0 },
    escrowBalance: { type: Number, default: 0, min: 0 },
  },

  // 3. Nhóm Thiết bị & Push Notification (Hỗ trợ cả Mobile Expo & Web FCM)
  pushConfig: {
    expoPushToken: { type: String, default: '' },
    fcmTokens: [{ type: String }], // Dùng cho Web Push & FCM
    biometricEnabled: { type: Boolean, default: false }, // Dùng cho Mobile App FaceID/TouchID
  },

  // 4. Vị trí Địa lý GeoJSON & Cá nhân hóa
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [105.7826, 21.0285] }, // [lng, lat]
  },
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Device' }],

  referralCode: { type: String, unique: true, sparse: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  rating: { type: Number, default: 5.0, min: 1.0, max: 5.0 },
  totalReviews: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Virtual liên kết Account
userSchema.virtual('account', {
  ref: 'Account',
  localField: 'accountId',
  foreignField: '_id',
  justOne: true,
});
userSchema.virtual('email').get(function () { return this.account?.email; });
userSchema.virtual('role').get(function () { return this.account?.roleId?.code || this.account?.roleId; });
userSchema.virtual('totalReview').get(function () { return this.totalReviews; });

// Virtual Getters & Setters 2 chiều (Đảm bảo Mobile App & Web gọi kiểu cũ hay mới đều chạy)
userSchema.virtual('isVerified')
  .get(function () { return this.trust?.isVerified ?? false; })
  .set(function (v) { this.set('trust.isVerified', v); });

userSchema.virtual('trustScore')
  .get(function () { return this.trust?.score ?? 100; })
  .set(function (v) { this.set('trust.score', v); });

userSchema.virtual('badges')
  .get(function () { return this.trust?.badges ?? []; })
  .set(function (v) { this.set('trust.badges', v); });

userSchema.virtual('walletBalance')
  .get(function () { return this.wallet?.balance ?? 0; })
  .set(function (v) { this.set('wallet.balance', v); });

userSchema.virtual('walletEscrowBalance')
  .get(function () { return this.wallet?.escrowBalance ?? 0; })
  .set(function (v) { this.set('wallet.escrowBalance', v); });

userSchema.virtual('expoPushToken')
  .get(function () { return this.pushConfig?.expoPushToken ?? ''; })
  .set(function (v) { this.set('pushConfig.expoPushToken', v); });

userSchema.virtual('pushTokens')
  .get(function () { return this.pushConfig?.expoPushToken ? [this.pushConfig.expoPushToken] : []; })
  .set(function (v) {
    if (Array.isArray(v) && v.length > 0) {
      this.set('pushConfig.expoPushToken', v[0]);
    } else if (typeof v === 'string') {
      this.set('pushConfig.expoPushToken', v);
    }
  });

userSchema.virtual('biometricEnabled')
  .get(function () { return this.pushConfig?.biometricEnabled ?? false; })
  .set(function (v) { this.set('pushConfig.biometricEnabled', v); });

userSchema.index({ location: '2dsphere' });
userSchema.index({ 'trust.score': -1 });

module.exports = mongoose.models.User || mongoose.model('User', userSchema, 'users');
