const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  // 1. Định danh & Phân loại thiết bị
  name: { type: String, required: true, trim: true },
  brand: { type: String, required: true, trim: true, index: true },
  category: {
    type: String,
    enum: ['smartphone', 'laptop', 'camera', 'drone', 'audio', 'gaming', 'tablet', 'accessory'],
    required: true,
    index: true,
  },
  yearOfManufacture: { type: Number },
  condition: { type: String, enum: ['new99', 'used95', 'scratched'], default: 'new99' },
  description: { type: String, required: true },

  // 2. Đa phương tiện & Thông số kỹ thuật động (Specs Map)
  images: {
    type: [String],
    required: true,
    validate: [val => Array.isArray(val) && val.length > 0 && val.length <= 8, 'Cần từ 1 - 8 ảnh'],
  },
  specs: { type: Map, of: String, default: {} },
  accessories: [{ type: String }],

  // 3. Chi phí thuê & Tiền cọc
  pricePerDay: { type: Number, required: true, min: 10000, index: true },
  depositAmount: { type: Number, required: true, min: 0 },

  // 4. Vị trí Địa lý GeoJSON (Dùng cho cả react-native-maps trên App & Google/Leaflet Map trên Web)
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: value => Array.isArray(value) && value.length === 2 &&
          value.every(Number.isFinite) && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90,
        message: 'coordinates must contain valid [longitude, latitude]',
      },
    }, // [lng, lat]
    addressText: { type: String, required: true },
  },

  // 5. Trạng thái Kho, Lịch bận & Kiểm duyệt Admin (UC-O08, UC-O10, UC-A05)
  status: {
    type: String,
    enum: ['available', 'maintenance', 'hidden', 'rented'],
    default: 'available',
    index: true,
  },
  moderationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true,
  },
  rejectReason: {
    type: String,
    default: '',
  },
  blockedDates: [
    {
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      reason: { type: String, default: '' },
      _id: false,
    },
  ],

  // 6. Nhóm Thống kê Hiệu quả Kinh doanh
  stats: {
    ratingAvg: { type: Number, default: 5.0, min: 1.0, max: 5.0 },
    ratingCount: { type: Number, default: 0 },
    rentalCount: { type: Number, default: 0 },
    revenueTotal: { type: Number, default: 0 },
  },

  isDeleted: { type: Boolean, default: false, index: true },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Virtuals 2 chiều giúp code App và Web truy cập trực tiếp device.ratingAvg hoặc device.stats.ratingAvg đều được
deviceSchema.virtual('owner', {
  ref: 'User',
  localField: 'ownerId',
  foreignField: '_id',
  justOne: true,
});

deviceSchema.virtual('addressText')
  .get(function () { return this.location?.addressText ?? ''; })
  .set(function (v) { this.set('location.addressText', v); });

deviceSchema.virtual('ratingAvg')
  .get(function () { return this.stats?.ratingAvg ?? 5.0; })
  .set(function (v) { this.set('stats.ratingAvg', v); });

deviceSchema.virtual('ratingCount')
  .get(function () { return this.stats?.ratingCount ?? 0; })
  .set(function (v) { this.set('stats.ratingCount', v); });

deviceSchema.virtual('rentalCount')
  .get(function () { return this.stats?.rentalCount ?? 0; })
  .set(function (v) { this.set('stats.rentalCount', v); });

deviceSchema.virtual('revenueTotal')
  .get(function () { return this.stats?.revenueTotal ?? 0; })
  .set(function (v) { this.set('stats.revenueTotal', v); });

// Tương thích ngược với các controller/views cũ
deviceSchema.virtual('title')
  .get(function () { return this.name; })
  .set(function (v) { this.name = v; });

deviceSchema.virtual('dailyRate')
  .get(function () { return this.pricePerDay; })
  .set(function (v) { this.pricePerDay = v; });

deviceSchema.virtual('depositValue')
  .get(function () { return this.depositAmount; })
  .set(function (v) { this.depositAmount = v; });

deviceSchema.virtual('rating').get(function () { return this.stats?.ratingAvg ?? 5.0; });
deviceSchema.virtual('reviewCount').get(function () { return this.stats?.ratingCount ?? 0; });
deviceSchema.virtual('viewsCount').get(function () { return this.stats?.rentalCount ?? 0; });

deviceSchema.virtual('approvalStatus')
  .get(function () { return this.moderationStatus; })
  .set(function (v) { this.moderationStatus = v; });

deviceSchema.index({ location: '2dsphere' });
deviceSchema.index({ category: 1, status: 1, isDeleted: 1 });
deviceSchema.index({ ownerId: 1, isDeleted: 1 });
deviceSchema.index({ name: 'text', brand: 'text', description: 'text' });

module.exports = mongoose.models.Device || mongoose.model('Device', deviceSchema, 'devices');
