/**
 * ============================================================
 *  EKYC ROUTES
 *  server/src/routes/ekycRoutes.js
 * ============================================================
 *  Mục đích:
 *   - Định tuyến các API liên quan đến quy trình eKYC của renter.
 *   - Bảo vệ bằng middleware `requireAuth` (bắt buộc đăng nhập).
 *   - Các endpoint:
 *       GET  /status       -> Lấy trạng thái eKYC & thông tin hồ sơ
 *       POST /upload-image -> Tải ảnh CCCD lên Cloudinary
 *       POST /submit       -> Nộp đơn yêu cầu xác thực eKYC
 * ============================================================
 */

const express = require('express');
const {
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
} = require('../controllers/ekycController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { adminMiddleware } = require('../middlewares/adminMiddleware');
const { uploadFlexibleImage } = require('../middlewares/uploadMiddleware');

const router = express.Router();

// Tất cả các routes eKYC đều yêu cầu người dùng đăng nhập
router.use(requireAuth);

// 1. Kiểm tra trạng thái xác thực eKYC và dữ liệu hồ sơ
router.get('/status', getMyEkycStatus);

// 2. Tải ảnh CCCD / chân dung lên Cloudinary
router.post('/upload-image', uploadFlexibleImage, uploadEkycImage);

// 3. Nộp đơn yêu cầu xác thực eKYC Renter
router.post('/submit', submitEkycRequest);

// 4. Quy trình eKYC nâng cấp Renter đã xác thực lên Owner
router.get('/owner/status', getMyOwnerEkycStatus);
router.post('/owner/submit', submitOwnerEkycRequest);

// 5. Lấy danh sách & duyệt đơn xác thực eKYC (Admin)
router.get('/admin/submissions', adminMiddleware, getAdminEkycSubmissions);
router.patch('/admin/submissions/:id/approve', adminMiddleware, approveEkycSubmission);
router.patch('/admin/submissions/:id/reject', adminMiddleware, rejectEkycSubmission);

router.get('/admin/owner-submissions', adminMiddleware, getAdminOwnerEkycSubmissions);
router.patch('/admin/owner-submissions/:id/approve', adminMiddleware, approveOwnerEkycSubmission);
router.patch('/admin/owner-submissions/:id/reject', adminMiddleware, rejectOwnerEkycSubmission);

module.exports = router;
