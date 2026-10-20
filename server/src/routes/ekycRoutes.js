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
} = require('../controllers/ekycController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { uploadFlexibleImage } = require('../middlewares/uploadMiddleware');

const router = express.Router();

// Tất cả các routes eKYC đều yêu cầu người dùng đăng nhập
router.use(requireAuth);

// 1. Kiểm tra trạng thái xác thực eKYC và dữ liệu hồ sơ
router.get('/status', getMyEkycStatus);

// 2. Tải ảnh CCCD (mặt trước / mặt sau) lên Cloudinary
router.post('/upload-image', uploadFlexibleImage, uploadEkycImage);

// 3. Nộp đơn yêu cầu xác thực eKYC
router.post('/submit', submitEkycRequest);

module.exports = router;
