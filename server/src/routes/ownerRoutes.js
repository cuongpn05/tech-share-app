const express = require('express');
const router = express.Router();
const ownerController = require('../controllers/ownerController');
const User = require('../models/User');
const Device = require('../models/Device');
const { asyncHandler } = require('../middlewares/asyncHandler');

// Tuyến đường lấy danh sách các chủ sở hữu và thiết bị của họ hiển thị trên bản đồ (lọc theo category, tọa độ và bán kính)
router.get('/map-owners', asyncHandler(async (req, res) => {
  const { category, lat, lng, radius, maxDistance, all } = req.query;

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

  // Lấy thông tin người dùng / chủ sở hữu
  const users = await User.find({
    _id: { $in: ownerIds },
    isActive: true,
  })
    .select('_id name avatar address phone email rating totalReviews trust.isVerified location')
    .lean();

  const userLat = Number(lat);
  const userLng = Number(lng);
  const hasUserCoords =
    Number.isFinite(userLat) &&
    Number.isFinite(userLng) &&
    Math.abs(userLat) <= 90 &&
    Math.abs(userLng) <= 180;

  const queryRadius = Number(radius ?? maxDistance);
  // Bán kính tìm kiếm (mặc định 50 km = 50,000 mét khi có tọa độ)
  const effectiveRadius = Number.isFinite(queryRadius) && queryRadius > 0 ? queryRadius : 50000;
  const isFilterByRadius = hasUserCoords && all !== 'true';

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

    // Tọa độ của chủ sở hữu [longitude, latitude]
    let coordinates = user.location?.coordinates;
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
      coordinates = userDevices[0]?.location?.coordinates;
    }
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) continue;

    // Xử lý và tính khoảng cách chính xác cho từng thiết bị
    const processedDevices = userDevices.map(d => {
      const dCoords = (d.location && Array.isArray(d.location.coordinates) && d.location.coordinates.length === 2)
        ? d.location.coordinates
        : coordinates;

      let dDistanceMeters = null;
      if (hasUserCoords && Array.isArray(dCoords) && dCoords.length === 2) {
        dDistanceMeters = Math.round(calcDistance(userLat, userLng, dCoords[1], dCoords[0]));
      }

      const dAddress = d.location?.addressText || d.addressText || (typeof user.address === 'string' ? user.address : 'Việt Nam');

      return {
        ...d,
        location: {
          type: 'Point',
          coordinates: [dCoords[0], dCoords[1]],
          addressText: dAddress,
        },
        coordinates: [dCoords[0], dCoords[1]], // [longitude, latitude]
        addressText: dAddress,
        distanceMeters: dDistanceMeters,
      };
    });

    // Sắp xếp các thiết bị của chủ sở hữu theo khoảng cách gần nhất
    if (hasUserCoords) {
      processedDevices.sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity));
    }

    let distanceMeters = null;
    if (hasUserCoords) {
      const ownerDist = Math.round(calcDistance(userLat, userLng, coordinates[1], coordinates[0]));
      const minDeviceDist = processedDevices[0]?.distanceMeters ?? Infinity;
      distanceMeters = Math.min(ownerDist, minDeviceDist);

      // Lọc bỏ nếu cả chủ sở hữu và các thiết bị đều nằm ngoài bán kính tìm kiếm
      if (isFilterByRadius && ownerDist > effectiveRadius && minDeviceDist > effectiveRadius) {
        continue;
      }
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
      deviceCount: processedDevices.length,
      distanceMeters,
      devices: processedDevices,
    });
  }

  // Sắp xếp theo khoảng cách gần nhất nếu có tọa độ người dùng, ngược lại sắp theo số lượng thiết bị
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
  const owner = await User.findOne({ _id: req.params.id, isActive: true })
    .select('name avatar address rating totalReviews phone email trust.isVerified createdAt').lean();
  if (!owner) return res.status(404).json({ success: false, message: 'Owner not found' });
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
