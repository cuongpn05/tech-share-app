const REQUIRED_RETURN_PHOTOS = 4;

const isUploadedPhoto = photo => typeof photo === 'string' &&
  /^(?:https?:\/\/[^\s/]+\/\S+|\/uploads\/[^/\s]+)$/i.test(photo);

function getCompletionError(booking) {
  if (booking.status !== 'active') {
    return 'Only an active booking can be completed.';
  }

  const photos = booking.handover?.afterPhotos ?? [];
  if (new Set(photos.filter(isUploadedPhoto)).size < REQUIRED_RETURN_PHOTOS) {
    return 'Take and upload photos from all 4 return inspection angles before completing the booking.';
  }

  return null;
}

module.exports = { getCompletionError, isUploadedPhoto };
