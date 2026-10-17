import { API_BASE_URL, apiClient } from '../config/api';

/**
 * Upload an image URI (from camera or library) to the server / Cloudinary
 * Returns a globally accessible secure URL (Cloudinary https://res.cloudinary.com/...)
 *
 * @param uri Local file URI (file://, content://, ph://) or existing remote URL
 * @param filenamePrefix Optional prefix for the uploaded file name
 * @returns {Promise<string>} The uploaded image URL
 */
export async function uploadImage(uri: string, filenamePrefix = 'photo'): Promise<string> {
  if (!uri || typeof uri !== 'string') {
    throw new Error('URI ảnh không hợp lệ');
  }

  // Nếu đã là link web hoặc Cloudinary, không cần upload lại
  if (uri.startsWith('http://') || uri.startsWith('https://')) {
    return uri;
  }

  const formData = new FormData();
  const rawExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
  const extension = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(rawExt) ? rawExt : 'jpg';
  const mimeType =
    extension === 'png'
      ? 'image/png'
      : extension === 'webp'
      ? 'image/webp'
      : extension === 'gif'
      ? 'image/gif'
      : 'image/jpeg';

  const filename = `${filenamePrefix}-${Date.now()}.${extension}`;

  formData.append('image', {
    uri,
    name: filename,
    type: mimeType,
  } as unknown as Blob);

  const response = await apiClient.post<{ success: boolean; data?: { url: string }; message?: string }>(
    '/devices/upload-image',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );

  const uploadedUrl = response.data?.data?.url;
  if (!uploadedUrl || typeof uploadedUrl !== 'string') {
    throw new Error(response.data?.message || 'Máy chủ không trả về đường dẫn ảnh hợp lệ.');
  }

  if (uploadedUrl.startsWith('/')) {
    return `${API_BASE_URL.replace(/\/api\/?$/, '')}${uploadedUrl}`;
  }

  return uploadedUrl;
}

export const uploadService = {
  uploadImage,
};
