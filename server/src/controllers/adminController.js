const Account = require('../models/Account');
const User = require('../models/User');
const Device = require('../models/Device');
const Booking = require('../models/Booking');
const Dispute = require('../models/Dispute');
const EkycRequest = require('../models/EkycRequest');
const Role = require('../models/Role');

/**
 * Controller cung cấp dữ liệu phân tích và số liệu KPI cho Admin Dashboard
 * GET /api/admin/dashboard (hoặc /api/admin/analytics)
 * Dữ liệu 100% được truy vấn từ MongoDB Atlas, không dùng dữ liệu dự phòng/giả lập.
 */
const getDashboardStats = async (req, res) => {
  try {
    // 1. Thực thi song song các truy vấn Mongoose
    const [
      totalUsersCount,
      verifiedUsersCount,
      activeUsersCount,
      totalDevicesCount,
      rentedDevicesCount,
      availableDevicesCount,
      totalOrdersCount,
      activeOrdersCount,
      completedOrdersCount,
      revenueResult,
      categoryGroupResult,
      pendingDisputesCount,
      pendingEkycCount,
    ] = await Promise.all([
      Account.countDocuments(),
      User.countDocuments({
        $or: [{ 'trust.isVerified': true }, { isVerified: true }],
      }),
      Account.countDocuments({ isActive: true }),

      Device.countDocuments({ isDeleted: { $ne: true } }),
      Device.countDocuments({ isDeleted: { $ne: true }, status: 'rented' }),
      Device.countDocuments({ isDeleted: { $ne: true }, status: 'available' }),

      Booking.countDocuments(),
      Booking.countDocuments({ status: 'active' }),
      Booking.countDocuments({ status: 'completed' }),

      Booking.aggregate([
        { $match: { status: 'completed' } },
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $ifNull: [
                  '$pricing.totalAmount',
                  { $ifNull: ['$pricing.rentalFee', '$rentalFee'] },
                ],
              },
            },
          },
        },
      ]),

      Device.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),

      Dispute.countDocuments({ status: 'pending' }),
      EkycRequest.countDocuments({ status: 'pending' }),
    ]);

    // 2. Tính toán Gross Rental Volume thực tế từ DB
    const rawRevenue =
      revenueResult.length > 0 && revenueResult[0].total
        ? Number(revenueResult[0].total)
        : 0;
    const formattedVolume =
      new Intl.NumberFormat('vi-VN').format(rawRevenue) + ' VND';

    // 3. Số liệu Người dùng thực tế
    const totalUsers = totalUsersCount;
    const verifiedUsers = verifiedUsersCount;
    const activeUsers = activeUsersCount;

    // 4. Số liệu Thiết bị thực tế
    const totalDevices = totalDevicesCount;
    const rentedDevices = rentedDevicesCount;
    const availableDevices = availableDevicesCount;

    // 5. Số liệu Đơn thuê thực tế
    const totalOrders = totalOrdersCount;
    const activeOrders = activeOrdersCount;
    const completedOrders = completedOrdersCount;

    // 6. Tính toán phân bổ danh mục theo dữ liệu thực tế từ DB
    const categoryCounts = {};
    let totalCategorized = 0;

    categoryGroupResult.forEach((item) => {
      if (!item._id) return;
      const cat = String(item._id).trim();
      categoryCounts[cat] = (categoryCounts[cat] || 0) + item.count;
      totalCategorized += item.count;
    });

    const categoryNamesMap = {
      camera: 'Cameras & Lenses',
      cameras: 'Cameras & Lenses',
      laptop: 'Graphic Laptops',
      laptops: 'Graphic Laptops',
      smartphone: 'Smartphones',
      smartphones: 'Smartphones',
      gaming: 'Gaming & Drones',
      drone: 'Gaming & Drones',
    };

    let categoryBreakdown = [];
    if (totalCategorized > 0) {
      categoryBreakdown = Object.keys(categoryCounts).map((catKey) => {
        const lowerKey = catKey.toLowerCase();
        const displayName = categoryNamesMap[lowerKey] || catKey;
        const count = categoryCounts[catKey];
        const percentage = Math.round((count / totalCategorized) * 100);
        return {
          id: lowerKey,
          name: displayName,
          percentage,
          count,
        };
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        kpis: {
          rentalVolume: rawRevenue,
          rentalVolumeFormatted: formattedVolume,
          rentalVolumeTrend: '',
          totalUsers,
          verifiedUsers,
          activeUsers,
          totalDevices,
          rentedDevices,
          availableDevices,
          totalOrders,
          activeOrders,
          completedOrders,
        },
        actionItems: {
          pendingDisputes: pendingDisputesCount,
          pendingEkyc: pendingEkycCount,
          isSmooth: pendingDisputesCount === 0 && pendingEkycCount === 0,
          message:
            pendingDisputesCount === 0 && pendingEkycCount === 0
              ? 'Hệ thống vận hành ổn định • Không có tranh chấp hoặc yêu cầu xác minh chờ xử lý'
              : `Cần chú ý: ${pendingDisputesCount} tranh chấp chờ xử lý • ${pendingEkycCount} yêu cầu eKYC`,
        },
        categoryBreakdown,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Admin Dashboard Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi truy vấn số liệu thống kê quản trị.',
      error: error.message,
    });
  }
};

/**
 * Lấy danh sách thiết bị cần kiểm duyệt cho Admin Hub
 * GET /api/admin/devices/moderation
 * Query: status ('all' | 'pending' | 'approved' | 'rejected'), search, page, limit
 */
const getModerationDevices = async (req, res) => {
  try {
    const { status = 'pending', search, page = 1, limit = 10 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const baseCondition = { isDeleted: { $ne: true } };

    let statusCondition = {};
    if (status === 'pending') {
      statusCondition = { moderationStatus: 'pending' };
    } else if (status === 'approved') {
      statusCondition = {
        $or: [
          { moderationStatus: 'approved' },
          { moderationStatus: { $exists: false } },
          { moderationStatus: null },
        ],
      };
    } else if (status === 'rejected') {
      statusCondition = { moderationStatus: 'rejected' };
    } else if (status === 'all') {
      statusCondition = {};
    }

    let searchCondition = {};
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const matchedUsers = await User.find({ name: searchRegex }).select('_id');
      const matchedUserIds = matchedUsers.map((u) => u._id);

      const orConditions = [
        { name: searchRegex },
        { brand: searchRegex },
      ];
      if (matchedUserIds.length > 0) {
        orConditions.push({ ownerId: { $in: matchedUserIds } });
      }
      searchCondition = { $or: orConditions };
    }

    const filterParts = [baseCondition];
    if (Object.keys(statusCondition).length > 0) {
      filterParts.push(statusCondition);
    }
    if (Object.keys(searchCondition).length > 0) {
      filterParts.push(searchCondition);
    }
    const finalFilter = filterParts.length > 1 ? { $and: filterParts } : baseCondition;

    // Truy vấn song song: badge counts theo 4 tab + tổng số kết quả filter + danh sách thiết bị
    const [
      totalPending,
      totalApproved,
      totalRejected,
      totalAll,
      totalItems,
      devicesDocs,
    ] = await Promise.all([
      Device.countDocuments({ isDeleted: { $ne: true }, moderationStatus: 'pending' }),
      Device.countDocuments({
        isDeleted: { $ne: true },
        $or: [
          { moderationStatus: 'approved' },
          { moderationStatus: { $exists: false } },
          { moderationStatus: null },
        ],
      }),
      Device.countDocuments({ isDeleted: { $ne: true }, moderationStatus: 'rejected' }),
      Device.countDocuments({ isDeleted: { $ne: true } }),
      Device.countDocuments(finalFilter),
      Device.find(finalFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate({
          path: 'ownerId',
          select: 'name avatar phone trust isVerified trustScore',
        }),
    ]);

    const formattedDevices = devicesDocs.map((doc) => {
      const owner = doc.ownerId;
      const effectiveModerationStatus = doc.moderationStatus || 'approved';
      return {
        _id: doc._id.toString(),
        id: doc._id.toString(),
        name: doc.name,
        brand: doc.brand,
        category: doc.category,
        pricePerDay: doc.pricePerDay,
        depositAmount: doc.depositAmount,
        images: doc.images || [],
        thumbnail: (doc.images && doc.images.length > 0) ? doc.images[0] : '',
        moderationStatus: effectiveModerationStatus,
        rejectReason: doc.rejectReason || '',
        createdAt: doc.createdAt,
        addressText: doc.addressText || doc.location?.addressText || '',
        owner: {
          _id: owner?._id ? owner._id.toString() : '',
          name: owner?.name || 'Chủ máy TechShare',
          avatar: owner?.avatar || '',
          phone: owner?.phone || '',
          trustScore: owner?.trustScore ?? owner?.trust?.score ?? 100,
          isVerified: owner?.isVerified ?? owner?.trust?.isVerified ?? false,
        },
      };
    });

    const totalPages = Math.ceil(totalItems / limitNum) || 1;

    const counts = {
      totalPending,
      totalApproved,
      totalRejected,
      totalAll,
    };

    const pagination = {
      page: pageNum,
      limit: limitNum,
      totalItems,
      totalPages,
      hasNextPage: pageNum < totalPages,
    };

    return res.status(200).json({
      success: true,
      message: 'Lấy danh sách thiết bị kiểm duyệt thành công',
      data: {
        devices: formattedDevices,
        counts,
        pagination,
      },
      devices: formattedDevices,
      counts,
      pagination,
    });
  } catch (error) {
    console.error('[Admin Moderation Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi truy vấn danh sách thiết bị kiểm duyệt.',
      error: error.message,
    });
  }
};

/**
 * Phê duyệt thiết bị lên sàn
 * PATCH /api/admin/devices/:id/approve
 */
const approveDevice = async (req, res) => {
  try {
    const { id } = req.params;
    const device = await Device.findByIdAndUpdate(
      id,
      {
        moderationStatus: 'approved',
        rejectReason: '',
      },
      { new: true }
    );

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thiết bị cần duyệt.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Phê duyệt thiết bị thành công.',
      data: device,
    });
  } catch (error) {
    console.error('[Approve Device Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi phê duyệt thiết bị.',
      error: error.message,
    });
  }
};

/**
 * Từ chối thiết bị kiểm duyệt
 * PATCH /api/admin/devices/:id/reject
 */
const rejectDevice = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Không đạt tiêu chuẩn kiểm duyệt.' } = req.body;

    const device = await Device.findByIdAndUpdate(
      id,
      {
        moderationStatus: 'rejected',
        rejectReason: String(reason).trim() || 'Không đạt tiêu chuẩn kiểm duyệt.',
      },
      { new: true }
    );

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thiết bị cần từ chối.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Đã từ chối thiết bị.',
      data: device,
    });
  } catch (error) {
    console.error('[Reject Device Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi từ chối thiết bị.',
      error: error.message,
    });
  }
};

/**
 * Lấy thông tin chi tiết một thiết bị kiểm duyệt cho Admin Hub (UC-A04)
 * GET /api/admin/devices/:id
 */
const getDeviceDetail = async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^[a-fA-F0-9]{24}$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID thiết bị không hợp lệ',
      });
    }

    const device = await Device.findOne({
      _id: id,
      isDeleted: false,
    }).populate({
      path: 'ownerId',
      select: 'name avatar phone email trust isVerified trustScore rating address',
    });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thiết bị kiểm duyệt',
      });
    }

    const owner = device.ownerId;
    const effectiveModerationStatus = device.moderationStatus || 'approved';
    const formattedDevice = {
      _id: device._id.toString(),
      id: device._id.toString(),
      name: device.name,
      brand: device.brand,
      category: device.category,
      yearOfManufacture: device.yearOfManufacture,
      condition: device.condition || 'new99',
      description: device.description || '',
      images: device.images || [],
      thumbnail: (device.images && device.images.length > 0) ? device.images[0] : '',
      specs: device.specs instanceof Map ? Object.fromEntries(device.specs) : (device.specs || {}),
      accessories: device.accessories || [],
      pricePerDay: device.pricePerDay,
      depositAmount: device.depositAmount,
      location: device.location,
      addressText: device.addressText || device.location?.addressText || '',
      status: device.status,
      moderationStatus: effectiveModerationStatus,
      rejectReason: device.rejectReason || '',
      createdAt: device.createdAt,
      stats: device.stats,
      owner: {
        _id: owner?._id ? owner._id.toString() : '',
        name: owner?.name || 'Chủ máy TechShare',
        avatar: owner?.avatar || '',
        phone: owner?.phone || '',
        email: owner?.email || '',
        rating: owner?.rating || 5.0,
        trustScore: owner?.trustScore ?? owner?.trust?.score ?? 100,
        isVerified: owner?.isVerified ?? owner?.trust?.isVerified ?? false,
        address: owner?.address || '',
      },
    };

    return res.status(200).json({
      success: true,
      message: 'Lấy chi tiết thiết bị thành công',
      data: formattedDevice,
    });
  } catch (error) {
    console.error('[Admin Device Detail Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy chi tiết thiết bị.',
      error: error.message,
    });
  }
};

module.exports = {
  getDashboardStats,
  getModerationDevices,
  getDeviceDetail,
  approveDevice,
  rejectDevice,
};

