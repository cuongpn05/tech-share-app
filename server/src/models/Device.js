const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    brand: { type: String, required: true, trim: true, index: true },
    category: {
      type: String,
      enum: ['smartphone', 'laptop', 'camera', 'drone', 'audio', 'tablet', 'gaming', 'accessory'],
      required: true,
      index: true,
    },
    yearOfManufacture: Number,
    condition: { type: String, enum: ['new99', 'used95', 'scratched'], default: 'new99' },
    description: { type: String, default: '' },
    images: {
      type: [String],
      default: [],
    },
    specs: { type: Map, of: String, default: {} },
    accessories: [{ type: String }],
    pricePerDay: { type: Number, required: true, min: 10000 },
    depositAmount: { type: Number, required: true, min: 0 },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [105.7826, 21.0285] },
    },
    addressText: { type: String, default: '' },
    status: {
      type: String,
      enum: ['available', 'maintenance', 'hidden', 'rented'],
      default: 'available',
      index: true,
    },
    blockedDates: [
      {
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        reason: String,
      },
    ],
    ratingAvg: { type: Number, default: 5.0, min: 1.0, max: 5.0 },
    ratingCount: { type: Number, default: 0 },
    rentalCount: { type: Number, default: 0 },
    revenueTotal: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual aliases for backward compatibility
deviceSchema.virtual('title').get(function () {
  return this.name;
}).set(function (val) {
  this.name = val;
});
deviceSchema.virtual('owner').get(function () {
  return this.ownerId;
}).set(function (val) {
  this.ownerId = val;
});
deviceSchema.virtual('dailyRate').get(function () {
  return this.pricePerDay;
}).set(function (val) {
  this.pricePerDay = val;
});
deviceSchema.virtual('depositValue').get(function () {
  return this.depositAmount;
}).set(function (val) {
  this.depositAmount = val;
});
deviceSchema.virtual('rating').get(function () {
  return this.ratingAvg;
});
deviceSchema.virtual('reviewCount').get(function () {
  return this.ratingCount;
});
deviceSchema.virtual('viewsCount').get(function () {
  return this.rentalCount;
});

// GeoJSON 2dsphere index for radius queries
deviceSchema.index({ location: '2dsphere' });
// Compound index
deviceSchema.index({ category: 1, status: 1 });
// Text search index
deviceSchema.index({ name: 'text', brand: 'text', description: 'text' });



deviceSchema.add({ aiAnalysis: {
  summary: { type: String, default: '' }, pros: [{ type: String }], cons: [{ type: String }],
  rentalRecommendation: { type: String, default: '' }, analyzedAt: { type: Date },
} });

const Device = mongoose.models.Device || mongoose.model('Device', deviceSchema);

module.exports = Device;
