const fs = require('fs');

/**
 * Upload an image file (Buffer, disk path, or Base64) to Cloudinary via unsigned upload preset
 * Uses CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET from .env
 *
 * @param {Object|string} file - Multer file object ({ buffer, mimetype, originalname } or { path }) or base64 string
 * @param {string} folder - Target folder on Cloudinary (e.g. 'techshare/devices', 'techshare/handover', 'techshare/chats')
 * @returns {Promise<string|null>} Cloudinary secure_url or null if failed
 */
async function uploadToCloudinary(file, folder = 'techshare/devices') {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    console.warn('[Cloudinary] Missing CLOUDINARY_CLOUD_NAME or CLOUDINARY_UPLOAD_PRESET in .env');
    return null;
  }

  try {
    const formData = new FormData();
    formData.append('upload_preset', uploadPreset);
    if (folder) {
      formData.append('folder', folder);
    }

    if (typeof file === 'string') {
      // Base64 data URI string or URL
      if (file.startsWith('http://') || file.startsWith('https://')) {
        return file;
      }
      formData.append('file', file);
    } else if (file && file.buffer) {
      // Multer memoryStorage
      const mimeType = file.mimetype || 'image/jpeg';
      const blob = new Blob([file.buffer], { type: mimeType });
      formData.append('file', blob, file.originalname || `upload-${Date.now()}.jpg`);
    } else if (file && file.path && fs.existsSync(file.path)) {
      // Multer diskStorage
      const mimeType = file.mimetype || 'image/jpeg';
      const fileData = fs.readFileSync(file.path);
      const blob = new Blob([fileData], { type: mimeType });
      formData.append('file', blob, file.originalname || file.filename || `upload-${Date.now()}.jpg`);
    } else {
      console.warn('[Cloudinary] Unsupported file format:', typeof file);
      return null;
    }

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    if (response.ok && data.secure_url) {
      return data.secure_url;
    }

    console.error('[Cloudinary] Upload response error:', data);
    return null;
  } catch (error) {
    console.error('[Cloudinary] Upload exception:', error.message);
    return null;
  }
}

/**
 * Upload a base64 string to Cloudinary
 */
async function uploadBase64ToCloudinary(base64String, folder = 'techshare/handover') {
  return uploadToCloudinary(base64String, folder);
}

module.exports = {
  uploadToCloudinary,
  uploadBase64ToCloudinary,
};
