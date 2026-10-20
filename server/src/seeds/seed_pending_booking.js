const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const User = require('../models/User');
  const Device = require('../models/Device');
  const Booking = require('../models/Booking');

  const owner1 = await User.findOne({ username: 'owner1' });
  const renter2 = await User.findOne({ username: 'renter2' });
  const dev = await Device.findOne({ ownerId: owner1._id, isDeleted: false });

  if (dev && owner1 && renter2) {
    const existing = await Booking.findOne({ ownerId: owner1._id, status: 'pending' });
    if (!existing) {
      const code = 'B' + Date.now().toString().slice(-6) + '101';
      await Booking.create({
        bookingCode: code,
        qrToken: `TSQR-${code}-PND1`,
        deviceId: dev._id,
        renterId: renter2._id,
        ownerId: owner1._id,
        startDate: new Date(Date.now() + 86400000),
        endDate: new Date(Date.now() + 86400000 * 4),
        totalDays: 3,
        pricePerDayAtBooking: dev.pricePerDay || 350000,
        rentalFee: (dev.pricePerDay || 350000) * 3,
        depositFee: dev.depositAmount || 5000000,
        totalAmount: Math.round((dev.pricePerDay || 350000) * 3 * 0.9 + (dev.depositAmount || 5000000)),
        discountPercent: 10,
        deliveryMethod: 'delivery',
        deliveryAddress: renter2.address || 'Quận 1, TP. Hồ Chí Minh',
        status: 'pending',
        paymentStatus: 'unpaid',
        timeline: [{ status: 'pending', timestamp: new Date(), note: 'Khách hàng gửi yêu cầu thuê thiết bị' }],
      });
      console.log('✅ Created pending booking for owner1:', code);
    } else {
      console.log('ℹ️ Owner1 already has a pending booking:', existing.bookingCode);
    }
  }

  // Also check if owner2 has pending booking (already has B081537314)
  const owner2 = await User.findOne({ username: 'owner2' });
  const b2 = await Booking.findOne({ ownerId: owner2?._id, status: 'pending' });
  console.log('Owner2 pending booking:', b2?.bookingCode);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
