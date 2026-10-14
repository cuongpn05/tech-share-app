const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadDirectory = path.resolve(__dirname, "../../uploads");
fs.mkdirSync(uploadDirectory, { recursive: true });

const extensionsByMimeType = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const storage = multer.diskStorage({
  destination: uploadDirectory,
  filename: (req, file, callback) => {
    callback(null, `${crypto.randomUUID()}${extensionsByMimeType[file.mimetype] || ".img"}`);
  },
});

const uploadDeviceImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    callback(null, Object.hasOwn(extensionsByMimeType, file.mimetype));
  },
});

module.exports = uploadDeviceImage;
