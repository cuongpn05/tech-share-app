const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  bookingCode: { type: String, unique: true, sparse: true, index: true },
  deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true, index: true },
  renterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  ownerId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

  // 1. Thời gian thuê
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },

  // 2. Trạng thái Đơn & Thanh toán
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'active', 'completed', 'cancelled', 'disputed'],
    default: 'pending',
    index: true,
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'deposit_held', 'paid', 'refunded', 'disputed'],
    default: 'unpaid',
  },
  statusReason: { type: String, default: '' }, // Lý do hủy hoặc từ chối đơn

  // 3. Nhóm Chi tiết Tài chính (Gom 7 trường tiền tệ)
  pricing: {
    pricePerDayAtBooking: { type: Number, required: true },
    rentalFee: { type: Number, required: true },
    discountPercent: { type: Number, default: 0 },
    depositFee: { type: Number, required: true, default: 0 },
    voucherCode: { type: String, default: '' },
    voucherDiscount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
  },

  // 4. Nhóm Giao nhận
  delivery: {
    method: { type: String, enum: ['pickup', 'delivery'], default: 'pickup' },
    address: { type: String, default: '' },
  },

  // 5. Nhóm Bàn giao QR & Ảnh đối soát Trước/Sau
  handover: {
    qrToken: { type: String },
    beforePhotos: [{ type: String }],
    afterPhotos: [{ type: String }],
    beforeNote: { type: String, default: '' },
    afterNote: { type: String, default: '' },
  },

  // 6. Nhóm Yêu cầu Gia hạn Thuê
  extensionRequest: {
    requestedEndDate: { type: Date },
    requestedDays: { type: Number, default: 0 },
    additionalFee: { type: Number, default: 0 },
    status: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
  },

  // 7. Sơ đồ Tiến trình Timeline & Ẩn lịch sử (UC-R26, UC-R28)
  timeline: [
    {
      status: { type: String, required: true },
      timestamp: { type: Date, default: Date.now },
      note: { type: String, default: '' },
      _id: false,
    },
  ],
  isHiddenByRenter: { type: Boolean, default: false },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// --- VIRTUAL GETTERS & SETTERS 2 CHIỀU CHO CẢ APP & WEB ---
bookingSchema.virtual('totalDays').get(function () {
  if (!this.startDate || !this.endDate) return 1;
  return Math.max(1, Math.ceil((new Date(this.endDate) - new Date(this.startDate)) / (1000 * 60 * 60 * 24)));
});

// Mapping nhóm pricing <-> trường phẳng
['pricePerDayAtBooking', 'rentalFee', 'discountPercent', 'depositFee', 'voucherCode', 'voucherDiscount', 'totalAmount'].forEach((field) => {
  bookingSchema.virtual(field)
    .get(function () { return this.pricing?.[field]; })
    .set(function (v) { this.set(`pricing.${field}`, v); });
});

// Mapping tương thích thêm cho pricePerDay / depositValue
bookingSchema.virtual('pricePerDay')
  .get(function () { return this.pricing?.pricePerDayAtBooking; })
  .set(function (v) { this.set('pricing.pricePerDayAtBooking', v); });

bookingSchema.virtual('depositValue')
  .get(function () { return this.pricing?.depositFee; })
  .set(function (v) { this.set('pricing.depositFee', v); });

bookingSchema.virtual('device').get(function () { return this.deviceId; });
bookingSchema.virtual('renter').get(function () { return this.renterId; });
bookingSchema.virtual('owner').get(function () { return this.ownerId; });

// Mapping nhóm delivery <-> trường phẳng
bookingSchema.virtual('deliveryMethod')
  .get(function () { return this.delivery?.method ?? 'pickup'; })
  .set(function (v) { this.set('delivery.method', v); });

bookingSchema.virtual('deliveryAddress')
  .get(function () { return this.delivery?.address ?? ''; })
  .set(function (v) { this.set('delivery.address', v); });

// Mapping nhóm handover <-> trường phẳng của App
bookingSchema.virtual('qrToken')
  .get(function () { return this.handover?.qrToken; })
  .set(function (v) { this.set('handover.qrToken', v); });

bookingSchema.virtual('handoverPhotos')
  .get(function () {
    return {
      beforeRental: this.handover?.beforePhotos ?? [],
      afterRental: this.handover?.afterPhotos ?? [],
    };
  })
  .set(function (v) {
    if (v?.beforeRental) this.set('handover.beforePhotos', v.beforeRental);
    if (v?.afterRental) this.set('handover.afterPhotos', v.afterRental);
  });

bookingSchema.virtual('conditionNotes')
  .get(function () {
    return {
      before: this.handover?.beforeNote ?? '',
      after: this.handover?.afterNote ?? '',
    };
  })
  .set(function (v) {
    if (v?.before !== undefined) this.set('handover.beforeNote', v.before);
    if (v?.after !== undefined) this.set('handover.afterNote', v.after);
  });

bookingSchema.virtual('rejectReason')
  .get(function () { return this.status === 'rejected' ? this.statusReason : ''; })
  .set(function (v) { if (v) this.statusReason = v; });

bookingSchema.virtual('cancelReason')
  .get(function () { return this.status === 'cancelled' ? this.statusReason : ''; })
  .set(function (v) { if (v) this.statusReason = v; });

bookingSchema.index({ deviceId: 1, status: 1, startDate: 1, endDate: 1 });
bookingSchema.index({ renterId: 1, status: 1, createdAt: -1 });
bookingSchema.index({ ownerId: 1, status: 1, createdAt: -1 });
bookingSchema.index({ 'handover.qrToken': 1 }, { unique: true, sparse: true });

module.exports = mongoose.models.Booking || mongoose.model('Booking', bookingSchema, 'bookings');
