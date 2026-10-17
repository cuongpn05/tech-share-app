const mongoose = require('mongoose');

const aiCacheSchema = new mongoose.Schema({
  type: { type: String, enum: ['review_summary', 'comparison', 'consultant'], required: true },
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', default: null, index: true },
  inputHash: { type: String, required: true },
  resultJson: { type: mongoose.Schema.Types.Mixed, required: true }, // Lưu summary, pros, cons, recommendation
  expiresAt: { type: Date, required: true },
}, {
  timestamps: { createdAt: true, updatedAt: false },
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// TTL Index tự động xoá bản ghi khi đến hạn expiresAt theo Mục 4
aiCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
aiCacheSchema.index({ inputHash: 1 });

const AiCache = mongoose.models.AiCache || mongoose.model('AiCache', aiCacheSchema, 'ai_caches');

module.exports = AiCache;
