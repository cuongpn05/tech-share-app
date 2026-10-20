/**
 * ============================================================
 *  USER MANAGEMENT CONTROLLER
 *  server/src/controllers/userManagementController.js
 * ============================================================
 *  Mục đích:
 *   - Tách riêng toàn bộ logic Quản lý Người Dùng (User Management)
 *     ra khỏi adminController để dễ bảo trì, mở rộng và báo cáo đồ án.
 *   - Hỗ trợ:
 *       + Lấy danh sách người dùng hệ thống (Role: renter, owner; loại bỏ admin)
 *       + Tìm kiếm theo: Tên hiển thị (name), Email, Username, Số điện thoại (phone)
 *       + Lọc theo Role: Người thuê (renter) / Chủ sở hữu (owner) / Tất cả
 *       + Lọc theo Trạng thái: Hoạt động (active) / Đã khóa (inactive) / Tất cả
 *       + Phân trang (Pagination) chuẩn
 *       + Sẵn sàng các hàm mở rộng: xem chi tiết, khóa/mở khóa tài khoản
 * ============================================================
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const Account = require('../models/Account');
const Role = require('../models/Role');

/**
 * Hàm hỗ trợ escape các ký tự đặc biệt trong chuỗi tìm kiếm RegExp
 * Tránh lỗi crash Regex khi người dùng nhập: (, [, *, +, ?, ^, $, |, \, etc.
 */
function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

/**
 * ─────────────────────────────────────────────────────────────
 *  1. GET USERS LIST (Lấy danh sách người dùng kèm bộ lọc & tìm kiếm)
 * ─────────────────────────────────────────────────────────────
 *  Route: GET /api/admin/users hoặc GET /api/user-management/users
 *  Query params:
 *    - search : từ khóa tìm kiếm (tên, email, username, phone)
 *    - role   : 'renter' | 'owner' (mặc định: lấy cả 2, loại admin)
 *    - status : 'active' | 'inactive'
 *    - page   : trang hiện tại (mặc định 1)
 *    - limit  : số bản ghi mỗi trang (mặc định 20, tối đa 100)
 */
const getUsersList = async (req, res) => {
  try {
    // ── Bước 1: Chuẩn hóa Query Parameters ───────────────────
    const search       = String(req.query.search || '').trim();
    const roleFilter   = String(req.query.role || '').trim().toLowerCase();
    const statusFilter = String(req.query.status || '').trim().toLowerCase();
    const page         = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit        = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip         = (page - 1) * limit;

    // ── Bước 2: Xác định Role IDs hợp lệ (chỉ renter & owner) ──
    const allowedRoleCodes = (roleFilter && ['renter', 'owner'].includes(roleFilter))
      ? [roleFilter]
      : ['renter', 'owner'];

    const roleDocuments = await Role.find({ code: { $in: allowedRoleCodes } }).select('_id code name');
    const allowedRoleIds = roleDocuments.map((r) => r._id);

    // ── Bước 3: Thiết lập bộ lọc cơ bản cho bảng Account ─────
    const accountBaseFilter = { roleId: { $in: allowedRoleIds } };
    if (statusFilter === 'active')   accountBaseFilter.isActive = true;
    if (statusFilter === 'inactive') accountBaseFilter.isActive = false;

    // ── Bước 4: Xử lý tìm kiếm linh hoạt (Tên, Email, Username, SĐT) ──
    let userFilter = {};
    const accountMap = {};

    if (search) {
      const searchPattern = new RegExp(escapeRegex(search), 'i');

      // 4a. Tìm trong Accounts theo Email hoặc Username
      const matchingAccounts = await Account
        .find({
          ...accountBaseFilter,
          $or: [
            { email   : searchPattern },
            { username: searchPattern },
          ],
        })
        .select('_id username email isActive roleId lastLogin createdAt')
        .populate('roleId', 'code name')
        .lean();

      matchingAccounts.forEach((acc) => {
        accountMap[String(acc._id)] = acc;
      });

      // 4b. Tìm trong Users theo Name hoặc Phone (Khắc phục triệt để lỗi khi tìm theo tên)
      const matchingUsers = await User
        .find({
          $or: [
            { name : searchPattern },
            { phone: searchPattern },
          ],
        })
        .select('accountId')
        .lean();

      const matchedAccountIdsFromUsers = matchingUsers
        .map((u) => u.accountId)
        .filter(Boolean);

      // Nếu có user tìm thấy theo name/phone, lấy Account của họ (nếu đúng role & status)
      if (matchedAccountIdsFromUsers.length > 0) {
        const extraAccounts = await Account
          .find({
            _id   : { $in: matchedAccountIdsFromUsers },
            ...accountBaseFilter,
          })
          .select('_id username email isActive roleId lastLogin createdAt')
          .populate('roleId', 'code name')
          .lean();

        extraAccounts.forEach((acc) => {
          accountMap[String(acc._id)] = acc;
        });
      }

      // Danh sách tất cả account IDs thỏa mãn tìm kiếm
      const targetAccountHexIds = Object.keys(accountMap);

      // Nếu không tìm thấy bất kỳ account nào phù hợp
      if (targetAccountHexIds.length === 0) {
        return res.status(200).json({
          success   : true,
          message   : 'Không tìm thấy người dùng phù hợp.',
          data      : [],
          pagination: {
            page,
            limit,
            total     : 0,
            totalPages: 0,
            hasNext   : false,
            hasPrev   : false,
          },
          filters: { search, role: roleFilter, status: statusFilter },
        });
      }

      // Chuyển sang mongoose ObjectId hợp lệ bằng từ khóa 'new'
      userFilter.accountId = {
        $in: targetAccountHexIds.map((id) => new mongoose.Types.ObjectId(id)),
      };
    } else {
      // Khi không có từ khóa tìm kiếm: lấy danh sách accounts theo role & status
      const accounts = await Account
        .find(accountBaseFilter)
        .select('_id username email isActive roleId lastLogin createdAt')
        .populate('roleId', 'code name')
        .lean();

      accounts.forEach((acc) => {
        accountMap[String(acc._id)] = acc;
      });

      const allAccountIds = accounts.map((a) => a._id);
      userFilter.accountId = { $in: allAccountIds };
    }

    // ── Bước 5: Đếm tổng số bản ghi phù hợp để phân trang ────
    const totalCount = await User.countDocuments(userFilter);

    // ── Bước 6: Truy vấn Users với phân trang và sắp xếp mới nhất ──
    const users = await User
      .find(userFilter)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 })
      .select('accountId username name phone address avatar trust wallet rating totalReviews isActive createdAt')
      .lean();

    // ── Bước 7: Ghép dữ liệu từ Account vào User (Enrichment) ──
    const enrichedUsers = users.map((user) => {
      const account = accountMap[String(user.accountId)] || {};
      return {
        _id          : user._id,
        accountId    : user.accountId,
        username     : account.username || user.username || '',
        name         : user.name || '',
        email        : account.email || '',
        phone        : user.phone || '',
        avatar       : user.avatar || null,
        role         : account.roleId?.code || 'renter',
        roleName     : account.roleId?.name || (account.roleId?.code === 'owner' ? 'Chủ sở hữu' : 'Người thuê'),
        isActive     : account.isActive ?? user.isActive ?? true,
        isVerified   : user.trust?.isVerified ?? false,
        trustScore   : user.trust?.score ?? 100,
        walletBalance: user.wallet?.balance ?? 0,
        rating       : user.rating ?? 5.0,
        totalReviews : user.totalReviews ?? 0,
        lastLogin    : account.lastLogin || null,
        joinedAt     : user.createdAt,
      };
    });

    // ── Bước 8: Trả về kết quả thành công ────────────────────
    return res.status(200).json({
      success   : true,
      message   : `Tìm thấy ${totalCount} người dùng.`,
      data      : enrichedUsers,
      pagination: {
        page,
        limit,
        total     : totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext   : page < Math.ceil(totalCount / limit),
        hasPrev   : page > 1,
      },
      filters: { search, role: roleFilter, status: statusFilter },
    });
  } catch (error) {
    console.error('[UserManagementController] Lỗi trong getUsersList:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy danh sách người dùng.',
      error  : error.message,
    });
  }
};

/**
 * ─────────────────────────────────────────────────────────────
 *  2. GET USER DETAIL (Xem chi tiết một người dùng)
 * ─────────────────────────────────────────────────────────────
 *  Dành cho việc mở rộng tính năng sau này (Issue #10, Profile Inspection)
 */
const getUserDetail = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Mã người dùng không hợp lệ.',
      });
    }

    const user = await User.findById(id).lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng.',
      });
    }

    const account = await Account.findById(user.accountId)
      .populate('roleId', 'code name')
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        ...user,
        account,
      },
    });
  } catch (error) {
    console.error('[UserManagementController] Lỗi trong getUserDetail:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi xem chi tiết người dùng.',
      error  : error.message,
    });
  }
};

/**
 * ─────────────────────────────────────────────────────────────
 *  3. TOGGLE USER STATUS (Khóa / Mở khóa tài khoản)
 * ─────────────────────────────────────────────────────────────
 *  Dành cho việc mở rộng tính năng sau này (Ban/Unban User)
 */
const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Mã người dùng không hợp lệ.',
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng.',
      });
    }

    const targetStatus = typeof isActive === 'boolean' ? isActive : !user.isActive;

    // Cập nhật cả bảng User và Account tương ứng
    user.isActive = targetStatus;
    await user.save();

    await Account.findByIdAndUpdate(user.accountId, { isActive: targetStatus });

    return res.status(200).json({
      success: true,
      message: targetStatus ? 'Đã mở khóa tài khoản thành công.' : 'Đã khóa tài khoản thành công.',
      data   : { userId: user._id, isActive: targetStatus },
    });
  } catch (error) {
    console.error('[UserManagementController] Lỗi trong toggleUserStatus:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi cập nhật trạng thái người dùng.',
      error  : error.message,
    });
  }
};

module.exports = {
  getUsersList,
  getUserDetail,
  toggleUserStatus,
};
