const Booking = require('../models/Booking');
const Device = require('../models/Device');
const User = require('../models/User');

const getBookingDate = booking =>
  new Date(booking.updatedAt || booking.endDate || booking.startDate);

const getRentalFee = booking => Number(booking.pricing?.rentalFee || 0);

const getOwnerAnalytics = async (req, res) => {
  try {
    const ownerId = req.auth.id;
    const [user, devices, bookings] = await Promise.all([
      User.findById(ownerId).lean(),
      Device.find({ ownerId, isDeleted: { $ne: true } }).lean(),
      Booking.find({ ownerId })
        .populate('deviceId', 'name brand category images pricePerDay')
        .populate('renterId', 'name avatar')
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const completedBookings = bookings.filter(booking => booking.status === 'completed');
    const activeBookings = bookings.filter(booking => booking.status === 'active');
    const approvedBookings = bookings.filter(booking => booking.status === 'approved');
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const previousMonthDate = new Date(currentYear, currentMonth - 1, 1);
    let totalRevenue = 0;
    let monthlyRevenue = 0;
    let previousMonthRevenue = 0;

    completedBookings.forEach(booking => {
      const fee = getRentalFee(booking);
      const bookingDate = getBookingDate(booking);
      totalRevenue += fee;

      if (bookingDate.getFullYear() === currentYear && bookingDate.getMonth() === currentMonth) {
        monthlyRevenue += fee;
      } else if (
        bookingDate.getFullYear() === previousMonthDate.getFullYear() &&
        bookingDate.getMonth() === previousMonthDate.getMonth()
      ) {
        previousMonthRevenue += fee;
      }
    });

    const monthlyGrowth = previousMonthRevenue > 0
      ? Number((((monthlyRevenue - previousMonthRevenue) / previousMonthRevenue) * 100).toFixed(1))
      : monthlyRevenue > 0 ? 100 : 0;

    const rentedDeviceIds = new Set([
      ...devices
        .filter(device => device.status === 'rented')
        .map(device => device._id.toString()),
      ...activeBookings
        .map(booking => booking.deviceId?._id?.toString() || booking.deviceId?.toString())
        .filter(Boolean),
    ]);
    const totalDevices = devices.length;
    const rentedDevices = rentedDeviceIds.size;
    const availableDevices = devices.filter(device => device.status === 'available').length;
    const calculatedEscrow = [...approvedBookings, ...activeBookings].reduce(
      (sum, booking) => sum + Number(booking.pricing?.depositFee || 0),
      0,
    );

    const revenueByDay = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const day = new Date();
      day.setDate(day.getDate() - offset);
      day.setHours(0, 0, 0, 0);
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);
      const revenue = completedBookings.reduce((sum, booking) => {
        const bookingDate = getBookingDate(booking);
        return bookingDate >= day && bookingDate < nextDay ? sum + getRentalFee(booking) : sum;
      }, 0);

      revenueByDay.push({
        date: day.toISOString().slice(0, 10),
        day: day.toLocaleDateString('en-US', { weekday: 'short' }),
        revenue,
      });
    }

    const deviceStats = new Map();
    completedBookings.forEach(booking => {
      const deviceId = booking.deviceId?._id?.toString() || booking.deviceId?.toString();
      if (!deviceId) return;
      const stats = deviceStats.get(deviceId) || { count: 0, revenue: 0 };
      stats.count += 1;
      stats.revenue += getRentalFee(booking);
      deviceStats.set(deviceId, stats);
    });

    const enrichedDevices = devices.map(device => {
      const stats = deviceStats.get(device._id.toString()) || { count: 0, revenue: 0 };
      return {
        _id: device._id,
        name: device.name,
        status: rentedDeviceIds.has(device._id.toString()) ? 'rented' : device.status,
        rentalCount: device.stats?.rentalCount || stats.count,
        revenueTotal: device.stats?.revenueTotal || stats.revenue,
      };
    });
    const rentalPayments = completedBookings.map(booking => ({
      _id: booking._id,
      rentalFee: getRentalFee(booking),
      startDate: booking.startDate,
      endDate: booking.endDate,
      updatedAt: booking.updatedAt,
      deviceId: booking.deviceId,
      renterId: booking.renterId,
    }));

    return res.status(200).json({
      success: true,
      data: {
        totalRevenue,
        monthlyRevenue,
        monthlyGrowth,
        totalDevices,
        totalBookings: bookings.length,
        completedBookingsCount: completedBookings.length,
        rentedDevices,
        availableDevices,
        utilizationRate: totalDevices ? Number(((rentedDevices / totalDevices) * 100).toFixed(1)) : 0,
        walletBalance: Number(user?.wallet?.balance || 0),
        escrowHolding: Number(user?.wallet?.escrowBalance || calculatedEscrow),
        rating: Number(user?.rating ?? 5),
        trustScore: Number(user?.trust?.score ?? 100),
        totalReviews: Number(user?.totalReviews || 0),
        revenueByDay,
        devices: enrichedDevices,
        bookings: rentalPayments,
      },
    });
  } catch (error) {
    console.error('Get owner analytics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to load owner analytics.',
    });
  }
};

module.exports = { getOwnerAnalytics };
