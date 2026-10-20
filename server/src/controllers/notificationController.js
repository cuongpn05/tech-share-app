const mongoose = require('mongoose');
const Notification = require('../models/Notification');

/**
 * @desc    Lấy danh sách thông báo của người dùng hiện tại
 * @route   GET /api/notifications
 * @access  Private
 */
const getMyNotifications = async (req, res) => {
  try {
    const userId =
      (req.auth && (req.auth.id || req.auth._id)) ||
      (req.user && req.user._id) ||
      req.query.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Chưa xác thực người dùng' });
    }

    const userIds = [];
    if (userId && mongoose.isValidObjectId(userId)) {
      userIds.push(new mongoose.Types.ObjectId(userId));
    }
    const accountId = req.auth?.accountId || req.user?.accountId;
    if (accountId && mongoose.isValidObjectId(accountId) && String(accountId) !== String(userId)) {
      userIds.push(new mongoose.Types.ObjectId(accountId));
    }

    const { type, isRead, limit = 50, page = 1 } = req.query;
    const query = userIds.length > 1 ? { userId: { $in: userIds } } : { userId: userIds[0] || userId };

    if (type && type !== 'all') {
      query.type = type;
    }

    if (isRead !== undefined) {
      query.isRead = isRead === 'true';
    }

    const skip = (Number(page) - 1) * Number(limit);
    const unreadFilter = userIds.length > 1 ? { userId: { $in: userIds }, isRead: false } : { userId: userIds[0] || userId, isRead: false };

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments(unreadFilter),
    ]);

    return res.status(200).json({
      success: true,
      count: notifications.length,
      total,
      unreadCount,
      data: notifications,
    });
  } catch (error) {
    console.error('[NotificationController] Lỗi lấy danh sách thông báo:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy danh sách thông báo',
      error: error.message,
    });
  }
};

/**
 * @desc    Đánh dấu một thông báo đã đọc
 * @route   PATCH /api/notifications/:id/read
 * @access  Private
 */
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId =
      (req.auth && (req.auth.id || req.auth._id)) ||
      (req.user && req.user._id);

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(200).json({ success: true, message: 'ID thông báo không phải từ DB' });
    }

    const notification = await Notification.findByIdAndUpdate(
      new mongoose.Types.ObjectId(id),
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông báo' });
    }

    const remainingUnread = await Notification.countDocuments({
      userId: notification.userId,
      isRead: false,
    });

    return res.status(200).json({
      success: true,
      message: 'Đã đánh dấu thông báo đã đọc',
      data: notification,
      unreadCount: remainingUnread,
    });
  } catch (error) {
    console.error('[NotificationController] Lỗi đánh dấu đã đọc:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi cập nhật thông báo',
      error: error.message,
    });
  }
};

/**
 * @desc    Đánh dấu tất cả thông báo của người dùng đã đọc
 * @route   PATCH /api/notifications/read-all
 * @access  Private
 */
const markAllAsRead = async (req, res) => {
  try {
    const userId =
      (req.auth && (req.auth.id || req.auth._id)) ||
      (req.user && req.user._id);

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Chưa xác thực người dùng' });
    }

    const userIds = [];
    if (userId && mongoose.isValidObjectId(userId)) {
      userIds.push(new mongoose.Types.ObjectId(userId));
    }
    const accountId = req.auth?.accountId || req.user?.accountId;
    if (accountId && mongoose.isValidObjectId(accountId) && String(accountId) !== String(userId)) {
      userIds.push(new mongoose.Types.ObjectId(accountId));
    }

    const filter = userIds.length > 1 ? { userId: { $in: userIds }, isRead: false } : { userId: userIds[0] || userId, isRead: false };

    await Notification.updateMany(
      filter,
      { $set: { isRead: true } }
    );

    return res.status(200).json({
      success: true,
      message: 'Đã đánh dấu tất cả thông báo là đã đọc',
      unreadCount: 0,
    });
  } catch (error) {
    console.error('[NotificationController] Lỗi đánh dấu đọc tất cả:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi cập nhật thông báo',
      error: error.message,
    });
  }
};

/**
 * @desc    Đăng ký hoặc cập nhật Firebase Cloud Messaging (FCM) Token cho người dùng
 * @route   POST /api/notifications/fcm-token
 * @access  Private
 */
const registerFCMToken = async (req, res) => {
  try {
    const userId =
      (req.auth && (req.auth.id || req.auth._id)) ||
      (req.user && req.user._id) ||
      req.body.userId;

    const { fcmToken, token } = req.body;
    const tokenToSave = fcmToken || token;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Chưa xác thực người dùng' });
    }

    if (!tokenToSave) {
      return res.status(400).json({ success: false, message: 'Thiếu FCM token' });
    }

    const User = require('../models/User');
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    if (!user.pushConfig) {
      user.pushConfig = { expoPushToken: '', fcmTokens: [], biometricEnabled: false };
    }
    if (!Array.isArray(user.pushConfig.fcmTokens)) {
      user.pushConfig.fcmTokens = [];
    }

    if (!user.pushConfig.fcmTokens.includes(tokenToSave)) {
      user.pushConfig.fcmTokens.push(tokenToSave);
      await user.save();
    }

    console.log(`[FCM] Đã lưu FCM token cho user ${userId}: ${tokenToSave.substring(0, 15)}...`);

    return res.status(200).json({
      success: true,
      message: 'Đăng ký Firebase Push Token thành công',
      fcmTokensCount: user.pushConfig.fcmTokens.length,
    });
  } catch (error) {
    console.error('[NotificationController] Lỗi đăng ký FCM token:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi đăng ký FCM token',
      error: error.message,
    });
  }
};

module.exports = {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  registerFCMToken,
};

