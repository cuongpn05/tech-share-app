const mongoose = require('mongoose');
const User = require('../models/User');
const Device = require('../models/Device');
const Wishlist = require('../models/Wishlist');

/**
 * Lấy danh sách thiết bị trong Wishlist của người dùng hiện tại
 * GET /api/profile/wishlist
 */
const getMyWishlist = async (req, res) => {
  try {
    const userId = req.auth?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }

    // Tự động di chuyển dữ liệu cũ từ User document (nếu có) sang collection Wishlist
    const existingCount = await Wishlist.countDocuments({ userId });
    if (existingCount === 0) {
      const user = await User.findById(userId);
      if (user && Array.isArray(user._doc?.wishlist) && user._doc.wishlist.length > 0) {
        const legacyIds = user._doc.wishlist.filter(Boolean);
        if (legacyIds.length > 0) {
          const ops = legacyIds.map((devId) => ({
            updateOne: {
              filter: { userId, deviceId: devId },
              update: { $setOnInsert: { userId, deviceId: devId } },
              upsert: true,
            },
          }));
          await Wishlist.bulkWrite(ops);
          await User.findByIdAndUpdate(userId, { $unset: { wishlist: 1 } });
        }
      }
    }

    // Lấy danh sách từ collection riêng 'wishlists'
    const records = await Wishlist.find({ userId })
      .populate({
        path: 'deviceId',
        populate: { path: 'ownerId', select: 'name avatar phone' },
      })
      .sort({ createdAt: -1 });

    const activeWishlist = records
      .map((r) => r.deviceId)
      .filter(Boolean);

    return res.status(200).json({
      success: true,
      wishlist: activeWishlist,
    });
  } catch (error) {
    console.error('Get wishlist error:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể tải danh sách yêu thích',
      error: error.message,
    });
  }
};

/**
 * Thêm hoặc gỡ thiết bị khỏi Wishlist
 * POST /api/profile/wishlist/toggle/:deviceId
 */
const toggleWishlist = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.auth?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập.' });
    }

    if (!deviceId || !mongoose.Types.ObjectId.isValid(deviceId)) {
      return res.status(400).json({ success: false, message: 'ID thiết bị không hợp lệ' });
    }

    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({ success: false, message: 'Thiết bị không tồn tại' });
    }

    // Di chuyển dữ liệu cũ nếu còn tồn tại trong User
    const user = await User.findById(userId);
    if (user && Array.isArray(user._doc?.wishlist) && user._doc.wishlist.length > 0) {
      const legacyIds = user._doc.wishlist.filter(Boolean);
      const ops = legacyIds.map((devId) => ({
        updateOne: {
          filter: { userId, deviceId: devId },
          update: { $setOnInsert: { userId, deviceId: devId } },
          upsert: true,
        },
      }));
      await Wishlist.bulkWrite(ops);
      await User.findByIdAndUpdate(userId, { $unset: { wishlist: 1 } });
    }

    // Kiểm tra trong collection riêng 'wishlists'
    const existing = await Wishlist.findOne({ userId, deviceId });

    let isInWishlist = false;

    if (existing) {
      await Wishlist.deleteOne({ _id: existing._id });
      isInWishlist = false;
    } else {
      await Wishlist.create({ userId, deviceId });
      isInWishlist = true;
    }

    // Lấy danh sách mới nhất từ collection Wishlist
    const records = await Wishlist.find({ userId })
      .populate({
        path: 'deviceId',
        populate: { path: 'ownerId', select: 'name avatar phone' },
      })
      .sort({ createdAt: -1 });

    const activeWishlist = records
      .map((r) => r.deviceId)
      .filter(Boolean);

    return res.status(200).json({
      success: true,
      isInWishlist,
      wishlist: activeWishlist,
      message: isInWishlist
        ? 'Đã thêm thiết bị vào danh sách yêu thích'
        : 'Đã xóa thiết bị khỏi danh sách yêu thích',
    });
  } catch (error) {
    console.error('Toggle wishlist error:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể cập nhật danh sách yêu thích',
      error: error.message,
    });
  }
};

module.exports = {
  getMyWishlist,
  toggleWishlist,
};
