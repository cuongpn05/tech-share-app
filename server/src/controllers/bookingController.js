const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Device = require('../models/Device');
const User = require('../models/User');
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
    const totalHours = Math.max(1, Math.round(diffTime / (1000 * 60 * 60)));
    let totalDays = Math.ceil(totalHours / 24);
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
      .populate('deviceId', 'name images brand model category pricePerDay dailyRate depositAmount depositValue')
      .populate('ownerId', 'name avatar phone email')
      .sort({ createdAt: -1 });

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
      const renterName = renter?.name || 'Khách thuê';
      const dev = await Device.findById(booking.deviceId).select('name');
      const deviceName = dev?.name || 'thiết bị';
      createAndSendNotification({
        userId: booking.ownerId,
        title: 'Đơn thuê đã bị hủy ⚠️',
        body: `Khách thuê ${renterName} đã hủy đơn thuê "${deviceName}" (#${booking.bookingCode}). Lịch thiết bị đã được mở lại.`,
        type: 'order',
        relatedId: booking._id,
        data: {
          bookingId: booking._id.toString(),
          status: 'cancelled',
        },
      }).catch((err) => console.error('❌ Lỗi gửi thông báo cho chủ máy:', err.message));
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
        'name images brand model category pricePerDay dailyRate depositAmount depositValue description condition location addressText'
      )
      .populate('ownerId', 'name avatar phone email rating totalReviews')
      .populate('renterId', 'name avatar phone email rating isVerified trustScore');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn thuê' });
    }

    if (!booking.qrToken) {
      booking.qrToken = `TSQR-${booking.bookingCode}-${booking._id.toString().slice(-4).toUpperCase()}`;
      await booking.save();
    }

    const renterIdStr = booking.renterId?._id ? booking.renterId._id.toString() : booking.renterId?.toString();
    const ownerIdStr = booking.ownerId?._id ? booking.ownerId._id.toString() : booking.ownerId?.toString();
    const isRenter = renterIdStr === (userId ? userId.toString() : '');
    const isOwner = ownerIdStr === (userId ? userId.toString() : '');
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

    const days = parseInt(additionalDays || requestedDays, 10);
    if (!days || isNaN(days) || days <= 0) {
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

    booking.extensionRequest = {
      requestedEndDate: newEndDate,
      requestedDays: days,
      additionalFee,
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
    const isRenter = renterIdStr === (userId ? userId.toString() : '');
    const isOwner = ownerIdStr === (userId ? userId.toString() : '');
    const isAdmin = userRole === 'admin';

    if (!isRenter && !isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền cập nhật ảnh đơn thuê này' });
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

module.exports = {
  createBooking,
  getDeviceBusyDates,
  getMyBookings,
  cancelBooking,
  getBookingById,
  requestExtension,
  updateBeforeRentalPhotos,
};
