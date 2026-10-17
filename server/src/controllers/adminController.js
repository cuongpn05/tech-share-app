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

module.exports = {
  getDashboardStats,
};
