/**
 * ============================================================
 *  EKYC CONTROLLER
 *  server/src/controllers/ekycController.js
 * ============================================================
 *  Mục đích:
 *   - Quản lý quy trình định danh điện tử (eKYC) dành cho Renter.
 *   - Kiểm tra điều kiện: bắt buộc phải có địa chỉ trước khi xác thực.
 *   - Hỗ trợ tải ảnh CCCD lên Cloudinary (bộ lưu trữ đám mây).
 *   - Lưu trữ đơn vào collection `ekyc_requests` với trạng thái `pending`.
 * ============================================================
 */

const User = require('../models/User');
const Account = require('../models/Account');
const EkycRequest = require('../models/EkycRequest');
const { uploadToCloudinary } = require('../utils/cloudinary');

/**
 * ─────────────────────────────────────────────────────────────
 *  1. GET EKYC STATUS (Kiểm tra trạng thái xác thực của người dùng)
 * ─────────────────────────────────────────────────────────────
 *  Route: GET /api/ekyc/status
 *  Quyền: Renter / Người dùng đã đăng nhập (requireAuth)
 */
const getMyEkycStatus = async (req, res) => {
  try {
    const userId = (req.auth && (req.auth.id || req.auth._id)) || (req.user && req.user._id);

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Không xác định được danh tính người dùng.' });
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ người dùng.' });
    }

    const account = await Account.findById(user.accountId).select('email username').lean();

    // Tìm đơn eKYC gần nhất của người dùng
    const existingRequest = await EkycRequest.findOne({ userId }).lean();

    const isVerified = Boolean(user.trust?.isVerified || user.isVerified);
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
    const userId = (req.auth && (req.auth.id || req.auth._id)) || (req.user && req.user._id);

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
    const alreadyVerified = Boolean(user.trust?.isVerified || user.isVerified);
    if (alreadyVerified) {
      return res.status(400).json({
        success: false,
        code: 'ALREADY_VERIFIED',
        message: 'Tài khoản của bạn đã được xác thực danh tính.',
      });
    }

    // ── Lấy các trường gửi lên từ client ─────────────────────
    const { idCardNumber, idCardFrontUrl, idCardBackUrl, selfieUrl } = req.body;

    // Kiểm tra số CCCD
    if (!idCardNumber || !String(idCardNumber).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập Số Căn cước công dân (CCCD).',
      });
    }

    const cleanIdNumber = String(idCardNumber).trim();
    if (!/^\d{9,12}$/.test(cleanIdNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Số CCCD/CMND không hợp lệ (phải gồm 9 đến 12 chữ số).',
      });
    }

    // Kiểm tra ảnh mặt trước
    if (!idCardFrontUrl || !String(idCardFrontUrl).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng tải lên ảnh CCCD mặt trước.',
      });
    }

    // Kiểm tra ảnh mặt sau
    if (!idCardBackUrl || !String(idCardBackUrl).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng tải lên ảnh CCCD mặt sau.',
      });
    }

    // ── Lưu hoặc cập nhật đơn vào collection `ekyc_requests` ─
    // Nếu trước đó đơn bị rejected hoặc đang pending, cập nhật lại đơn mới với status pending
    const updateData = {
      userId: user._id,
      idCardNumber: cleanIdNumber,
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
 *  4. GET ADMIN EKYC SUBMISSIONS LIST (Dành cho Admin Dashboard)
 * ─────────────────────────────────────────────────────────────
 *  Route: GET /api/admin/ekyc hoặc GET /api/ekyc/admin/submissions
 *  Quyền: Admin (requireAuth, adminMiddleware)
 *  Tính năng:
 *   - Lấy danh sách các đơn xác thực từ collection ekyc_requests
 *   - Lọc theo status: 'all' | 'pending' | 'approved' | 'rejected'
 *   - Tìm kiếm theo số CCCD (idCardNumber), họ tên, email, SĐT
 *   - Phân trang, đếm tổng số lượng cho từng tab
 *   - Mới load list lên, chưa xử lý duyệt / từ chối
 */
const getAdminEkycSubmissions = async (req, res) => {
  try {
    const statusFilter = String(req.query.status || 'all').trim().toLowerCase();
    const search = String(req.query.search || '').trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    // ── Bước 1: Build filter cơ bản theo status ─────────────
    const filter = {};
    if (statusFilter && ['pending', 'approved', 'rejected'].includes(statusFilter)) {
      filter.status = statusFilter;
    }

    // ── Bước 2: Xử lý tìm kiếm ──────────────────────────────
    if (search) {
      const escapeRegex = (text) => text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      const searchRegex = new RegExp(escapeRegex(search), 'i');

      // Tìm các user có tên hoặc phone khớp search
      const matchedUsers = await User.find({
        $or: [{ name: searchRegex }, { phone: searchRegex }],
      }).select('_id').lean();

      const matchedUserIds = matchedUsers.map((u) => u._id);

      filter.$or = [
        { idCardNumber: searchRegex },
        { userId: { $in: matchedUserIds } },
      ];
    }

    // ── Bước 3: Đếm tổng số lượng cho từng trạng thái ───────
    const [totalAll, totalPending, totalApproved, totalRejected, totalMatched] = await Promise.all([
      EkycRequest.countDocuments({}),
      EkycRequest.countDocuments({ status: 'pending' }),
      EkycRequest.countDocuments({ status: 'approved' }),
      EkycRequest.countDocuments({ status: 'rejected' }),
      EkycRequest.countDocuments(filter),
    ]);

    // ── Bước 4: Truy vấn danh sách eKYC kèm thông tin user ──
    const submissions = await EkycRequest
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'userId',
        select: 'name phone email address avatar accountId createdAt',
        populate: {
          path: 'accountId',
          select: 'email username',
        },
      })
      .lean();

    // ── Bước 5: Chuẩn hóa dữ liệu trả về ────────────────────
    const formattedData = submissions.map((sub) => {
      const u = sub.userId || {};
      const acc = u.accountId || {};
      return {
        _id: sub._id,
        idCardNumber: sub.idCardNumber || '',
        idCardFrontUrl: sub.idCardFrontUrl || '',
        idCardBackUrl: sub.idCardBackUrl || '',
        selfieUrl: sub.selfieUrl || '',
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
          joinedAt: u.createdAt || null,
        },
      };
    });

    return res.status(200).json({
      success: true,
      message: `Tìm thấy ${totalMatched} đơn eKYC.`,
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
        totalPages: Math.ceil(totalMatched / limit) || 1,
        hasNextPage: page < Math.ceil(totalMatched / limit),
        hasPrevPage: page > 1,
      },
      filters: { status: statusFilter, search },
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

module.exports = {
  getMyEkycStatus,
  uploadEkycImage,
  submitEkycRequest,
  getAdminEkycSubmissions,
};
