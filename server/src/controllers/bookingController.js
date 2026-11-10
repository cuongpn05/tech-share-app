const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Device = require('../models/Device');
const User = require('../models/User');
const Review = require('../models/Review');
const EkycRequest = require('../models/EkycRequest');
const { createAndSendNotification } = require('../services/notificationService');
const { uploadToCloudinary } = require('../utils/cloudinary');

// @desc    Create new booking
// @route   POST /api/bookings
// @access  Private
const createBooking = async (req, res) => {
  try {
    const { deviceId, startDate, endDate, deliveryMethod, deliveryAddress } = req.body;

    if (!deviceId || !startDate || !endDate) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
    }

    const device = await Device.findOne({ _id: deviceId, isDeleted: false });
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
    const totalHours = Math.max(1, Math.round(diffTime / (1000 * 60 * 60)));

    // Ràng buộc thời gian thuê tối thiểu 12 giờ
    if (totalHours < 12) {
      return res.status(400).json({
        success: false,
        message: 'Thời gian thuê tối thiểu là 12 giờ. Vui lòng chọn thời gian trả sau ít nhất 12 giờ.',
      });
    }

    let totalDays = Math.max(1, Math.ceil(totalHours / 24));

    const pricePerDayAtBooking = device.pricePerDay || device.dailyRate;
    // Tính tiền chính xác theo giờ: (giá thuê 1 ngày / 24h) * số giờ thuê thực tế
    const hourlyRate = pricePerDayAtBooking / 24;
    const rentalFee = Math.round(hourlyRate * totalHours);
    const depositFee = device.depositAmount || device.depositValue || 0;

    // Apply long-term discount (72h = 3 ngày: giảm 10%, 168h = 7 ngày: giảm 20%)
    let discountPercent = 0;
    if (totalHours >= 168) {
      discountPercent = 20;
    } else if (totalHours >= 72) {
      discountPercent = 10;
    }

    const longTermDiscountAmount = Math.round((rentalFee * discountPercent) / 100);
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
      const renterName = renter?.name || 'Customer';
      await createAndSendNotification({
        userId: ownerId,
        title: 'New Rental Request! 📦',
        body: `Customer ${renterName} requested to rent "${device.name}" (${totalDays} day(s)). Order code: #${bookingCode}. Tap to review and approve.`,
        type: 'order',
        relatedId: booking._id,
        data: {
          bookingId: booking._id.toString(),
          deviceId: device._id.toString(),
          status: 'pending',
          bookingCode,
        },
      }).catch((err) => console.error('❌ Error sending notification to owner:', err.message));
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
      .populate('deviceId', 'name images brand model category pricePerDay dailyRate depositAmount depositValue')
      .populate('ownerId', 'name avatar phone email')
      .sort({ createdAt: -1 });

    // Ensure isReviewed status is accurate for completed bookings
    const completedUnreviewedIds = bookings
      .filter((b) => b.status === 'completed' && !b.isReviewed)
      .map((b) => b._id);

    if (completedUnreviewedIds.length > 0) {
      try {
        const existingReviews = await Review.find({ bookingId: { $in: completedUnreviewedIds } }).select('bookingId');
        const reviewedBookingIds = new Set(existingReviews.map((r) => r.bookingId.toString()));

        for (const b of bookings) {
          if (reviewedBookingIds.has(b._id.toString())) {
            b.isReviewed = true;
            Booking.updateOne({ _id: b._id }, { isReviewed: true }).exec();
          }
        }
      } catch (syncErr) {
        console.warn('Error syncing isReviewed in getMyBookings:', syncErr.message);
      }
    }

    res.status(200).json({ success: true, data: bookings });
  } catch (error) {
    console.error('Error getting my bookings:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh sách đơn' });
  }
};

// @desc    Cancel a booking
// @route   PUT /api/bookings/:id/cancel
// @access  Private
const cancelBooking = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { reason } = req.body;
    const userId = (req.auth && (req.auth.id || req.auth._id)) || (req.user && req.user._id);

    const booking = await Booking.findOne({ _id: bookingId, renterId: userId });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn thuê' });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Chỉ có thể hủy đơn đang chờ duyệt' });
    }

    booking.status = 'cancelled';
    booking.cancelReason = reason || 'Người thuê đã hủy đơn';
    booking.timeline.push({
      status: 'cancelled',
      note: `Người thuê đã hủy đơn. Lý do: ${reason || 'Không có'}`,
    });

    await booking.save();

    // Bắn thông báo chi tiết cho chủ máy khi khách hủy đơn
    if (booking.ownerId) {
      const renter = await User.findById(userId).select('name');
      const renterName = renter?.name || 'Customer';
      const dev = await Device.findById(booking.deviceId).select('name');
      const deviceName = dev?.name || 'device';
      createAndSendNotification({
        userId: booking.ownerId,
        title: 'Booking Cancelled ⚠️',
        body: `Customer ${renterName} cancelled rental order "${deviceName}" (#${booking.bookingCode}). Equipment schedule has been released.`,
        type: 'order',
        relatedId: booking._id,
        data: {
          bookingId: booking._id.toString(),
          status: 'cancelled',
          bookingCode: booking.bookingCode,
        },
      }).catch((err) => console.error('❌ Error sending notification to owner:', err.message));
    }

    res.status(200).json({ success: true, data: booking });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi hủy đơn' });
  }
};

// @desc    Get booking details by ID
// @route   GET /api/bookings/:id
// @access  Private
const getBookingById = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const userId = (req.auth && (req.auth.id || req.auth._id)) || (req.user && req.user._id);
    const userRole = (req.auth && req.auth.role) || (req.user && req.user.role);

    const booking = await Booking.findById(bookingId)
      .populate(
        'deviceId',
        'name images brand model category pricePerDay dailyRate depositAmount depositValue description condition location addressText ownerId'
      )
      .populate('ownerId', 'name avatar phone email rating totalReviews trust isVerified')
      .populate('renterId', 'name username avatar phone email rating totalReviews isVerified trust trustScore address');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn thuê' });
    }

    if (!booking.qrToken) {
      booking.qrToken = `TSQR-${booking.bookingCode}-${booking._id.toString().slice(-4).toUpperCase()}`;
      await booking.save();
    }

    // Sync isReviewed & isRenterReviewed for completed booking if reviews already exist
    if (booking.status === 'completed' && (!booking.isReviewed || !booking.isRenterReviewed)) {
      try {
        const existingReviews = await Review.find({ bookingId: booking._id });
        const updateFields = {};
        for (const rev of existingReviews) {
          if (rev.targetType === 'renter') {
            booking.isRenterReviewed = true;
            booking.renterReviewId = rev._id;
            updateFields.isRenterReviewed = true;
            updateFields.renterReviewId = rev._id;
          } else {
            booking.isReviewed = true;
            booking.reviewId = rev._id;
            updateFields.isReviewed = true;
            updateFields.reviewId = rev._id;
          }
        }
        if (Object.keys(updateFields).length > 0) {
          await Booking.updateOne({ _id: booking._id }, updateFields);
        }
      } catch (revErr) {
        console.warn('Error syncing review flags in getBookingById:', revErr.message);
      }
    }

    const userIdStr = userId ? userId.toString() : '';
    const renterIdStr = booking.renterId?._id ? booking.renterId._id.toString() : booking.renterId?.toString();
    const ownerIdStr = booking.ownerId?._id ? booking.ownerId._id.toString() : booking.ownerId?.toString();
    const deviceOwnerIdStr = booking.deviceId?.ownerId ? booking.deviceId.ownerId.toString() : '';
    const isRenter = renterIdStr === userIdStr;
    const isOwner = ownerIdStr === userIdStr || (deviceOwnerIdStr && deviceOwnerIdStr === userIdStr);
    const isAdmin = userRole === 'admin';

    if (!isRenter && !isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xem đơn thuê này' });
    }

    res.status(200).json({ success: true, data: booking });
  } catch (error) {
    console.error('Error getting booking by id:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy thông tin đơn' });
  }
};

// @desc    Request rental extension
// @route   POST /api/bookings/:id/extend
// @access  Private
const requestExtension = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { additionalDays, requestedDays } = req.body;
    const userId = (req.auth && (req.auth.id || req.auth._id)) || (req.user && req.user._id);

    const days = Number(additionalDays ?? requestedDays);
    if (!Number.isInteger(days) || days <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Số ngày gia hạn không hợp lệ (tối thiểu 1 ngày)',
      });
    }

    const booking = await Booking.findOne({ _id: bookingId, renterId: userId }).populate('deviceId');
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn thuê của bạn' });
    }

    if (booking.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể gửi yêu cầu gia hạn cho đơn thuê đang trong thời gian sử dụng (active)',
      });
    }

    if (booking.extensionRequest && booking.extensionRequest.status === 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Đơn thuê này đang có một yêu cầu gia hạn chờ chủ máy phê duyệt',
      });
    }

    const currentEndDate = new Date(booking.endDate);
    const newEndDate = new Date(currentEndDate.getTime() + days * 24 * 60 * 60 * 1000);
    const dailyRate =
      booking.pricePerDayAtBooking ||
      booking.deviceId?.dailyRate ||
      booking.deviceId?.pricePerDay ||
      (booking.totalDays > 0 ? Math.round(booking.rentalFee / booking.totalDays) : 0);

    const additionalFee = Math.round(days * dailyRate);
    if (!Number.isFinite(additionalFee) || additionalFee < 0) {
      return res.status(400).json({
        success: false,
        message: 'Phụ phí gia hạn không hợp lệ',
      });
    }

    booking.extensionRequest = {
      requestedEndDate: newEndDate,
      requestedDays: days,
      additionalFee,
      requestedAt: new Date(),
      status: 'pending',
    };

    booking.timeline.push({
      status: 'extension_requested',
      timestamp: new Date(),
      note: `Yêu cầu gia hạn thêm ${days} ngày (đến ${newEndDate.toLocaleDateString('vi-VN')}), phụ phí: ${additionalFee.toLocaleString('vi-VN')} đ`,
    });

    await booking.save();

    // Gửi thông báo đến chủ máy
    if (booking.ownerId) {
      createAndSendNotification({
        userId: booking.ownerId,
        title: 'Rental Extension Request! ⏳',
        body: `Customer requested an extension of ${days} day(s) for order #${booking.bookingCode}. Additional fee: ${additionalFee.toLocaleString('en-US')} VND.`,
        type: 'order',
        relatedId: booking._id,
        data: {
          bookingId: booking._id.toString(),
          status: 'extension_requested',
        },
      }).catch((err) => console.error('❌ Lỗi gửi thông báo gia hạn cho chủ máy:', err.message));
    }

    return res.status(200).json({
      success: true,
      message: 'Đã gửi yêu cầu gia hạn đơn thuê thành công',
      data: booking,
    });
  } catch (error) {
    console.error('Error requesting extension:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi gửi yêu cầu gia hạn',
      error: error.message,
    });
  }
};

const getExtensionRequests = async (req, res) => {
  try {
    const userRole = req.userRole || req.auth?.role;
    const userId = req.auth?.id || req.auth?._id || req.user?._id;
    const { status = 'pending' } = req.query;

    if (!['all', 'pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái yêu cầu gia hạn không hợp lệ' });
    }

    const query = { 'extensionRequest.status': { $in: ['pending', 'approved', 'rejected'] } };
    if (status !== 'all') query['extensionRequest.status'] = status;
    if (userRole !== 'admin') query.ownerId = userId;

    const bookings = await Booking.find(query)
      .populate('deviceId', 'name images brand model category pricePerDay dailyRate')
      .populate('renterId', 'name username email phone avatar')
      .populate('ownerId', 'name username email phone avatar')
      .sort({ 'extensionRequest.requestedAt': -1, updatedAt: -1 });

    return res.status(200).json({ success: true, count: bookings.length, data: bookings });
  } catch (error) {
    console.error('Error getting extension requests:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh sách yêu cầu gia hạn' });
  }
};

const getExtensionRequestById = async (req, res) => {
  try {
    const userRole = req.userRole || req.auth?.role;
    const userId = req.auth?.id || req.auth?._id || req.user?._id;
    const query = {
      _id: req.params.id,
      'extensionRequest.status': { $in: ['pending', 'approved', 'rejected'] },
    };
    if (userRole !== 'admin') query.ownerId = userId;

    const booking = await Booking.findOne(query)
      .populate('deviceId', 'name images brand model category pricePerDay dailyRate')
      .populate('renterId', 'name username email phone avatar')
      .populate('ownerId', 'name username email phone avatar');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu gia hạn' });
    }

    return res.status(200).json({ success: true, data: booking });
  } catch (error) {
    console.error('Error getting extension request:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy chi tiết yêu cầu gia hạn' });
  }
};

const respondToExtensionRequest = async (req, res) => {
  try {
    const userRole = req.userRole || req.auth?.role;
    const userId = req.auth?.id || req.auth?._id || req.user?._id;
    const { action } = req.params;
    const { reason } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Thao tác yêu cầu gia hạn không hợp lệ' });
    }

    const accessQuery = { _id: req.params.id };
    if (userRole !== 'admin') accessQuery.ownerId = userId;
    const booking = await Booking.findOne(accessQuery)
      .populate('deviceId', 'name blockedDates isDeleted ownerId')
      .populate('renterId', 'name username');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn thuê hoặc bạn không có quyền xử lý' });
    }
    if (booking.extensionRequest?.status !== 'pending') {
      return res.status(409).json({ success: false, message: 'Yêu cầu gia hạn đã được xử lý hoặc không còn chờ duyệt' });
    }

    const updateQuery = { _id: booking._id, 'extensionRequest.status': 'pending' };
    if (userRole !== 'admin') updateQuery.ownerId = userId;

    let update;
    let message;
    if (action === 'approve') {
      updateQuery.status = 'active';
      updateQuery.endDate = booking.endDate;
      if (booking.status !== 'active') {
        return res.status(409).json({ success: false, message: 'Chỉ đơn thuê đang sử dụng mới đủ điều kiện gia hạn' });
      }

      const currentEndDate = new Date(booking.endDate);
      const requestedDays = Number(booking.extensionRequest.requestedDays);
      const additionalFee = Number(booking.extensionRequest.additionalFee);
      if (!Number.isInteger(requestedDays) || requestedDays <= 0 ||
          !Number.isFinite(additionalFee) || additionalFee < 0 ||
          Number.isNaN(currentEndDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Thông tin thời hạn hoặc phụ phí gia hạn không hợp lệ' });
      }

      const proposedEndDate = new Date(currentEndDate.getTime() + requestedDays * 24 * 60 * 60 * 1000);
      const storedEndDate = new Date(booking.extensionRequest.requestedEndDate);
      if (Number.isNaN(storedEndDate.getTime()) || storedEndDate.getTime() !== proposedEndDate.getTime()) {
        return res.status(409).json({ success: false, message: 'Ngày kết thúc đề xuất không khớp với số ngày gia hạn' });
      }

      const device = booking.deviceId;
      if (!device || device.isDeleted || String(device.ownerId) !== String(booking.ownerId)) {
        return res.status(409).json({ success: false, message: 'Thiết bị không còn đủ điều kiện cho thuê' });
      }

      const conflictingBooking = await Booking.exists({
        _id: { $ne: booking._id },
        deviceId: booking.deviceId._id,
        status: { $in: ['active', 'approved', 'pending'] },
        startDate: { $lt: proposedEndDate },
        endDate: { $gt: currentEndDate },
      });
      if (conflictingBooking) {
        return res.status(409).json({ success: false, message: 'Lịch thuê đã bị trùng trong thời gian gia hạn đề xuất' });
      }

      const blockedDate = (device.blockedDates || []).find((blocked) => {
        const blockedStart = new Date(blocked.startDate);
        const blockedEnd = new Date(blocked.endDate);
        if (blockedEnd.getHours() === 0 && blockedEnd.getMinutes() === 0 && blockedEnd.getSeconds() === 0) {
          blockedEnd.setHours(23, 59, 59, 999);
        }
        return currentEndDate < blockedEnd && proposedEndDate > blockedStart;
      });
      if (blockedDate) {
        return res.status(409).json({ success: false, message: 'Thiết bị có ngày bận trong khoảng thời gian gia hạn đề xuất' });
      }

      update = {
        $set: { endDate: proposedEndDate, 'extensionRequest.status': 'approved' },
        $push: {
          timeline: {
            status: 'extension_approved',
            timestamp: new Date(),
            note: `Đã duyệt gia hạn ${requestedDays} ngày, phụ phí ${additionalFee.toLocaleString('vi-VN')} đ`,
          },
        },
      };
      message = 'Đã phê duyệt yêu cầu gia hạn';
    } else {
      const rejectionReason = typeof reason === 'string' ? reason.trim().slice(0, 500) : '';
      update = {
        $set: { 'extensionRequest.status': 'rejected' },
        $push: {
          timeline: {
            status: 'extension_rejected',
            timestamp: new Date(),
            note: rejectionReason
              ? `Đã từ chối yêu cầu gia hạn: ${rejectionReason}`
              : 'Đã từ chối yêu cầu gia hạn',
          },
        },
      };
      message = 'Đã từ chối yêu cầu gia hạn';
    }

    const updatedBooking = await Booking.findOneAndUpdate(updateQuery, update, {
      new: true,
      runValidators: true,
    })
      .populate('deviceId', 'name images brand model category pricePerDay dailyRate')
      .populate('renterId', 'name username email phone avatar')
      .populate('ownerId', 'name username email phone avatar');

    if (!updatedBooking) {
      return res.status(409).json({ success: false, message: 'Yêu cầu gia hạn vừa được xử lý bởi người khác' });
    }

    const renterId = updatedBooking.renterId?._id || updatedBooking.renterId;
    const deviceName = updatedBooking.deviceId?.name || 'thiết bị';
    const rejectionReason = typeof reason === 'string' ? reason.trim().slice(0, 500) : '';
    const notificationResult = await createAndSendNotification({
      userId: renterId,
      title: action === 'approve' ? 'Extension Request Approved! 🎉' : 'Extension Request Declined ❌',
      body: action === 'approve'
        ? `Extension request of ${updatedBooking.extensionRequest.requestedDays} day(s) for "${deviceName}" (Order #${updatedBooking.bookingCode}) was approved.`
        : `Extension request of ${updatedBooking.extensionRequest.requestedDays} day(s) for "${deviceName}" (Order #${updatedBooking.bookingCode}) was declined.${rejectionReason ? ` Reason: ${rejectionReason}` : ''}`,
      type: 'order',
      relatedId: updatedBooking._id,
      data: {
        bookingId: updatedBooking._id.toString(),
        status: `extension_${action === 'approve' ? 'approved' : 'rejected'}`,
        bookingCode: updatedBooking.bookingCode,
      },
    });
    if (!notificationResult.success) {
      console.error('Failed to notify renter about extension decision:', notificationResult.message || notificationResult.error);
    }

    return res.status(200).json({ success: true, message, data: updatedBooking });
  } catch (error) {
    console.error('Error responding to extension request:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xử lý yêu cầu gia hạn' });
  }
};

// @desc    Update beforeRental handover photos & condition notes
// @route   PATCH /api/bookings/:id/handover-renter
// @access  Private
const updateBeforeRentalPhotos = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { photos, conditionNotes } = req.body;
    const userId = (req.auth && (req.auth.id || req.auth._id)) || (req.user && req.user._id);
    const userRole = (req.auth && req.auth.role) || (req.user && req.user.role);

    if (!Array.isArray(photos) || photos.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp ít nhất 1 ảnh góc máy lúc nhận bàn giao.',
      });
    }

    const booking = await Booking.findById(bookingId)
      .populate('deviceId', 'name images brand')
      .populate('renterId', 'name avatar')
      .populate('ownerId', 'name avatar');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn thuê' });
    }

    const renterIdStr = booking.renterId?._id ? booking.renterId._id.toString() : booking.renterId?.toString();
    const ownerIdStr = booking.ownerId?._id ? booking.ownerId._id.toString() : booking.ownerId?.toString();

    let resolvedUserId = userId ? userId.toString() : '';
    const userDoc = await User.findOne({
      $or: [{ _id: userId }, { accountId: userId }],
    }).select('_id').lean().catch(() => null);
    if (userDoc && userDoc._id) {
      resolvedUserId = userDoc._id.toString();
    }

    const isRenter = renterIdStr === resolvedUserId || renterIdStr === (userId ? userId.toString() : '');
    const isAdmin = userRole === 'admin';

    if (!isRenter && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only the renter can upload before-rental handover photos when the booking is approved.',
      });
    }

    if (booking.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể tải lên ảnh hiện trạng lúc nhận bàn giao khi đơn ở trạng thái đã duyệt (approved). Khi đơn đã kích hoạt (active) hoặc hoàn tất, biên bản bàn giao không thể chỉnh sửa.',
      });
    }

    // Chuẩn hóa và tự động upload lên Cloudinary nếu ảnh được gửi dưới dạng Base64
    const resolvedPhotos = await Promise.all(
      photos.map(async (photoStr) => {
        if (!photoStr || typeof photoStr !== 'string') return '';
        if (
          photoStr.startsWith('data:image/') ||
          (!photoStr.startsWith('http://') &&
            !photoStr.startsWith('https://') &&
            !photoStr.startsWith('/uploads/') &&
            !photoStr.startsWith('file://') &&
            photoStr.length > 300)
        ) {
          const cldUrl = await uploadToCloudinary(photoStr, 'techshare/handover');
          return cldUrl || photoStr;
        }
        return photoStr;
      })
    );
    const validPhotos = resolvedPhotos.filter(Boolean);

    if (!booking.handover) {
      booking.handover = { beforePhotos: [], afterPhotos: [], beforeNote: '', afterNote: '' };
    }
    booking.handover.beforePhotos = validPhotos;
    if (conditionNotes !== undefined) {
      booking.handover.beforeNote = conditionNotes;
    }

    booking.set('handover.beforePhotos', validPhotos);
    if (conditionNotes !== undefined) {
      booking.set('handover.beforeNote', conditionNotes);
    }
    booking.markModified('handover');

    booking.timeline.push({
      status: booking.status,
      timestamp: new Date(),
      note: `Đã cập nhật ${validPhotos.length} ảnh hiện trạng thiết bị lúc nhận bàn giao (beforeRental).`,
    });

    await booking.save();

    return res.status(200).json({
      success: true,
      message: 'Đã lưu ảnh nhận bàn giao thiết bị thành công',
      data: booking,
    });
  } catch (error) {
    console.error('Error updating beforeRental photos:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lưu ảnh nhận bàn giao',
      error: error.message,
    });
  }
};

// @desc    Update afterRental return inspection photos & condition notes by Owner (ONLY when active)
// @route   PATCH /api/bookings/:id/handover-owner
// @access  Private (Owner)
const updateAfterRentalPhotos = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { photos, conditionNotes } = req.body;
    const userId = (req.auth && (req.auth.id || req.auth._id)) || (req.user && req.user._id);
    const userRole = (req.auth && req.auth.role) || (req.user && req.user.role);

    if (!Array.isArray(photos) || photos.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least 1 device return inspection photo.',
      });
    }

    const booking = await Booking.findById(bookingId)
      .populate('deviceId', 'name images brand ownerId')
      .populate('renterId', 'name avatar')
      .populate('ownerId', 'name avatar');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    let resolvedOwnerId = userId ? userId.toString() : '';
    const userDoc = await User.findOne({
      $or: [{ _id: userId }, { accountId: userId }],
    }).select('_id').lean().catch(() => null);
    if (userDoc && userDoc._id) {
      resolvedOwnerId = userDoc._id.toString();
    }

    const ownerIdStr = booking.ownerId?._id ? booking.ownerId._id.toString() : booking.ownerId?.toString();
    const deviceOwnerIdStr = booking.deviceId?.ownerId ? booking.deviceId.ownerId.toString() : '';
    const isOwner =
      ownerIdStr === resolvedOwnerId ||
      ownerIdStr === (userId ? userId.toString() : '') ||
      (deviceOwnerIdStr &&
        (deviceOwnerIdStr === resolvedOwnerId || deviceOwnerIdStr === (userId ? userId.toString() : '')));
    const isAdmin = userRole === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only the device owner can upload return inspection photos.',
      });
    }

    if (booking.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Owner can only capture and upload return inspection photos when the booking is active.',
      });
    }

    const resolvedPhotos = await Promise.all(
      photos.map(async (photoStr) => {
        if (!photoStr || typeof photoStr !== 'string') return '';
        if (
          photoStr.startsWith('data:image/') ||
          (!photoStr.startsWith('http://') &&
            !photoStr.startsWith('https://') &&
            !photoStr.startsWith('/uploads/') &&
            !photoStr.startsWith('file://') &&
            photoStr.length > 300)
        ) {
          const cldUrl = await uploadToCloudinary(photoStr, 'techshare/handover');
          return cldUrl || photoStr;
        }
        return photoStr;
      })
    );
    const validPhotos = resolvedPhotos.filter(Boolean);

    if (!booking.handover) {
      booking.handover = { beforePhotos: [], afterPhotos: [], beforeNote: '', afterNote: '' };
    }
    booking.handover.afterPhotos = validPhotos;
    if (conditionNotes !== undefined) {
      booking.handover.afterNote = conditionNotes;
    }

    booking.set('handover.afterPhotos', validPhotos);
    if (conditionNotes !== undefined) {
      booking.set('handover.afterNote', conditionNotes);
    }
    booking.markModified('handover');

    booking.timeline.push({
      status: booking.status,
      timestamp: new Date(),
      note: `Owner recorded ${validPhotos.length} return inspection photo(s) (afterRental).`,
    });

    await booking.save();

    return res.status(200).json({
      success: true,
      message: 'Return inspection photos saved successfully',
      data: booking,
    });
  } catch (error) {
    console.error('Error updating afterRental photos:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while saving return inspection photos',
      error: error.message,
    });
  }
};

// @desc    Get owner bookings
// @route   GET /api/bookings/owner-bookings
// @access  Private
const getOwnerBookings = async (req, res) => {
  try {
    let userId = (req.auth && (req.auth.id || req.auth._id)) || (req.user && req.user._id) || req.query.ownerId || req.query.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Chưa xác thực người dùng' });
    }

    // Resolve User._id in case accountId was passed
    let resolvedOwnerId = userId;
    const userDoc = await User.findOne({
      $or: [{ _id: userId }, { accountId: userId }],
    }).select('_id').lean().catch(() => null);
    if (userDoc && userDoc._id) {
      resolvedOwnerId = userDoc._id;
    }

    const ownerDevices = await Device.find({
      ownerId: resolvedOwnerId,
      isDeleted: { $ne: true },
    }).select('_id').lean();
    const deviceIds = ownerDevices.map((d) => d._id);

    const { status } = req.query;
    const query =
      deviceIds.length > 0
        ? { $or: [{ ownerId: resolvedOwnerId }, { deviceId: { $in: deviceIds } }] }
        : { ownerId: resolvedOwnerId };

    if (status && status !== 'all') {
      query.status = status;
    }

    const bookingDocs = await Booking.find(query)
      .populate('deviceId', 'name images brand model category pricePerDay dailyRate depositAmount depositValue condition description location addressText specs')
      .populate('renterId', 'name username email phone avatar isVerified trust trustScore rating totalReviews address')
      .sort({ createdAt: -1 });

    // Sync isReviewed & isRenterReviewed for completed bookings
    const completedIds = bookingDocs.filter((b) => b.status === 'completed').map((b) => b._id);
    const deviceReviewMap = new Map();
    const renterReviewMap = new Map();

    if (completedIds.length > 0) {
      try {
        const existingReviews = await Review.find({ bookingId: { $in: completedIds } }).lean();
        existingReviews.forEach((rev) => {
          const bIdStr = String(rev.bookingId);
          if (rev.targetType === 'renter') {
            renterReviewMap.set(bIdStr, rev._id);
          } else {
            deviceReviewMap.set(bIdStr, rev._id);
          }
        });
      } catch (err) {
        console.warn('Error syncing review flags in getOwnerBookings:', err.message);
      }
    }

    const bookings = bookingDocs.map((doc) => {
      const obj = doc.toJSON({ virtuals: true });
      const idStr = String(obj._id);
      if (deviceReviewMap.has(idStr)) {
        obj.isReviewed = true;
        obj.reviewId = deviceReviewMap.get(idStr);
      }
      if (renterReviewMap.has(idStr)) {
        obj.isRenterReviewed = true;
        obj.renterReviewId = renterReviewMap.get(idStr);
      }
      return obj;
    });

    return res.status(200).json({ success: true, count: bookings.length, data: bookings });
  } catch (error) {
    console.error('Error getting owner bookings:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi lấy danh sách đơn của chủ máy', error: error.message });
  }
};

// @desc    Update booking status by owner (approve/reject/active/completed)
// @route   PATCH /api/bookings/:id/status
// @access  Private
const updateBookingStatus = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { status, reason } = req.body;
    const userId = (req.auth && (req.auth.id || req.auth._id)) || (req.user && req.user._id);

    if (!['approved', 'rejected', 'cancelled', 'active', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Trạng thái cập nhật không hợp lệ (approved/rejected/cancelled/active/completed)',
      });
    }

    const booking = await Booking.findById(bookingId)
      .populate('deviceId', 'name ownerId')
      .populate('renterId', 'name email phone avatar');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn thuê' });
    }

    let resolvedOwnerId = userId;
    const userDoc = await User.findOne({
      $or: [{ _id: userId }, { accountId: userId }],
    }).select('_id').lean().catch(() => null);
    if (userDoc && userDoc._id) {
      resolvedOwnerId = userDoc._id;
    }

    const isOwner =
      String(booking.ownerId) === String(resolvedOwnerId) ||
      String(booking.ownerId) === String(userId) ||
      (booking.deviceId?.ownerId &&
        (String(booking.deviceId.ownerId) === String(resolvedOwnerId) ||
          String(booking.deviceId.ownerId) === String(userId)));
    const userRole = (req.auth && req.auth.role) || (req.user && req.user.role);
    const isAdmin = userRole === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền thao tác trên đơn thuê của chủ khác' });
    }

    if (booking.status !== 'pending' && status === 'approved') {
      return res.status(400).json({ success: false, message: `Không thể duyệt đơn đang ở trạng thái "${booking.status}"` });
    }

    booking.status = status;
    const devId = booking.deviceId?._id || booking.deviceId;

    if (status === 'approved') {
      if (!booking.qrToken) {
        booking.qrToken = `TSQR-${booking.bookingCode}-${booking._id.toString().slice(-4).toUpperCase()}`;
      }
    } else if (status === 'rejected' || status === 'cancelled') {
      booking.statusReason = reason || 'Chủ máy từ chối yêu cầu thuê';
      booking.rejectReason = reason || 'Chủ máy từ chối yêu cầu thuê';
    } else if (status === 'active') {
      if (devId) {
        await Device.findByIdAndUpdate(devId, { status: 'rented' }).catch(() => {});
      }
    } else if (status === 'completed') {
      booking.paymentStatus = 'refunded';
      if (devId) {
        await Device.findByIdAndUpdate(devId, { status: 'available' }).catch(() => {});
      }
    }

    let actionText = 'Chủ máy cập nhật trạng thái đơn thuê';
    if (status === 'approved') {
      actionText = 'Chủ máy đã phê duyệt yêu cầu thuê';
    } else if (status === 'rejected' || status === 'cancelled') {
      actionText = `Chủ máy từ chối yêu cầu thuê. Lý do: ${reason || 'Không có'}`;
    } else if (status === 'active') {
      actionText = 'Chủ máy đã bàn giao thiết bị cho khách thuê (Đang thuê)';
    } else if (status === 'completed') {
      actionText = 'Đã nhận lại thiết bị và hoàn tất hợp đồng thuê';
    }

    if (!booking.timeline) booking.timeline = [];
    booking.timeline.push({
      status,
      timestamp: new Date(),
      note: actionText,
    });

    await booking.save();

    // Gửi thông báo đến người thuê
    if (booking.renterId) {
      const renterIdVal = booking.renterId._id || booking.renterId;
      const deviceName = booking.deviceId?.name || 'device';
      if (status === 'approved') {
        await createAndSendNotification({
          userId: renterIdVal,
          title: 'Booking Request Approved! 🎉',
          body: `The owner approved your booking request for "${deviceName}" (#${booking.bookingCode}). Please prepare for device handover!`,
          type: 'order',
          relatedId: booking._id,
          data: {
            bookingId: booking._id.toString(),
            status: 'approved',
            bookingCode: booking.bookingCode,
          },
        }).catch((err) => console.error('❌ Error sending approval notification to renter:', err.message));
      } else if (status === 'rejected' || status === 'cancelled') {
        await createAndSendNotification({
          userId: renterIdVal,
          title: 'Booking Request Declined ❌',
          body: `The owner was unable to accept your rental request for "${deviceName}" (#${booking.bookingCode}). Reason: ${reason || 'Owner unavailable during requested dates'}.`,
          type: 'order',
          relatedId: booking._id,
          data: {
            bookingId: booking._id.toString(),
            status: 'rejected',
            bookingCode: booking.bookingCode,
          },
        }).catch((err) => console.error('❌ Error sending decline notification to renter:', err.message));
      } else if (status === 'active') {
        await createAndSendNotification({
          userId: renterIdVal,
          title: 'Device Handover Completed! 📱',
          body: `Rental period for "${deviceName}" (#${booking.bookingCode}) has officially started. Enjoy your device!`,
          type: 'order',
          relatedId: booking._id,
          data: {
            bookingId: booking._id.toString(),
            status: 'active',
            bookingCode: booking.bookingCode,
          },
        }).catch((err) => console.error('❌ Error sending handover notification to renter:', err.message));
      } else if (status === 'completed') {
        await createAndSendNotification({
          userId: renterIdVal,
          title: 'Rental Completed! 🎉',
          body: `The owner confirmed the return of "${deviceName}" (#${booking.bookingCode}). Your deposit has been released. Please leave a review!`,
          type: 'order',
          relatedId: booking._id,
          data: {
            bookingId: booking._id.toString(),
            status: 'completed',
            bookingCode: booking.bookingCode,
          },
        }).catch((err) => console.error('❌ Error sending completion notification to renter:', err.message));
      }
    }

    try {
      const { getIO } = require('../socket');
      const io = getIO();
      if (io) {
        if (booking.ownerId) {
          io.to(`user_${booking.ownerId}`).emit('booking_status_updated', {
            bookingId: booking._id.toString(),
            status,
          });
        }
        if (booking.renterId) {
          const rId = booking.renterId._id || booking.renterId;
          io.to(`user_${rId}`).emit('booking_status_updated', {
            bookingId: booking._id.toString(),
            status,
          });
        }
      }
    } catch {}

    const statusMessages = {
      approved: 'Đã phê duyệt yêu cầu thuê thành công!',
      rejected: 'Đã từ chối yêu cầu thuê!',
      cancelled: 'Đã hủy đơn thuê!',
      active: 'Đã xác nhận bàn giao thiết bị thành công!',
      completed: 'Đã nhận lại thiết bị và hoàn tất đơn thuê!',
    };

    return res.status(200).json({
      success: true,
      message: statusMessages[status] || 'Đã cập nhật trạng thái đơn thuê!',
      data: booking,
    });
  } catch (error) {
    console.error('Error updating booking status:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi cập nhật trạng thái đơn', error: error.message });
  }
};

// @desc    Handover booking (approved -> active)
// @route   PATCH /api/bookings/:id/handover
// @access  Private
const handoverBooking = async (req, res) => {
  req.body = { ...(req.body || {}), status: 'active' };
  return updateBookingStatus(req, res);
};

// @desc    Complete booking (active -> completed)
// @route   PATCH /api/bookings/:id/complete
// @access  Private
const completeBooking = async (req, res) => {
  req.body = { ...(req.body || {}), status: 'completed' };
  return updateBookingStatus(req, res);
};

module.exports = {
  createBooking,
  getDeviceBusyDates,
  getMyBookings,
  cancelBooking,
  getBookingById,
  requestExtension,
  getExtensionRequests,
  getExtensionRequestById,
  respondToExtensionRequest,
  updateBeforeRentalPhotos,
  updateAfterRentalPhotos,
  getOwnerBookings,
  updateBookingStatus,
  handoverBooking,
  completeBooking,
};
