const express = require('express');
const router = express.Router();
const ownerController = require('../controllers/ownerController');
const User = require('../models/User');
const Account = require('../models/Account');
const Device = require('../models/Device');
const { asyncHandler } = require('../middlewares/asyncHandler');

// Tuyến đường lấy danh sách các chủ sở hữu và thiết bị của họ hiển thị trên bản đồ (lọc theo category và tọa độ)
router.get('/map-owners', asyncHandler(async (req, res) => {
  const { category, lat, lng } = req.query;

  // Lọc các thiết bị khả dụng
  const deviceFilter = {
    isDeleted: false,
    status: 'available',
    moderationStatus: { $in: ['approved', null] },
  };

  if (category && category !== 'all') {
    const escaped = category.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    deviceFilter.category = new RegExp('^' + escaped + '$', 'i');
  }

  const devices = await Device.find(deviceFilter)
    .select('_id name category brand condition pricePerDay dailyRate images specs status ownerId location addressText')
    .sort({ createdAt: -1 })
    .lean();

  // Nhóm thiết bị theo ownerId
  const ownerDevicesMap = new Map();
  devices.forEach(d => {
    const oId = String(d.ownerId);
    if (!ownerDevicesMap.has(oId)) ownerDevicesMap.set(oId, []);
    ownerDevicesMap.get(oId).push(d);
  });

  const ownerIds = Array.from(ownerDevicesMap.keys());
  if (ownerIds.length === 0) {
    return res.json({ success: true, count: 0, data: [] });
  }

  // Lấy thông tin người dùng / chủ sở hữu còn active trên Account
  const rawUsers = await User.find({
    _id: { $in: ownerIds },
  })
    .select('_id accountId name avatar address phone email rating totalReviews trust.isVerified location')
    .lean();

  const accountIds = rawUsers.map(u => u.accountId).filter(Boolean);
  const activeAccounts = await Account.find({
    _id: { $in: accountIds },
    isActive: true,
  })
    .select('_id')
    .lean();
  const activeAccountIdSet = new Set(activeAccounts.map(a => String(a._id)));
  const users = rawUsers.filter(u => u.accountId && activeAccountIdSet.has(String(u.accountId)));

  const userLat = Number(lat);
  const userLng = Number(lng);
  const hasUserCoords = Number.isFinite(userLat) && Number.isFinite(userLng);

  // Hàm tính khoảng cách haversine (mét)
  const calcDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
  };

  const results = [];
  for (const user of users) {
    const userDevices = ownerDevicesMap.get(String(user._id)) || [];
    if (userDevices.length === 0) continue;

    // Tọa độ của chủ sở hữu
    let coordinates = user.location?.coordinates;
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
      coordinates = userDevices[0]?.location?.coordinates;
    }
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) continue;

    let distanceMeters = null;
    if (hasUserCoords) {
      distanceMeters = Math.round(calcDistance(userLat, userLng, coordinates[1], coordinates[0]));
    }

    results.push({
      _id: String(user._id),
      id: String(user._id),
      name: user.name || 'Chủ sở hữu',
      avatar: user.avatar,
      phone: user.phone,
      rating: user.rating || 5,
      totalReviews: user.totalReviews || 0,
      isVerified: Boolean(user.trust?.isVerified),
      address: typeof user.address === 'string' ? user.address : (userDevices[0]?.addressText || 'Việt Nam'),
      coordinates: [coordinates[0], coordinates[1]], // [longitude, latitude]
      deviceCount: userDevices.length,
      distanceMeters,
      devices: userDevices,
    });
  }

  // Sắp xếp theo khoảng cách nếu có tọa độ người dùng, ngược lại sắp theo số lượng thiết bị
  if (hasUserCoords) {
    results.sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity));
  } else {
    results.sort((a, b) => b.deviceCount - a.deviceCount);
  }

  return res.json({ success: true, count: results.length, data: results });
}));

// Tuyến đường lấy thông tin hồ sơ của chủ sở hữu
router.get('/:id/profile', asyncHandler(async (req, res) => {
  if (!/^[a-fA-F0-9]{24}$/.test(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid owner ID' });
  }
  const ownerDoc = await User.findById(req.params.id)
    .select('accountId name avatar address rating totalReviews phone email trust.isVerified createdAt')
    .lean();
  if (!ownerDoc || !ownerDoc.accountId) {
    return res.status(404).json({ success: false, message: 'Owner not found' });
  }
  const ownerAccount = await Account.findOne({ _id: ownerDoc.accountId, isActive: true })
    .select('_id')
    .lean();
  if (!ownerAccount) {
    return res.status(404).json({ success: false, message: 'Owner not found' });
  }
  const { accountId: _ignoredAccountId, ...owner } = ownerDoc;
  const deviceCount = await Device.countDocuments({
    ownerId: req.params.id,
    isDeleted: false,
    moderationStatus: { $in: ['approved', null] },
    status: { $in: ['available', 'rented', 'maintenance'] },
  });
  return res.json({ success: true, data: { ...owner, deviceCount } });
}));

// Tuyến đường lấy danh sách các thiết bị thuộc chủ sở hữu
router.get('/:id/devices', asyncHandler(async (req, res) => {
  if (!/^[a-fA-F0-9]{24}$/.test(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid owner ID' });
  }
  const devices = await Device.find({
    ownerId: req.params.id,
    isDeleted: false,
    moderationStatus: { $in: ['approved', null] },
  }).sort({ createdAt: -1 }).lean();

  return res.json({ success: true, count: devices.length, data: devices });
}));

// Tuyến đường lấy thống kê KPIs và doanh thu cho Owner Dashboard
router.get('/dashboard', ownerController.getOwnerDashboardStats);

// Tuyến đường lấy danh sách tin nhắn khách hàng (Customer Messages)
router.get('/messages', ownerController.getOwnerCustomerMessages);

// Tuyến đường lấy danh sách yêu cầu thuê mới chờ duyệt (Pending Approval)
router.get('/pending-bookings', ownerController.getOwnerPendingBookings);

// Tuyến đường lấy toàn bộ đơn thuê của chủ máy
router.get('/bookings', ownerController.getOwnerBookings);

// Tuyến đường duyệt hoặc từ chối yêu cầu thuê
router.patch('/bookings/:id/status', ownerController.updateBookingStatus);

module.exports = router;
