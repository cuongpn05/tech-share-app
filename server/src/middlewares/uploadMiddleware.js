const multer = require('multer');

// Cấu hình lưu trữ bộ nhớ đệm (memoryStorage để upload trực tiếp lên Cloudinary)
const storage = multer.memoryStorage();

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(new Error('Chỉ chấp nhận file ảnh định dạng JPG, PNG, WEBP hoặc GIF'));
    }
    callback(null, true);
  },
});

const uploadDeviceImage = upload.single('image');
const uploadAvatar = upload.single('avatar');
const uploadSinglePhoto = upload.single('file');

// Middleware linh hoạt chấp nhận field name là 'image', 'photo', 'file', hoặc 'avatar'
const uploadFlexibleImage = (req, res, next) => {
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'photo', maxCount: 1 },
    { name: 'file', maxCount: 1 },
    { name: 'avatar', maxCount: 1 },
  ])(req, res, (err) => {
    if (err) return next(err);
    if (req.files) {
      req.file =
        req.files.image?.[0] ||
        req.files.photo?.[0] ||
        req.files.file?.[0] ||
        req.files.avatar?.[0] ||
        undefined;
    }
    next();
  });
};

module.exports = {
  upload,
  uploadDeviceImage,
  uploadAvatar,
  uploadSinglePhoto,
  uploadFlexibleImage,
};
