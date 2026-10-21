import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity, ActivityIndicator, StyleSheet, Modal, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deviceService } from '../../services/deviceService';
import { reviewService, ReviewItem } from '../../services/reviewService';
import { API_BASE_URL } from '../../config/api';
import { Device } from '../../types';
import { colors } from '../../theme/colors';
import { STRINGS } from '../../constants/strings';
import { useAppDispatch, useAppSelector } from '../../store';
import { toggleFavoriteDevice } from '../../store/slices/wishlistSlice';

interface DeviceDetailScreenProps {
  deviceId: string;
  onBack: () => void;
  onRent: (deviceId: string) => void;
  onViewOwner?: (ownerId: string) => void;
}

function specLabel(key: string): string {
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim().split(/\s+/);
  return words.map(word => ['cpu', 'gpu', 'ram', 'ssd', 'usb', 'os'].includes(word.toLowerCase())
    ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function specValue(value: unknown): string {
  if (typeof value === 'string') {
    const text = value.trim();
    return ['null', 'undefined', '[object object]'].includes(text.toLowerCase()) ? '' : text;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return '';
}

function imageUri(value: string): string {
  return value.startsWith('/') ? API_BASE_URL.replace(/\/api\/?$/, '') + value : value;
}

function renderStars(score: number, size = 13) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map(index => {
        let iconName: 'star' | 'star-half' | 'star-outline' = 'star-outline';
        if (index <= score) {
          iconName = 'star';
        } else if (index - 0.5 <= score) {
          iconName = 'star-half';
        }
        return (
          <Ionicons
            key={index}
            name={iconName}
            size={size}
            color={colors.light.ratingStar}
          />
        );
      })}
    </View>
  );
}

export function DeviceDetailScreen({ deviceId, onBack, onRent, onViewOwner }: DeviceDetailScreenProps) {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { isAuthenticated } = useAppSelector(state => state.auth);
  const favoriteIds = useAppSelector(state => state.wishlist?.favoriteIds || []);
  const isFavorite = favoriteIds.includes(deviceId);

  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selectedImage, setSelectedImage] = useState(0);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const [avatarFailed, setAvatarFailed] = useState(false);

  // Reviews state
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [reviewsError, setReviewsError] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<number | 'all'>('all');
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setDevice(null);
    setError(null);
    setNotFound(false);
    setSelectedImage(0);
    setFailedImages([]);
    setAvatarFailed(false);
    setLoading(true);
    setReviews([]);
    setLoadingReviews(true);
    setReviewsError(false);
    setReviewFilter('all');
    setShowAllReviews(false);
    setPreviewImage(null);

    if (!/^[a-fA-F0-9]{24}$/.test(deviceId)) {
      setError('Invalid device ID.');
      setLoading(false);
      setLoadingReviews(false);
      return;
    }

    deviceService.getDeviceById(deviceId, { throwOnError: true })
      .then(data => {
        if (!active) return;
        if (data) setDevice(data);
        else setNotFound(true);
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        const status = (requestError as { response?: { status?: number } })?.response?.status;
        if (status === 404) setNotFound(true);
        else setError(status === 400 ? 'Invalid device ID.' : 'Unable to load this device. Please try again.');
      })
      .finally(() => { if (active) setLoading(false); });

    reviewService.getDeviceReviews(deviceId)
      .then(data => {
        if (!active) return;
        setReviews(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!active) return;
        setReviewsError(true);
      })
      .finally(() => {
        if (active) setLoadingReviews(false);
      });

    return () => { active = false; };
  }, [deviceId, retry]);

  const images = Array.isArray(device?.images)
    ? device.images.filter((value): value is string => typeof value === 'string' && !!value.trim()).map(value => imageUri(value.trim()))
    : [];
  const currentImage = images[selectedImage];
  const specs = device?.specs && typeof device.specs === 'object' && !Array.isArray(device.specs)
    ? Object.entries(device.specs).map(([key, value]) => ({ label: specLabel(key), value: specValue(value) }))
      .filter(row => row.label && row.value) : [];
  const ownerValue = device?.ownerId ?? device?.owner;
  const owner = ownerValue && typeof ownerValue === 'object' ? ownerValue : null;
  const ownerAddress = typeof owner?.address === 'string' ? owner.address : owner?.address?.fullAddress;
  const price = device?.pricePerDay ?? device?.dailyRate;
  const hasPrice = typeof price === 'number' && Number.isFinite(price) && price >= 0;
  const canRent = device?.status === 'available' && hasPrice;
  const address = device?.location?.addressText || device?.location?.address || device?.addressText;

  // Rating & review statistics
  const totalReviewsCount = reviews.length > 0
    ? reviews.length
    : (typeof device?.stats?.ratingCount === 'number' && device.stats.ratingCount > 0
        ? device.stats.ratingCount
        : (typeof device?.reviewCount === 'number' ? device.reviewCount : 0));

  const averageRating = reviews.length > 0
    ? Number((reviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0) / reviews.length).toFixed(1))
    : (typeof device?.stats?.ratingAvg === 'number' && device.stats.ratingAvg > 0
        ? Number(device.stats.ratingAvg.toFixed(1))
        : (typeof device?.rating === 'number' && device.rating > 0 ? Number(device.rating.toFixed(1)) : 5.0));

  const hasRatings = totalReviewsCount > 0 || reviews.length > 0;

  const ratingDistribution = [5, 4, 3, 2, 1].map(star => {
    const count = reviews.filter(r => Math.round(Number(r.rating)) === star).length;
    const percent = reviews.length > 0 ? Math.round((count / reviews.length) * 100) : 0;
    return { star, count, percent };
  });

  const filteredReviews = reviewFilter === 'all'
    ? reviews
    : reviews.filter(r => Math.round(Number(r.rating)) === reviewFilter);

  const displayedReviews = showAllReviews ? filteredReviews : filteredReviews.slice(0, 3);

  const handleToggleFavorite = () => {
    if (!isAuthenticated) {
      Alert.alert(
        STRINGS.DEVICE_DETAIL.LOGIN_REQUIRED_TITLE,
        STRINGS.DEVICE_DETAIL.LOGIN_REQUIRED_MSG
      );
      return;
    }
    if (device) {
      dispatch(toggleFavoriteDevice(device));
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.light.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Device details</Text>
        <TouchableOpacity
          onPress={handleToggleFavorite}
          accessibilityRole="button"
          accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          style={styles.heartBtn}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={20}
            color={isFavorite ? colors.light.danger : colors.light.textPrimary}
          />
        </TouchableOpacity>
      </View>
      {loading ? (
        <View style={styles.state}><ActivityIndicator color={colors.light.primary} /><Text>Loading device...</Text></View>
      ) : error || notFound || !device ? (
        <View style={styles.state}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.light.textSecondary} />
          <Text style={styles.title}>{notFound ? 'Device not found' : error || 'Device not found'}</Text>
          {error && !error.includes('Invalid') && (
            <TouchableOpacity style={styles.button} onPress={() => setRetry(value => value + 1)} accessibilityRole="button">
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.album}>
              {currentImage && !failedImages.includes(currentImage) ? (
                <Image source={{ uri: currentImage }} style={styles.image} resizeMode="contain"
                  accessibilityLabel={`Device photo ${selectedImage + 1}`}
                  onError={() => setFailedImages(previous => [...previous, currentImage])} />
              ) : (
                <View style={styles.placeholder}>
                  <Ionicons name="image-outline" size={48} color={colors.light.textSecondary} />
                  <Text style={styles.muted}>Image unavailable</Text>
                </View>
              )}
              {device.brand ? <View style={styles.brandBadge}>
                <Text style={styles.brandText} numberOfLines={1}>{device.brand}</Text>
              </View> : null}
            {images.length > 1 && (
              <View style={styles.photos}>
                {images.map((_, index) => (
                  <TouchableOpacity key={index} onPress={() => setSelectedImage(index)} accessibilityRole="button"
                    accessibilityLabel={`View photo ${index + 1}`} accessibilityState={{ selected: index === selectedImage }}
                    style={styles.photoButton} hitSlop={8}>
                    <View style={[styles.photoDot, index === selectedImage && styles.photoSelected]} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
            </View>
            <View style={styles.section}>
              <Text style={styles.title}>{device.name || device.title || 'Name unavailable'}</Text>
              <View style={styles.summaryRow}>
                <View style={styles.badges}>
                  {device.category ? <View style={styles.badge}>
                    <Ionicons name={device.category === 'camera' ? 'camera-outline' : 'hardware-chip-outline'}
                      size={13} color={colors.light.primaryDark} />
                    <Text style={styles.badgeText}>{device.category}</Text>
                  </View> : null}
                  <View style={[styles.badge, device.status === 'available' && styles.availableBadge]}>
                    <Ionicons name={device.status === 'available' ? 'checkmark-circle' : 'time-outline'}
                      size={13} color={device.status === 'available' ? colors.light.success : colors.light.textSecondary} />
                    <Text style={styles.badgeText}>{device.status || 'Status unavailable'}</Text>
                  </View>
                  <View style={[styles.badge, styles.ratingBadge]}>
                    <Ionicons name="star" size={13} color={colors.light.ratingStar} />
                    <Text style={styles.ratingBadgeText}>
                      {hasRatings ? averageRating.toFixed(1) : 'New'}
                    </Text>
                    {totalReviewsCount > 0 ? (
                      <Text style={styles.ratingCountText}>({totalReviewsCount})</Text>
                    ) : null}
                  </View>
                </View>
                <Text style={styles.price}>{hasPrice ? `${price.toLocaleString('en-US')} VND / day` : 'Price unavailable'}</Text>
              </View>
              {typeof address === 'string' && address.trim() ? <View style={styles.addressRow}>
                <Ionicons name="location" size={14} color={colors.light.textMuted} />
                <Text style={styles.addressText}>{address}</Text>
              </View> : null}
            </View>
            <View style={styles.section}>
              <View style={styles.sectionHeading}>
                <View style={styles.sectionIcon}><Ionicons name="document-text-outline" size={17} color={colors.light.primaryDark} /></View>
                <Text style={styles.sectionTitle}>Description</Text>
              </View>
              <Text style={styles.body}>{typeof device.description === 'string' && device.description.trim()
                ? device.description : 'No description available.'}</Text>
            </View>
            <View style={styles.section}>
              <View style={styles.sectionHeading}>
                <View style={styles.sectionIcon}><Ionicons name="settings-outline" size={17} color={colors.light.primaryDark} /></View>
                <Text style={styles.sectionTitle}>Technical Specifications</Text>
              </View>
              {specs.length ? specs.map((row, index) => (
                <View key={index} style={styles.specRow}>
                  <Text style={styles.specLabel}>{row.label}</Text>
                  <Text style={styles.specValue}>{row.value}</Text>
                </View>
              )) : <Text style={styles.muted}>No specifications available.</Text>}
            </View>
            <View style={styles.section}>
              <View style={styles.sectionHeading}>
                <View style={styles.sectionIcon}><Ionicons name="person-outline" size={17} color={colors.light.primaryDark} /></View>
                <Text style={styles.sectionTitle}>Owner</Text>
              </View>
              {owner && typeof owner.name === 'string' && owner.name.trim() ? (
                <TouchableOpacity style={styles.ownerRow} accessibilityRole="button" accessibilityLabel="View owner profile"
                  disabled={!owner._id || !onViewOwner} onPress={() => onViewOwner?.(owner._id)}>
                  {typeof owner.avatar === 'string' && owner.avatar.trim() && !avatarFailed ? (
                    <Image source={{ uri: imageUri(owner.avatar) }} style={styles.avatar} onError={() => setAvatarFailed(true)} />
                  ) : <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Ionicons name="person" size={22} color={colors.light.primaryDark} />
                  </View>}
                  <View style={styles.ownerInfo}>
                    <Text style={styles.ownerName}>{owner.name}</Text>
                    {typeof ownerAddress === 'string' && ownerAddress.trim() ? <View style={styles.addressRow}>
                      <Ionicons name="location" size={12} color={colors.light.textMuted} />
                      <Text style={styles.addressText}>{ownerAddress}</Text>
                    </View> : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.light.textMuted} />
                </TouchableOpacity>
              ) : <Text style={styles.muted}>Owner information unavailable.</Text>}
            </View>

            {/* ── CUSTOMER REVIEWS & RATINGS SECTION ── */}
            <View style={styles.section}>
              <View style={styles.sectionHeadingBetween}>
                <View style={styles.sectionHeading}>
                  <View style={[styles.sectionIcon, styles.reviewSectionIcon]}>
                    <Ionicons name="star" size={17} color={colors.light.ratingStar} />
                  </View>
                  <Text style={styles.sectionTitle}>Reviews & Ratings</Text>
                </View>
                {totalReviewsCount > 0 ? (
                  <View style={styles.reviewCountPill}>
                    <Text style={styles.reviewCountPillText}>
                      {totalReviewsCount} {totalReviewsCount === 1 ? 'review' : 'reviews'}
                    </Text>
                  </View>
                ) : null}
              </View>

              {loadingReviews ? (
                <View style={styles.reviewsLoadingWrap}>
                  <ActivityIndicator size="small" color={colors.light.primary} />
                  <Text style={styles.muted}>Loading reviews...</Text>
                </View>
              ) : reviewsError ? (
                <View style={styles.reviewsEmptyWrap}>
                  <Ionicons name="alert-circle-outline" size={32} color={colors.light.textMuted} />
                  <Text style={styles.muted}>Unable to load reviews for this device.</Text>
                </View>
              ) : reviews.length === 0 ? (
                <View style={styles.reviewsEmptyWrap}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons name="chatbox-ellipses-outline" size={28} color={colors.light.primaryHover} />
                  </View>
                  <Text style={styles.emptyReviewsTitle}>No reviews yet</Text>
                  <Text style={styles.emptyReviewsSubtitle}>
                    Be the first to rent and share your experience with this device!
                  </Text>
                </View>
              ) : (
                <>
                  {/* Rating Overview Summary Card */}
                  <View style={styles.ratingOverviewCard}>
                    <View style={styles.ratingScoreCol}>
                      <Text style={styles.ratingBigScore}>{averageRating.toFixed(1)}</Text>
                      {renderStars(averageRating, 14)}
                      <Text style={styles.ratingTotalText}>
                        {totalReviewsCount} {totalReviewsCount === 1 ? 'review' : 'reviews'}
                      </Text>
                    </View>

                    <View style={styles.ratingDivider} />

                    <View style={styles.ratingBarsCol}>
                      {ratingDistribution.map(({ star, count, percent }) => (
                        <TouchableOpacity
                          key={star}
                          style={styles.ratingBarRow}
                          onPress={() => setReviewFilter(prev => prev === star ? 'all' : star)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.ratingBarStarLabel, reviewFilter === star && styles.ratingBarLabelActive]}>
                            {star}★
                          </Text>
                          <View style={styles.ratingBarTrack}>
                            <View style={[styles.ratingBarFill, { width: `${percent}%` }]} />
                          </View>
                          <Text style={styles.ratingBarCountLabel}>{count}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Star Filter Chips */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                    <TouchableOpacity
                      style={[styles.filterChip, reviewFilter === 'all' && styles.filterChipActive]}
                      onPress={() => setReviewFilter('all')}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.filterChipText, reviewFilter === 'all' && styles.filterChipTextActive]}>
                        All ({reviews.length})
                      </Text>
                    </TouchableOpacity>
                    {[5, 4, 3, 2, 1].map(star => {
                      const starMatches = reviews.filter(r => Math.round(Number(r.rating)) === star).length;
                      if (starMatches === 0 && reviewFilter !== star) return null;
                      return (
                        <TouchableOpacity
                          key={star}
                          style={[styles.filterChip, reviewFilter === star && styles.filterChipActive]}
                          onPress={() => setReviewFilter(prev => prev === star ? 'all' : star)}
                          accessibilityRole="button"
                        >
                          <Ionicons
                            name="star"
                            size={11}
                            color={reviewFilter === star ? colors.light.white : colors.light.ratingStar}
                          />
                          <Text style={[styles.filterChipText, reviewFilter === star && styles.filterChipTextActive]}>
                            {star} ({starMatches})
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {/* Filter Empty Notice */}
                  {displayedReviews.length === 0 ? (
                    <View style={styles.reviewsFilterEmpty}>
                      <Text style={styles.muted}>No reviews matching {reviewFilter}★.</Text>
                      <TouchableOpacity onPress={() => setReviewFilter('all')}>
                        <Text style={styles.filterResetText}>View all reviews</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  {/* Reviews List */}
                  {displayedReviews.map((review, index) => {
                    const reviewer = review.reviewerId || review.renterId;
                    const reviewerName = (reviewer && typeof reviewer === 'object' && reviewer.name)
                      ? reviewer.name
                      : 'Renter';
                    const reviewerAvatar = (reviewer && typeof reviewer === 'object' && typeof reviewer.avatar === 'string' && reviewer.avatar.trim())
                      ? imageUri(reviewer.avatar.trim())
                      : null;
                    const isVerified = reviewer && typeof reviewer === 'object' && (reviewer.isVerified || reviewer.trust?.isVerified);
                    const formattedDate = review.createdAt
                      ? new Date(review.createdAt).toLocaleDateString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })
                      : '';

                    return (
                      <View key={review._id || index} style={[styles.reviewCard, index > 0 && styles.reviewBorderTop]}>
                        <View style={styles.reviewerHeader}>
                          {reviewerAvatar ? (
                            <Image source={{ uri: reviewerAvatar }} style={styles.reviewerAvatar} />
                          ) : (
                            <View style={[styles.reviewerAvatar, styles.reviewerAvatarPlaceholder]}>
                              <Ionicons name="person" size={16} color={colors.light.primaryDark} />
                            </View>
                          )}
                          <View style={styles.reviewerMeta}>
                            <View style={styles.reviewerNameRow}>
                              <Text style={styles.reviewerName} numberOfLines={1}>{reviewerName}</Text>
                              {isVerified ? (
                                <Ionicons name="shield-checkmark" size={13} color={colors.light.primaryHover} />
                              ) : null}
                            </View>
                            {formattedDate ? (
                              <Text style={styles.reviewDate}>{formattedDate}</Text>
                            ) : null}
                          </View>
                          <View style={styles.reviewRatingPill}>
                            <Ionicons name="star" size={12} color={colors.light.ratingStar} />
                            <Text style={styles.reviewRatingScore}>{review.rating}</Text>
                          </View>
                        </View>

                        <Text style={styles.reviewComment}>{review.comment}</Text>

                        {Array.isArray(review.images) && review.images.length > 0 ? (
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reviewImagesRow}>
                            {review.images.map((imgUrl, imgIdx) => (
                              <TouchableOpacity
                                key={imgIdx}
                                onPress={() => setPreviewImage(imageUri(imgUrl))}
                                activeOpacity={0.85}
                                style={styles.reviewImageWrap}
                              >
                                <Image source={{ uri: imageUri(imgUrl) }} style={styles.reviewImageThumb} />
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        ) : null}
                      </View>
                    );
                  })}

                  {/* Show all / Show less toggle button */}
                  {filteredReviews.length > 3 && (
                    <TouchableOpacity
                      style={styles.showMoreButton}
                      onPress={() => setShowAllReviews(prev => !prev)}
                      accessibilityRole="button"
                    >
                      <Text style={styles.showMoreText}>
                        {showAllReviews
                          ? 'Show less'
                          : `Show all ${filteredReviews.length} reviews`}
                      </Text>
                      <Ionicons
                        name={showAllReviews ? 'chevron-up' : 'chevron-down'}
                        size={15}
                        color={colors.light.primaryDark}
                      />
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </ScrollView>
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity style={[styles.button, !canRent && styles.disabled]} disabled={!canRent}
              accessibilityRole="button" accessibilityLabel="Rent device" accessibilityState={{ disabled: !canRent }}
              onPress={() => onRent(device._id)}>
              <Ionicons name="calendar-outline" size={18} color={colors.light.white} />
              <Text style={styles.buttonText}>{canRent ? 'Rent device' : 'Currently unavailable'}</Text>
            </TouchableOpacity>
          </View>

          {/* Review Image Preview Modal */}
          <Modal
            visible={Boolean(previewImage)}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setPreviewImage(null)}
          >
            <View style={styles.previewBackdrop}>
              <TouchableOpacity
                style={styles.previewCloseBtn}
                onPress={() => setPreviewImage(null)}
                accessibilityRole="button"
                accessibilityLabel="Close image preview"
              >
                <Ionicons name="close" size={26} color={colors.light.white} />
              </TouchableOpacity>
              {previewImage ? (
                <Image
                  source={{ uri: previewImage }}
                  style={styles.previewFullImage}
                  resizeMode="contain"
                />
              ) : null}
            </View>
          </Modal>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.light.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  back: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.light.surface, alignItems: 'center', justifyContent: 'center' },
  heartBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.light.surface, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { width: 32 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.light.textPrimary },
  content: { paddingHorizontal: 10, paddingBottom: 12, gap: 8 },
  state: { flex: 1, padding: 24, gap: 16, alignItems: 'center', justifyContent: 'center' },
  album: { borderRadius: 16, backgroundColor: colors.light.border, overflow: 'hidden' },
  image: { width: '100%', aspectRatio: 1.85 },
  placeholder: { width: '100%', aspectRatio: 1.85, alignItems: 'center', justifyContent: 'center', gap: 8 },
  brandBadge: { position: 'absolute', top: 12, left: 12, maxWidth: '70%', paddingHorizontal: 12,
    paddingVertical: 5, backgroundColor: colors.light.surface, borderRadius: 14 },
  brandText: { fontSize: 11, fontWeight: '700', color: colors.light.textPrimary },
  photos: { position: 'absolute', bottom: 8, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' },
  photoButton: { padding: 4 },
  photoDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.light.textMuted },
  photoSelected: { backgroundColor: colors.light.primaryHover },
  section: { padding: 12, gap: 8, borderRadius: 16, backgroundColor: colors.light.surface },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '800', color: colors.light.textPrimary },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionHeadingBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  sectionIcon: { width: 29, height: 29, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.light.primaryLight },
  reviewSectionIcon: { backgroundColor: colors.light.warningLight || '#FEF3C7' },
  sectionTitle: { flexShrink: 1, fontSize: 14, fontWeight: '700', color: colors.light.textPrimary },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.light.primaryLight,
    paddingHorizontal: 7, paddingVertical: 5, borderRadius: 8 },
  availableBadge: { backgroundColor: colors.light.successLight },
  ratingBadge: { backgroundColor: colors.light.warningLight || '#FEF3C7' },
  badgeText: { fontSize: 10, textTransform: 'capitalize', color: colors.light.primaryDark },
  ratingBadgeText: { fontSize: 10, fontWeight: '800', color: colors.light.warning || '#D97706' },
  ratingCountText: { fontSize: 9, fontWeight: '600', color: colors.light.textSecondary },
  price: { flexShrink: 1, fontSize: 16, fontWeight: '800', color: colors.light.primaryHover },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  addressText: { flex: 1, minWidth: 0, fontSize: 11, lineHeight: 16, color: colors.light.textSecondary },
  body: { fontSize: 12, lineHeight: 18, color: colors.light.textSecondary },
  muted: { fontSize: 12, lineHeight: 18, color: colors.light.textSecondary },
  specRow: { flexDirection: 'row', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.light.border },
  specLabel: { flex: 1, fontSize: 11, lineHeight: 17, color: colors.light.textSecondary },
  specValue: { flex: 1.2, fontSize: 11, lineHeight: 17, color: colors.light.textPrimary },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.light.primaryLight },
  ownerInfo: { flex: 1, minWidth: 0, gap: 4 },
  ownerName: { fontSize: 12, lineHeight: 17, fontWeight: '700', color: colors.light.textPrimary },

  // Reviews & ratings styles
  reviewCountPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, backgroundColor: colors.light.background },
  reviewCountPillText: { fontSize: 11, fontWeight: '700', color: colors.light.textSecondary },
  reviewsLoadingWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 20, gap: 8 },
  reviewsEmptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 20, gap: 6 },
  emptyIconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.light.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  emptyReviewsTitle: { fontSize: 13, fontWeight: '700', color: colors.light.textPrimary },
  emptyReviewsSubtitle: { fontSize: 11, color: colors.light.textSecondary, textAlign: 'center', maxWidth: 260, lineHeight: 16 },

  ratingOverviewCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.light.background, borderRadius: 14, padding: 12, gap: 12, marginTop: 2 },
  ratingScoreCol: { alignItems: 'center', justifyContent: 'center', minWidth: 76, gap: 3 },
  ratingBigScore: { fontSize: 30, fontWeight: '900', color: colors.light.textPrimary, lineHeight: 34 },
  starsRow: { flexDirection: 'row', gap: 2, alignItems: 'center' },
  ratingTotalText: { fontSize: 10, fontWeight: '600', color: colors.light.textSecondary },
  ratingDivider: { width: 1, height: '75%', backgroundColor: colors.light.borderDefault },
  ratingBarsCol: { flex: 1, gap: 3 },
  ratingBarRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 1 },
  ratingBarStarLabel: { width: 20, fontSize: 10, fontWeight: '600', color: colors.light.textSecondary, textAlign: 'right' },
  ratingBarLabelActive: { color: colors.light.primaryDark, fontWeight: '800' },
  ratingBarTrack: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.light.borderDefault, overflow: 'hidden' },
  ratingBarFill: { height: '100%', borderRadius: 3, backgroundColor: colors.light.ratingStar },
  ratingBarCountLabel: { width: 16, fontSize: 10, color: colors.light.textMuted, textAlign: 'right' },

  filterScroll: { flexDirection: 'row', gap: 6, paddingVertical: 2 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: colors.light.background, borderWidth: 1, borderColor: colors.light.borderDefault },
  filterChipActive: { backgroundColor: colors.light.primaryDark, borderColor: colors.light.primaryDark },
  filterChipText: { fontSize: 11, fontWeight: '600', color: colors.light.textSecondary },
  filterChipTextActive: { color: colors.light.white, fontWeight: '700' },
  reviewsFilterEmpty: { paddingVertical: 14, alignItems: 'center', gap: 4 },
  filterResetText: { fontSize: 11, fontWeight: '700', color: colors.light.primaryHover },

  reviewCard: { paddingVertical: 10, gap: 6 },
  reviewBorderTop: { borderTopWidth: 1, borderTopColor: colors.light.border },
  reviewerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reviewerAvatar: { width: 32, height: 32, borderRadius: 16 },
  reviewerAvatarPlaceholder: { backgroundColor: colors.light.primaryLight, alignItems: 'center', justifyContent: 'center' },
  reviewerMeta: { flex: 1, minWidth: 0, gap: 1 },
  reviewerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reviewerName: { fontSize: 12, fontWeight: '700', color: colors.light.textPrimary },
  reviewDate: { fontSize: 10, color: colors.light.textMuted },
  reviewRatingPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: colors.light.warningLight || '#FEF3C7' },
  reviewRatingScore: { fontSize: 11, fontWeight: '700', color: colors.light.warning || '#D97706' },
  reviewComment: { fontSize: 12, lineHeight: 17, color: colors.light.textPrimary },
  reviewImagesRow: { flexDirection: 'row', gap: 6, paddingTop: 2 },
  reviewImageWrap: { borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: colors.light.borderDefault },
  reviewImageThumb: { width: 56, height: 56 },

  showMoreButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, marginTop: 2, borderRadius: 10, backgroundColor: colors.light.primaryLight },
  showMoreText: { fontSize: 12, fontWeight: '700', color: colors.light.primaryDark },

  previewBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  previewCloseBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  previewFullImage: { width: '100%', height: '80%' },

  footer: { paddingHorizontal: 12, paddingTop: 8, backgroundColor: colors.light.surface, borderTopWidth: 1, borderColor: colors.light.border },
  button: { flexDirection: 'row', justifyContent: 'center', gap: 8, backgroundColor: colors.light.primaryHover,
    borderRadius: 12, padding: 14, alignItems: 'center' },
  buttonText: { color: colors.light.white, fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
