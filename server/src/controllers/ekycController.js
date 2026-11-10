/**
 * ============================================================
 *  EKYC CONTROLLER
 *  server/src/controllers/ekycController.js
 * ============================================================
 *  Mục đích:
 *   - Quản lý quy trình định danh điện tử (eKYC) dành cho Renter (`ekyc_requests`).
 *   - Quản lý quy trình eKYC nâng cấp Renter đã xác thực lên Owner (`owner_ekyc_requests`).
 *   - Kiểm tra điều kiện: bắt buộc phải có địa chỉ; riêng Owner eKYC bắt buộc Renter đã xác thực.
 *   - Hỗ trợ tải ảnh CCCD / chân dung cầm CCCD lên Cloudinary.
 * ============================================================
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const Account = require('../models/Account');
const Role = require('../models/Role');
const EkycRequest = require('../models/EkycRequest');
const OwnerEkycRequest = require('../models/OwnerEkycRequest');
const { uploadToCloudinary } = require('../utils/cloudinary');
const { createAndSendNotification } = require('../services/notificationService');
const { getIO } = require('../socket');

const DEFAULT_ROLE_DEFINITIONS = {
  renter: {
    code: 'renter',
    name: 'Người thuê',
    description: 'Tài khoản người thuê thiết bị',
    permissions: ['rent_device', 'review_device', 'chat'],
  },
  owner: {
    code: 'owner',
    name: 'Chủ sở hữu',
    description: 'Tài khoản chủ sở hữu thiết bị',
    permissions: ['rent_device', 'list_device', 'manage_device', 'review_device', 'chat'],
  },
};

function getAuthUserId(req) {
  return (req.auth && (req.auth.id || req.auth._id)) || (req.user && req.user._id);
}

function validateIdCardNumber(idCardNumber) {
  if (!idCardNumber || !String(idCardNumber).trim()) {
    return { valid: false, message: 'Vui lòng nhập Số Căn cước công dân (CCCD).' };
  }
  const cleanIdNumber = String(idCardNumber).trim();
  if (!/^\d{9,12}$/.test(cleanIdNumber)) {
    return { valid: false, message: 'Số CCCD/CMND không hợp lệ (phải gồm 9 đến 12 chữ số).' };
  }
  return { valid: true, value: cleanIdNumber };
}

async function ensureRoleDocument(code) {
  let roleDoc = await Role.findOne({ code });
  if (!roleDoc && DEFAULT_ROLE_DEFINITIONS[code]) {
    roleDoc = await Role.create(DEFAULT_ROLE_DEFINITIONS[code]);
  }
  return roleDoc;
}

function formatOwnerEkycDto(doc) {
  if (!doc) return null;
  return {
    _id: doc._id,
    idCardNumber: doc.idCardNumber || '',
    idCardFrontUrl: doc.idCardFrontUrl || '',
    idCardBackUrl: doc.idCardBackUrl || '',
    selfieWithIdUrl: doc.selfieWithIdUrl || '',
    status: doc.status,
    rejectReason: doc.rejectReason || '',
    reviewedAt: doc.reviewedAt || null,
    createdAt: doc.createdAt,
  };
}

/**
 * Truy vấn danh sách đơn eKYC dùng chung cho Admin (Renter eKYC & Owner Upgrade eKYC)
 */
async function queryAdminEkycList(Model, queryParams) {
  const statusFilter = String(queryParams.status || 'all').trim().toLowerCase();
  const search = String(queryParams.search || '').trim();
  const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = {};
  if (statusFilter && ['pending', 'approved', 'rejected'].includes(statusFilter)) {
    filter.status = statusFilter;
  }

  if (search) {
    const escapeRegex = (text) => text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const searchRegex = new RegExp(escapeRegex(search), 'i');

    const [matchedAccounts, matchedUsers] = await Promise.all([
      Account.find({ $or: [{ email: searchRegex }, { username: searchRegex }] })
        .select('_id')
        .lean(),
      User.find({ $or: [{ name: searchRegex }, { phone: searchRegex }] })
        .select('_id')
        .lean(),
    ]);

    const matchedAccountIds = matchedAccounts.map((a) => a._id);
    let extraUserIds = [];
    if (matchedAccountIds.length > 0) {
      const usersFromAccounts = await User.find({ accountId: { $in: matchedAccountIds } })
        .select('_id')
        .lean();
      extraUserIds = usersFromAccounts.map((u) => u._id);
    }

    const matchedUserIds = [...matchedUsers.map((u) => u._id), ...extraUserIds];
    filter.$or = [
      { idCardNumber: searchRegex },
      { userId: { $in: matchedUserIds } },
    ];
  }

  const [totalAll, totalPending, totalApproved, totalRejected, totalMatched] = await Promise.all([
    Model.countDocuments({}),
    Model.countDocuments({ status: 'pending' }),
    Model.countDocuments({ status: 'approved' }),
    Model.countDocuments({ status: 'rejected' }),
    Model.countDocuments(filter),
  ]);

  const submissions = await Model
    .find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate({
      path: 'userId',
      select: 'name phone email address avatar accountId createdAt',
      populate: {
        path: 'accountId',
        select: 'email username roleId',
        populate: {
          path: 'roleId',
          select: 'code name',
        },
      },
    })
    .lean();

  const formattedData = submissions.map((sub) => {
    const u = sub.userId || {};
    const acc = u.accountId || {};
    return {
      _id: sub._id,
      idCardNumber: sub.idCardNumber || '',
      idCardFrontUrl: sub.idCardFrontUrl || '',
      idCardBackUrl: sub.idCardBackUrl || '',
      selfieUrl: sub.selfieUrl || '',
      selfieWithIdUrl: sub.selfieWithIdUrl || '',
      status: sub.status || 'pending',
      rejectReason: sub.rejectReason || '',
      reviewedAt: sub.reviewedAt || null,
      createdAt: sub.createdAt,
      user: {
        _id: u._id || null,
        name: u.name || 'Người dùng',
        email: acc.email || u.email || 'Chưa cập nhật',
        phone: u.phone || 'Chưa cập nhật',
        address: u.address || 'Chưa cập nhật',
        avatar: u.avatar || null,
        role: acc.roleId?.code || 'renter',
        joinedAt: u.createdAt || null,
      },
    };
  });

  const totalPages = Math.ceil(totalMatched / limit) || 1;
  return {
    data: formattedData,
    counts: {
      totalAll,
      totalPending,
      totalApproved,
      totalRejected,
    },
    pagination: {
      page,
      limit,
      total: totalMatched,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    filters: { status: statusFilter, search },
  };
}

function emitRoleUpdate(user, roleCode) {
  try {
    const io = getIO();
    if (!io || !user) return;
    const payload = {
      userId: user._id.toString(),
      accountId: user.accountId ? user.accountId.toString() : '',
      role: roleCode,
    };
    io.to(`user_${user._id}`).emit('role_updated', payload);
    if (user.accountId) {
      io.to(`user_${user.accountId}`).emit('role_updated', payload);
    }
  } catch (socketErr) {
    console.warn('[EkycController] Socket emit role_updated error:', socketErr.message);
  }
}

/**
 * ─────────────────────────────────────────────────────────────
 *  1. GET EKYC STATUS (Kiểm tra trạng thái xác thực của người dùng)
 * ─────────────────────────────────────────────────────────────
 *  Route: GET /api/ekyc/status
 *  Quyền: Renter / Người dùng đã đăng nhập (requireAuth)
 */
const getMyEkycStatus = async (req, res) => {
  try {
    const userId = getAuthUserId(req);

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Không xác định được danh tính người dùng.' });
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ người dùng.' });
    }

    const [account, existingRequest, existingOwnerRequest] = await Promise.all([
      Account.findById(user.accountId).select('email username roleId').populate('roleId', 'code').lean(),
      EkycRequest.findOne({ userId }).sort({ createdAt: -1 }).lean(),
      OwnerEkycRequest.findOne({ userId }).sort({ createdAt: -1 }).lean(),
    ]);

    const roleCode = account?.roleId?.code || req.userRole || user.role || 'renter';
    const isApproved = existingRequest?.status === 'approved';
    const isAdmin = roleCode === 'admin';
    const isVerified = Boolean(isAdmin || isApproved);

    // Đồng bộ nếu user trong DB bị lệch trạng thái
    const currentDbVerified = Boolean(user.trust?.isVerified || user.isVerified);
    if (currentDbVerified !== isVerified) {
      await User.updateOne(
        { _id: user._id },
        { $set: { isVerified: isVerified, 'trust.isVerified': isVerified } }
      );
    }

    const hasAddress = Boolean(user.address && user.address.trim().length > 0);

    return res.status(200).json({
      success: true,
      data: {
        isVerified,
        hasAddress,
        profile: {
          _id: user._id,
          name: user.name || '',
          email: account?.email || user.email || '',
          phone: user.phone || '',
          address: user.address || '',
          avatar: user.avatar || null,
          role: roleCode,
        },
        ekycRequest: existingRequest
          ? {
              _id: existingRequest._id,
              idCardNumber: existingRequest.idCardNumber || '',
              idCardFrontUrl: existingRequest.idCardFrontUrl,
              idCardBackUrl: existingRequest.idCardBackUrl,
              selfieUrl: existingRequest.selfieUrl || '',
              status: existingRequest.status,
              rejectReason: existingRequest.rejectReason || '',
              createdAt: existingRequest.createdAt,
            }
          : null,
        ownerEkycRequest: formatOwnerEkycDto(existingOwnerRequest),
      },
    });
  } catch (error) {
    console.error('[EkycController] Lỗi trong getMyEkycStatus:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy trạng thái xác thực eKYC.',
      error: error.message,
    });
  }
};

/**
 * ─────────────────────────────────────────────────────────────
 *  2. UPLOAD EKYC IMAGE (Tải ảnh CCCD lên Cloudinary)
 * ─────────────────────────────────────────────────────────────
 *  Route: POST /api/ekyc/upload-image
 *  Quyền: Người dùng đã đăng nhập (requireAuth)
 */
const uploadEkycImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn file ảnh hợp lệ (JPEG, PNG, WebP).',
      });
    }

    // Tải ảnh trực tiếp lên Cloudinary vào thư mục techshare/ekyc
    const secureUrl = await uploadToCloudinary(req.file, 'techshare/ekyc');

    if (!secureUrl) {
      return res.status(502).json({
        success: false,
        message: 'Tải ảnh lên Cloudinary thất bại. Vui lòng thử lại.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Tải ảnh lên Cloudinary thành công.',
      data: { url: secureUrl },
    });
  } catch (error) {
    console.error('[EkycController] Lỗi trong uploadEkycImage:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi tải ảnh lên.',
      error: error.message,
    });
  }
};

/**
 * ─────────────────────────────────────────────────────────────
 *  3. SUBMIT EKYC APPLICATION (Gửi đơn xác thực danh tính eKYC)
 * ─────────────────────────────────────────────────────────────
 *  Route: POST /api/ekyc/submit
 *  Quyền: Renter đã đăng nhập (requireAuth)
 *  Lưu vào collection `ekyc_requests` với status: 'pending'
 */
const submitEkycRequest = async (req, res) => {
  try {
    const userId = getAuthUserId(req);

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để gửi đơn xác thực.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin tài khoản người dùng.' });
    }

    // ── Kiểm tra điều kiện 1: Bắt buộc đã cập nhật địa chỉ ─────
    if (!user.address || !user.address.trim()) {
      return res.status(400).json({
        success: false,
        code: 'ADDRESS_REQUIRED',
        message: 'Bạn chưa cập nhật địa chỉ. Vui lòng cập nhật địa chỉ trong hồ sơ trước khi thực hiện xác thực eKYC.',
      });
    }

    // ── Kiểm tra điều kiện 2: Đã xác thực rồi thì không cần làm lại ──
    const approvedRequest = await EkycRequest.findOne({ userId: user._id, status: 'approved' });
    const isAlreadyVerified = Boolean(req.userRole === 'admin' || user.role === 'admin' || approvedRequest);
    if (isAlreadyVerified) {
      return res.status(400).json({
        success: false,
        code: 'ALREADY_VERIFIED',
        message: 'Tài khoản của bạn đã được xác thực danh tính.',
      });
    }

    // ── Lấy các trường gửi lên từ client ─────────────────────
    const { idCardNumber, idCardFrontUrl, idCardBackUrl, selfieUrl } = req.body;

    const idValidation = validateIdCardNumber(idCardNumber);
    if (!idValidation.valid) {
      return res.status(400).json({ success: false, message: idValidation.message });
    }

    if (!idCardFrontUrl || !String(idCardFrontUrl).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng tải lên ảnh CCCD mặt trước.',
      });
    }

    if (!idCardBackUrl || !String(idCardBackUrl).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng tải lên ảnh CCCD mặt sau.',
      });
    }

    // ── Lưu hoặc cập nhật đơn vào collection `ekyc_requests` ─
    const updateData = {
      userId: user._id,
      idCardNumber: idValidation.value,
      idCardFrontUrl: String(idCardFrontUrl).trim(),
      idCardBackUrl: String(idCardBackUrl).trim(),
      selfieUrl: selfieUrl ? String(selfieUrl).trim() : '',
      status: 'pending',
      rejectReason: '',
      reviewedBy: null,
      reviewedAt: null,
    };

    const savedRequest = await EkycRequest.findOneAndUpdate(
      { userId: user._id },
      { $set: updateData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(201).json({
      success: true,
      message: 'Gửi đơn xác thực danh tính (eKYC) thành công. Vui lòng chờ ban quản trị xét duyệt.',
      data: savedRequest,
    });
  } catch (error) {
    console.error('[EkycController] Lỗi trong submitEkycRequest:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi gửi đơn xác thực eKYC.',
      error: error.message,
    });
  }
};

/**
 * ─────────────────────────────────────────────────────────────
 *  4. GET OWNER EKYC STATUS (Kiểm tra điều kiện & trạng thái nâng cấp Owner)
 * ─────────────────────────────────────────────────────────────
 *  Route: GET /api/ekyc/owner/status
 *  Quyền: Người dùng đã đăng nhập (requireAuth)
 */
const getMyOwnerEkycStatus = async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Không xác định được danh tính người dùng.' });
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ người dùng.' });
    }

    const [account, renterRequest, ownerRequest] = await Promise.all([
      Account.findById(user.accountId).select('email username roleId').populate('roleId', 'code').lean(),
      EkycRequest.findOne({ userId }).sort({ createdAt: -1 }).lean(),
      OwnerEkycRequest.findOne({ userId }).sort({ createdAt: -1 }).lean(),
    ]);

    const roleCode = account?.roleId?.code || req.userRole || user.role || 'renter';
    const isRenterVerified = Boolean(roleCode === 'admin' || renterRequest?.status === 'approved');
    const isOwner = roleCode === 'owner';
    const hasAddress = Boolean(user.address && user.address.trim().length > 0);

    return res.status(200).json({
      success: true,
      data: {
        role: roleCode,
        isRenterVerified,
        isOwner,
        hasAddress,
        profile: {
          _id: user._id,
          name: user.name || '',
          email: account?.email || user.email || '',
          phone: user.phone || '',
          address: user.address || '',
          avatar: user.avatar || null,
          role: roleCode,
        },
        renterEkyc: renterRequest
          ? {
              _id: renterRequest._id,
              idCardNumber: renterRequest.idCardNumber || '',
              status: renterRequest.status,
            }
          : null,
        ownerEkycRequest: formatOwnerEkycDto(ownerRequest),
      },
    });
  } catch (error) {
    console.error('[EkycController] Lỗi trong getMyOwnerEkycStatus:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy trạng thái eKYC nâng cấp Owner.',
      error: error.message,
    });
  }
};

/**
 * ─────────────────────────────────────────────────────────────
 *  5. SUBMIT OWNER EKYC REQUEST (Renter đã xác thực gửi đơn lên Owner)
 * ─────────────────────────────────────────────────────────────
 *  Route: POST /api/ekyc/owner/submit
 *  Quyền: Renter đã xác thực eKYC (requireAuth)
 *  Lưu vào collection `owner_ekyc_requests` với status: 'pending'
 */
const submitOwnerEkycRequest = async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Yêu cầu đăng nhập để gửi đơn nâng cấp Owner.' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin tài khoản người dùng.' });
    }

    const account = await Account.findById(user.accountId).populate('roleId', 'code');
    const roleCode = account?.roleId?.code || req.userRole || user.role || 'renter';

    if (roleCode === 'owner' || roleCode === 'admin') {
      return res.status(400).json({
        success: false,
        code: 'ALREADY_OWNER',
        message: 'Tài khoản của bạn đã có quyền Chủ sở hữu (Owner).',
      });
    }

    // Bắt buộc Renter phải hoàn tất xác thực eKYC Renter trước
    const approvedRenterEkyc = await EkycRequest.findOne({ userId: user._id, status: 'approved' }).lean();
    if (!approvedRenterEkyc) {
      return res.status(403).json({
        success: false,
        code: 'RENTER_EKYC_REQUIRED',
        message: 'Bạn phải hoàn tất xác thực eKYC Renter trước khi gửi đơn nâng cấp lên Owner.',
      });
    }

    if (!user.address || !user.address.trim()) {
      return res.status(400).json({
        success: false,
        code: 'ADDRESS_REQUIRED',
        message: 'Bạn chưa cập nhật địa chỉ. Vui lòng cập nhật địa chỉ trong hồ sơ trước khi gửi đơn.',
      });
    }

    const existingOwnerRequest = await OwnerEkycRequest.findOne({ userId: user._id }).lean();
    if (existingOwnerRequest?.status === 'approved') {
      return res.status(400).json({
        success: false,
        code: 'ALREADY_OWNER_VERIFIED',
        message: 'Đơn eKYC nâng cấp Owner của bạn đã được phê duyệt.',
      });
    }
    if (existingOwnerRequest?.status === 'pending') {
      return res.status(400).json({
        success: false,
        code: 'OWNER_EKYC_ALREADY_PENDING',
        message: 'Đơn eKYC nâng cấp Owner của bạn đang chờ quản trị viên xét duyệt.',
      });
    }

    const { idCardNumber, idCardFrontUrl, idCardBackUrl, selfieWithIdUrl, selfieUrl } = req.body;
    const resolvedSelfieUrl = selfieWithIdUrl || selfieUrl;

    const idValidation = validateIdCardNumber(idCardNumber);
    if (!idValidation.valid) {
      return res.status(400).json({ success: false, message: idValidation.message });
    }

    if (!idCardFrontUrl || !String(idCardFrontUrl).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng tải lên ảnh CCCD mặt trước.',
      });
    }

    if (!idCardBackUrl || !String(idCardBackUrl).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng tải lên ảnh CCCD mặt sau.',
      });
    }

    if (!resolvedSelfieUrl || !String(resolvedSelfieUrl).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng tải lên ảnh chân dung cầm CCCD.',
      });
    }

    const updateData = {
      userId: user._id,
      idCardNumber: idValidation.value,
      idCardFrontUrl: String(idCardFrontUrl).trim(),
      idCardBackUrl: String(idCardBackUrl).trim(),
      selfieWithIdUrl: String(resolvedSelfieUrl).trim(),
      status: 'pending',
      rejectReason: '',
      reviewedBy: null,
      reviewedAt: null,
    };

    const savedRequest = await OwnerEkycRequest.findOneAndUpdate(
      { userId: user._id },
      { $set: updateData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(201).json({
      success: true,
      message: 'Gửi đơn eKYC nâng cấp lên Owner thành công. Vui lòng chờ ban quản trị xét duyệt.',
      data: savedRequest,
    });
  } catch (error) {
    console.error('[EkycController] Lỗi trong submitOwnerEkycRequest:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi gửi đơn eKYC nâng cấp Owner.',
      error: error.message,
    });
  }
};

/**
 * ─────────────────────────────────────────────────────────────
 *  6. GET ADMIN EKYC SUBMISSIONS LIST (Renter eKYC - Admin Dashboard)
 * ─────────────────────────────────────────────────────────────
 *  Route: GET /api/admin/ekyc hoặc GET /api/ekyc/admin/submissions
 *  Quyền: Admin (requireAuth, adminMiddleware)
 */
const getAdminEkycSubmissions = async (req, res) => {
  try {
    const result = await queryAdminEkycList(EkycRequest, req.query);
    return res.status(200).json({
      success: true,
      message: `Tìm thấy ${result.pagination.total} đơn eKYC.`,
      ...result,
    });
  } catch (error) {
    console.error('[EkycController] Lỗi trong getAdminEkycSubmissions:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy danh sách đơn xác thực eKYC.',
      error: error.message,
    });
  }
};

/**
 * ─────────────────────────────────────────────────────────────
 *  7. GET ADMIN OWNER EKYC SUBMISSIONS LIST (Owner Upgrade eKYC)
 * ─────────────────────────────────────────────────────────────
 *  Route: GET /api/admin/owner-ekyc hoặc GET /api/ekyc/admin/owner-submissions
 *  Quyền: Admin (requireAuth, adminMiddleware)
 */
const getAdminOwnerEkycSubmissions = async (req, res) => {
  try {
    const result = await queryAdminEkycList(OwnerEkycRequest, req.query);
    return res.status(200).json({
      success: true,
      message: `Tìm thấy ${result.pagination.total} đơn eKYC nâng cấp Owner.`,
      ...result,
    });
  } catch (error) {
    console.error('[EkycController] Lỗi trong getAdminOwnerEkycSubmissions:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi lấy danh sách đơn eKYC nâng cấp Owner.',
      error: error.message,
    });
  }
};

/**
 * ─────────────────────────────────────────────────────────────
 *  8. APPROVE EKYC SUBMISSION (Admin duyệt đơn eKYC Renter)
 * ─────────────────────────────────────────────────────────────
 *  Route: PATCH /api/admin/ekyc/:id/approve
 *  Quyền: Admin (requireAuth, adminMiddleware)
 */
const approveEkycSubmission = async (req, res) => {
  try {
    const adminId = getAuthUserId(req);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid eKYC submission ID.' });
    }

    const ekycRequest = await EkycRequest.findById(id);
    if (!ekycRequest) {
      return res.status(404).json({
        success: false,
        message: 'eKYC verification submission not found.',
      });
    }

    ekycRequest.status = 'approved';
    ekycRequest.rejectReason = '';
    ekycRequest.reviewedBy = adminId;
    ekycRequest.reviewedAt = new Date();
    await ekycRequest.save();

    // Cập nhật trạng thái xác minh của User thành true
    await User.updateOne(
      { _id: ekycRequest.userId },
      {
        $set: {
          isVerified: true,
          'trust.isVerified': true,
        },
      }
    );

    // Gửi thông báo đến người dùng
    try {
      await createAndSendNotification({
        userId: ekycRequest.userId,
        title: 'eKYC Application Approved ✅',
        body: 'Congratulations! Your identity verification (eKYC) application has been approved by administrators. You are now eligible to rent technology devices on TechShare.',
        type: 'system',
        relatedId: ekycRequest._id,
        data: {
          ekycId: ekycRequest._id.toString(),
          status: 'approved',
        },
      });
    } catch (notifErr) {
      console.warn('[EkycController] Lỗi gửi thông báo phê duyệt eKYC:', notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'eKYC verification application approved successfully.',
      data: ekycRequest,
    });
  } catch (error) {
    console.error('[EkycController] Lỗi trong approveEkycSubmission:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi phê duyệt đơn xác thực eKYC.',
      error: error.message,
    });
  }
};

/**
 * ─────────────────────────────────────────────────────────────
 *  9. REJECT EKYC SUBMISSION (Admin từ chối đơn eKYC Renter kèm lý do)
 * ─────────────────────────────────────────────────────────────
 *  Route: PATCH /api/admin/ekyc/:id/reject
 *  Quyền: Admin (requireAuth, adminMiddleware)
 */
const rejectEkycSubmission = async (req, res) => {
  try {
    const adminId = getAuthUserId(req);
    const { id } = req.params;
    const reason = String(req.body.reason || req.body.rejectReason || '').trim();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid eKYC submission ID.' });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a reason for rejecting the eKYC application.',
      });
    }

    const ekycRequest = await EkycRequest.findById(id);
    if (!ekycRequest) {
      return res.status(404).json({
        success: false,
        message: 'eKYC verification submission not found.',
      });
    }

    ekycRequest.status = 'rejected';
    ekycRequest.rejectReason = reason;
    ekycRequest.reviewedBy = adminId;
    ekycRequest.reviewedAt = new Date();
    await ekycRequest.save();

    // Cập nhật trạng thái xác minh của User thành false
    await User.updateOne(
      { _id: ekycRequest.userId },
      {
        $set: {
          isVerified: false,
          'trust.isVerified': false,
        },
      }
    );

    // Gửi thông báo đến người dùng kèm lý do từ chối
    try {
      await createAndSendNotification({
        userId: ekycRequest.userId,
        title: 'eKYC Application Rejected ❌',
        body: `Your identity verification (eKYC) application was rejected. Reason: ${reason}`,
        type: 'system',
        relatedId: ekycRequest._id,
        data: {
          ekycId: ekycRequest._id.toString(),
          status: 'rejected',
          reason,
        },
      });
    } catch (notifErr) {
      console.warn('[EkycController] Lỗi gửi thông báo từ chối eKYC:', notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'eKYC verification application has been rejected.',
      data: ekycRequest,
    });
  } catch (error) {
    console.error('[EkycController] Lỗi trong rejectEkycSubmission:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi từ chối đơn xác thực eKYC.',
      error: error.message,
    });
  }
};

/**
 * ─────────────────────────────────────────────────────────────
 *  10. APPROVE OWNER EKYC SUBMISSION (Admin duyệt Renter thành Owner)
 * ─────────────────────────────────────────────────────────────
 *  Route: PATCH /api/admin/owner-ekyc/:id/approve
 *  Quyền: Admin (requireAuth, adminMiddleware)
 */
const approveOwnerEkycSubmission = async (req, res) => {
  try {
    const adminId = getAuthUserId(req);
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid Owner eKYC submission ID.' });
    }

    const ownerRequest = await OwnerEkycRequest.findById(id);
    if (!ownerRequest) {
      return res.status(404).json({
        success: false,
        message: 'Owner eKYC submission not found.',
      });
    }

    const user = await User.findById(ownerRequest.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Applicant user profile not found.',
      });
    }

    const ownerRole = await ensureRoleDocument('owner');
    if (!ownerRole) {
      return res.status(500).json({
        success: false,
        message: 'Owner role configuration not found in database.',
      });
    }

    ownerRequest.status = 'approved';
    ownerRequest.rejectReason = '';
    ownerRequest.reviewedBy = adminId;
    ownerRequest.reviewedAt = new Date();
    await ownerRequest.save();

    // Nâng cấp Account roleId lên 'owner' (trừ trường hợp account là admin)
    let upgradedToOwner = false;
    if (user.accountId) {
      const account = await Account.findById(user.accountId).populate('roleId', 'code');
      const currentCode = account?.roleId?.code;
      if (account && currentCode !== 'admin') {
        account.roleId = ownerRole._id;
        await account.save();
        upgradedToOwner = true;
      }
    }

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          isVerified: true,
          'trust.isVerified': true,
        },
      }
    );

    if (upgradedToOwner) {
      emitRoleUpdate(user, 'owner');
    }

    try {
      await createAndSendNotification({
        userId: user._id,
        title: 'Owner Upgrade Approved 🎉',
        body: 'Congratulations! Your Owner eKYC submission has been approved. Your account has been upgraded to Owner and you can now list devices on TechShare.',
        type: 'system',
        relatedId: ownerRequest._id,
        data: {
          ownerEkycId: ownerRequest._id.toString(),
          status: 'approved',
          role: 'owner',
        },
      });
    } catch (notifErr) {
      console.warn('[EkycController] Lỗi gửi thông báo duyệt Owner eKYC:', notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Owner eKYC approved and user upgraded to owner successfully.',
      data: ownerRequest,
    });
  } catch (error) {
    console.error('[EkycController] Lỗi trong approveOwnerEkycSubmission:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi phê duyệt đơn nâng cấp Owner.',
      error: error.message,
    });
  }
};

/**
 * ─────────────────────────────────────────────────────────────
 *  11. REJECT OWNER EKYC SUBMISSION (Admin từ chối đơn nâng cấp Owner)
 * ─────────────────────────────────────────────────────────────
 *  Route: PATCH /api/admin/owner-ekyc/:id/reject
 *  Quyền: Admin (requireAuth, adminMiddleware)
 */
const rejectOwnerEkycSubmission = async (req, res) => {
  try {
    const adminId = getAuthUserId(req);
    const { id } = req.params;
    const reason = String(req.body.reason || req.body.rejectReason || '').trim();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid Owner eKYC submission ID.' });
    }

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a reason for rejecting the Owner eKYC application.',
      });
    }

    const ownerRequest = await OwnerEkycRequest.findById(id);
    if (!ownerRequest) {
      return res.status(404).json({
        success: false,
        message: 'Owner eKYC submission not found.',
      });
    }

    const wasApproved = ownerRequest.status === 'approved';
    ownerRequest.status = 'rejected';
    ownerRequest.rejectReason = reason;
    ownerRequest.reviewedBy = adminId;
    ownerRequest.reviewedAt = new Date();
    await ownerRequest.save();

    // Lưu ý: KHÔNG tắt isVerified của Renter vì đơn eKYC Renter đã được duyệt trước đó.
    // Chỉ hoàn tác role từ owner -> renter nếu admin thu hồi đơn đã duyệt trước đó.
    if (wasApproved) {
      const user = await User.findById(ownerRequest.userId);
      const renterRole = await ensureRoleDocument('renter');
      if (user?.accountId && renterRole) {
        const account = await Account.findById(user.accountId).populate('roleId', 'code');
        if (account && account.roleId?.code === 'owner') {
          account.roleId = renterRole._id;
          await account.save();
          emitRoleUpdate(user, 'renter');
        }
      }
    }

    try {
      await createAndSendNotification({
        userId: ownerRequest.userId,
        title: 'Owner Upgrade Application Rejected ❌',
        body: `Your Owner eKYC upgrade request was rejected. Reason: ${reason}`,
        type: 'system',
        relatedId: ownerRequest._id,
        data: {
          ownerEkycId: ownerRequest._id.toString(),
          status: 'rejected',
          reason,
        },
      });
    } catch (notifErr) {
      console.warn('[EkycController] Lỗi gửi thông báo từ chối Owner eKYC:', notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Owner eKYC application has been rejected.',
      data: ownerRequest,
    });
  } catch (error) {
    console.error('[EkycController] Lỗi trong rejectOwnerEkycSubmission:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi máy chủ khi từ chối đơn nâng cấp Owner.',
      error: error.message,
    });
  }
};

module.exports = {
  getMyEkycStatus,
  uploadEkycImage,
  submitEkycRequest,
  getMyOwnerEkycStatus,
  submitOwnerEkycRequest,
  getAdminEkycSubmissions,
  getAdminOwnerEkycSubmissions,
  approveEkycSubmission,
  rejectEkycSubmission,
  approveOwnerEkycSubmission,
  rejectOwnerEkycSubmission,
};
