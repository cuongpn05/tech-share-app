const multer = require('multer');

// Cấu hình lưu trữ bộ nhớ đệm
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const uploadDeviceImage = upload.single('image');

module.exports = {
  uploadDeviceImage,
};
