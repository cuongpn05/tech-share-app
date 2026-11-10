import { uploadImageWithCloudinary } from './cloudinaryUploadService';

/**
 * Upload an image URI (from camera or library) to Cloudinary (1-hop direct + server fallback).
 * Returns a globally accessible secure URL (Cloudinary https://res.cloudinary.com/...).
 */
export async function uploadImage(uri: string, filenamePrefix = 'photo'): Promise<string> {
  const result = await uploadImageWithCloudinary({
    uri,
    folder: 'techshare/devices',
    filenamePrefix,
    fallbackEndpoint: '/devices/upload-image',
    fallbackFieldName: 'image',
    directTimeoutMs: 12000,
  });

  return result.url;
}

export const uploadService = {
  uploadImage,
};
