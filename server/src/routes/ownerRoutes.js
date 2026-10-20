const express = require('express');
const router = express.Router();
const ownerController = require('../controllers/ownerController');
const User = require('../models/User');
const Device = require('../models/Device');
const { asyncHandler } = require('../middlewares/asyncHandler');

router.get('/:id/profile', asyncHandler(async (req, res) => {
  if (!/^[a-fA-F0-9]{24}$/.test(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid owner ID' });
  }
  const owner = await User.findOne({ _id: req.params.id, isActive: true })
    .select('name avatar address rating totalReviews trust.isVerified createdAt').lean();
  if (!owner) return res.status(404).json({ success: false, message: 'Owner not found' });
  const deviceCount = await Device.countDocuments({ ownerId: req.params.id, isDeleted: false,
    moderationStatus: { $in: ['approved', null] }, status: { $in: ['available', 'rented', 'maintenance'] } });
  return res.json({ success: true, data: { ...owner, deviceCount } });
}));

// Tuyến đường lấy thống kê KPIs và doanh thu cho Owner Dashboard
router.get('/dashboard', ownerController.getOwnerDashboardStats);

// Tuyến đường lấy danh sách tin nhắn khách hàng (Customer Messages)
router.get('/messages', ownerController.getOwnerCustomerMessages);

module.exports = router;
