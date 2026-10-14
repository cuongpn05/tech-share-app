const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Device = require('../models/Device');
const User = require('../models/User');
const EkycRequest = require('../models/EkycRequest');
const { createAndSendNotification } = require('../services/notificationService');

// @desc    Create new booking
// @route   POST /api/bookings
// @access  Private
const createBooking = async (req, res) => {
  try {
    const { deviceId, startDate, endDate, deliveryMethod, deliveryAddress } = req.body;

    if (!deviceId || !startDate || !endDate) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
    }

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ message: 'Không tìm thấy thiết bị' });
    }

    const renterId = (req.auth && (req.auth.id || req.auth._id)) || (req.user && req.user._id);
    const userRole = (req.auth && req.auth.role) || (req.user && req.user.role) || 'renter';

    if (userRole === 'renter') {
      const user = await User.findById(renterId);
      if (!user?.isVerified) {
        const isIdentityVerified = await EkycRequest.exists({
          userId: renterId,
          status: 'approved',
        });
        if (!isIdentityVerified) {
          return res.status(403).json({
            success: false,
            code: 'RENTER_EKYC_REQUIRED',
            message: 'Bạn cần hoàn tất Xác thực người dùng thực trước khi thuê thiết bị.',
          });
        }
      }
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      return res.status(400).json({ message: 'Thời gian trả máy phải sau thời gian nhận máy' });
    }

    const conflictingBooking = await Booking.findOne({
      deviceId: device._id,
      status: { $in: ['active', 'approved', 'pending'] },
      startDate: { $lt: end },
      endDate: { $gt: start },
    });

    if (conflictingBooking) {
      const fromStr = new Date(conflictingBooking.startDate).toLocaleDateString('vi-VN');
      const toStr = new Date(conflictingBooking.endDate).toLocaleDateString('vi-VN');
      let statusText = 'đang được thuê';
      if (conflictingBooking.status === 'approved') statusText = 'đã được duyệt cho thuê';
      if (conflictingBooking.status === 'pending') statusText = 'đã có người đặt (đang chờ duyệt)';
      return res.status(400).json({
        message: `Thiết bị ${statusText} trong khoảng thời gian (${fromStr} - ${toStr}). Vui lòng chọn thời gian khác!`,
      });
    }

    if (Array.isArray(device.blockedDates)) {
      const conflictBlocked = device.blockedDates.find((b) => {
        const bStart = new Date(b.startDate);
        const bEnd = new Date(b.endDate);
        if (bEnd.getHours() === 0 && bEnd.getMinutes() === 0 && bEnd.getSeconds() === 0) {
          bEnd.setHours(23, 59, 59, 999);
        }
        return start < bEnd && end > bStart;
      });

      if (conflictBlocked) {
        const fromStr = new Date(conflictBlocked.startDate).toLocaleDateString('vi-VN');
        const toStr = new Date(conflictBlocked.endDate).toLocaleDateString('vi-VN');
        return res.status(400).json({
          message: `Chủ máy bận hoặc thiết bị không sẵn sàng trong khoảng thời gian (${fromStr} - ${toStr}). Vui lòng chọn thời gian khác!`,
        });
      }
    }

    const diffTime = Math.abs(end.getTime() - start.getTime());
    let totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (totalDays === 0) totalDays = 1;

    const pricePerDayAtBooking = device.pricePerDay || device.dailyRate;
    const rentalFee = totalDays * pricePerDayAtBooking;
    const depositFee = device.depositAmount || device.depositValue || 0;

    // Apply long-term discount
    let discountPercent = 0;
    if (totalDays >= 7) {
      discountPercent = 20;
    } else if (totalDays >= 3) {
      discountPercent = 10;
    }

    const longTermDiscountAmount = (rentalFee * discountPercent) / 100;
    let baseAmountAfterDiscount = rentalFee - longTermDiscountAmount;

    const totalAmount = baseAmountAfterDiscount + depositFee;

    const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const bookingCode = 'B' + Date.now().toString().slice(-6) + randomSuffix;
    const qrToken = `TSQR-${bookingCode}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const ownerId = device.ownerId || device.owner;

    const booking = await Booking.create({
      bookingCode,
      qrToken,
      deviceId,
      renterId,
      ownerId,
      startDate,
      endDate,
      totalDays,
      pricePerDayAtBooking,
      rentalFee,
      discountPercent,
      depositFee,
      totalAmount,
      deliveryMethod: deliveryMethod || 'pickup',
      deliveryAddress: deliveryAddress || '',
      status: 'pending',
      paymentStatus: 'unpaid',
      timeline: [{ status: 'pending', timestamp: new Date(), note: 'Đã tạo yêu cầu thuê' }],
    });

    if (ownerId) {
      const renter = await User.findById(renterId).select('name');
      const renterName = renter?.name || 'Khách thuê';
      createAndSendNotification({
        userId: ownerId,
        title: 'Yêu cầu thuê thiết bị mới! 📦',
        body: `Khách hàng ${renterName} vừa gửi yêu cầu thuê "${device.name}" (${totalDays} ngày). Mã đơn: #${bookingCode}. Nhấn để xem và duyệt đơn.`,
        type: 'order',
        relatedId: booking._id,
        data: {
          bookingId: booking._id.toString(),
          deviceId: device._id.toString(),
          status: 'pending',
        },
      }).catch((err) => console.error('❌ Lỗi gửi thông báo cho chủ máy:', err.message));
    }

    res.status(201).json(booking);
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi tạo booking', error: error.message });
  }
};

// @desc    Get busy date ranges for a device
// @route   GET /api/bookings/busy-dates/:deviceId
// @access  Public
const getDeviceBusyDates = async (req, res) => {
  try {
    const { deviceId } = req.params;

    if (!deviceId || !mongoose.Types.ObjectId.isValid(deviceId)) {
      return res.status(400).json({
        success: false,
        message: 'Mã thiết bị không hợp lệ',
        busyRanges: [],
        bookedBookings: [],
        blockedDates: [],
      });
    }

    const device = await Device.findById(deviceId).select('blockedDates name ownerId');
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thiết bị',
        busyRanges: [],
        bookedBookings: [],
        blockedDates: [],
      });
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const busyBookings = await Booking.find({
      deviceId,
      status: { $in: ['active', 'approved', 'pending'] },
      endDate: { $gte: startOfToday },
    })
      .select('startDate endDate status bookingCode')
      .sort({ startDate: 1 });

    const bookedBookings = busyBookings.map((b) => ({
      _id: b._id,
      startDate: b.startDate,
      endDate: b.endDate,
      status: b.status,
      bookingCode: b.bookingCode,
      type: 'booking',
    }));

    const blockedDates = (device.blockedDates || [])
      .filter((b) => {
        if (!b.endDate) return false;
        const end = new Date(b.endDate);
        if (end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0) {
          end.setHours(23, 59, 59, 999);
        }
        return end >= startOfToday;
      })
      .map((b) => ({
        _id: b._id,
        startDate: b.startDate,
        endDate: b.endDate,
        status: 'owner_blocked',
        reason: b.reason || 'Chủ máy bận',
        type: 'blocked',
      }));

    const busyRanges = [...bookedBookings, ...blockedDates].sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );

    return res.status(200).json({
      success: true,
      busyRanges,
      bookedBookings,
      blockedDates,
    });
  } catch (error) {
    console.error('Error getting device busy dates:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi tải lịch bận của thiết bị',
      error: error.message,
    });
  }
};

// @desc    Get my bookings
// @route   GET /api/bookings/my-bookings
// @access  Private
const getMyBookings = async (req, res) => {
  try {
    const renterId = (req.auth && (req.auth.id || req.auth._id)) || (req.user && req.user._id);
    const { status } = req.query;

    let query = { renterId };
    if (status) {
      query.status = status;
    }

    const bookings = await Booking.find(query)
      .populate('deviceId', 'name images brand category pricePerDay dailyRate depositAmount depositValue')
      .populate('ownerId', 'name avatar phone email')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: bookings });
  } catch (error) {
    console.error('Error getting my bookings:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh sách đơn' });
  }
};

// @desc    Get booking details by ID
// @route   GET /api/bookings/:id
// @access  Private
const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('deviceId', 'name images brand category pricePerDay dailyRate depositAmount depositValue location addressText')
      .populate('ownerId', 'name avatar phone email rating')
      .populate('renterId', 'name avatar phone email rating isVerified trustScore');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn thuê' });
    }

    res.status(200).json({ success: true, data: booking });
  } catch (error) {
    console.error('Error getting booking by id:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy thông tin đơn' });
  }
};

module.exports = {
  createBooking,
  getDeviceBusyDates,
  getMyBookings,
  getBookingById,
};
