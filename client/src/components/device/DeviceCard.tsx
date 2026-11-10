import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../store';
import { toggleFavoriteDevice } from '../../store/slices/wishlistSlice';
import { Device } from '../../types';
import { colors } from '../../theme/colors';
import { STRINGS } from '../../constants/strings';
import { API_BASE_URL } from '../../config/api';

interface DeviceCardProps {
  device: Device;
  onPress?: (deviceId: string) => void;
  onToggleFavorite?: (device: Device) => void;
  isFavorite?: boolean;
  width?: number;
}

export const resolveImageUri = (url?: string): string => {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return '';
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  if (url.startsWith('/')) {
    const origin = API_BASE_URL.replace(/\/api\/?$/, '');
    return `${origin}${url}`;
  }
  return url;
};

type DeviceImageData = Pick<Device, 'images'> & {
  image?: unknown;
  imageUrl?: unknown;
};

export function getDeviceImageUrl(device: DeviceImageData): string | undefined {
  const images: unknown = device.images || device.image || device.imageUrl;
  if (Array.isArray(images) && images.length > 0) return images[0];
  if (typeof images === 'string' && images.trim()) return images;
  return undefined;
}

function getSpecIcon(key: string): keyof typeof Ionicons.glyphMap {
  const k = key.toLowerCase();
  if (k.includes('screen') || k.includes('display') || k.includes('size')) return 'phone-portrait-outline';
  if (k.includes('chip') || k.includes('cpu') || k.includes('processor')) return 'hardware-chip-outline';
  if (k.includes('ram') || k.includes('storage') || k.includes('rom') || k.includes('memory') || k.includes('ssd')) return 'save-outline';
  if (k.includes('battery')) return 'battery-charging-outline';
  if (k.includes('camera')) return 'camera-outline';
  return 'apps-outline';
}

export function DeviceCard({
  device,
  onPress,
  width,
  onToggleFavorite,
  isFavorite: propIsFavorite,
}: DeviceCardProps) {
  const dispatch = useAppDispatch();
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const favoriteIds = useAppSelector((state) => state.wishlist?.favoriteIds || []);
  const deviceIdStr = (device._id || (device as any).id)?.toString();
  const isFavorite =
    propIsFavorite !== undefined ? propIsFavorite : (deviceIdStr ? favoriteIds.includes(deviceIdStr) : false);

  const handleHeartPress = () => {
    if (onToggleFavorite) {
      onToggleFavorite(device);
      return;
    }
    if (!isAuthenticated) {
      Alert.alert(
        STRINGS.DEVICE_CARD.LOGIN_REQUIRED_TITLE,
        STRINGS.DEVICE_CARD.LOGIN_REQUIRED_MSG
      );
      return;
    }
    dispatch(toggleFavoriteDevice(device));
  };

  const imageUri = resolveImageUri(getDeviceImageUrl(device));
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [imageUri]);

  const reviewCount = device.stats?.ratingCount ?? device.reviewCount ?? 0;
  const rawRating = device.stats?.ratingAvg ?? device.rating ?? 0;
  const rating = Number.isFinite(rawRating) ? rawRating : 0;
  const available = device.status === 'available';
  const imageCount = Array.isArray(device.images)
    ? device.images.filter((url) => typeof url === 'string' && url.trim()).length
    : 0;

  const ownerName =
    device.ownerId && typeof device.ownerId === 'object' && 'name' in device.ownerId
      ? (device.ownerId as any).name
      : undefined;

  const primarySpec =
    device.specs && typeof device.specs === 'object'
      ? Object.entries(device.specs).find(
          ([, value]) => typeof value === 'string' && value.trim().length > 0
        )
      : undefined;

  const primarySpecDisplay = primarySpec
    ? primarySpec[1].toLowerCase().includes(primarySpec[0].toLowerCase())
      ? primarySpec[1]
      : `${primarySpec[0]}: ${primarySpec[1]}`
    : '';

  const rentalCount = device.stats?.rentalCount ?? (device as any).rentalCount ?? 0;
  const priceAmount = (device.pricePerDay ?? device.dailyRate ?? 0).toLocaleString('en-US');

  return (
    <TouchableOpacity
      style={[styles.card, width ? { width } : styles.defaultWidth]}
      onPress={() => onPress?.(device._id)}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={device.name || device.title}
      accessibilityState={{ disabled: !onPress }}
      activeOpacity={0.88}
    >
      <View style={styles.imageContainer}>
        {imageUri && !imageFailed ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            resizeMode="cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="image-outline" size={30} color={colors.light.textMuted} />
            <Text style={styles.smallText}>Image unavailable</Text>
          </View>
        )}

        {/* TOP LEFT: Brand badge */}
        {device.brand ? (
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeText} numberOfLines={1}>
              {device.brand}
            </Text>
          </View>
        ) : null}

        {/* TOP RIGHT: Heart Button in white circle */}
        <TouchableOpacity
          style={styles.heartButton}
          onPress={handleHeartPress}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          accessibilityState={{ selected: isFavorite }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={17}
            color={isFavorite ? colors.light.danger : '#0F172A'}
          />
        </TouchableOpacity>

        {/* BOTTOM OVERLAYS */}
        <View style={styles.imageFooter}>
          {/* BOTTOM LEFT: Available pill */}
          <View style={[styles.statusBadge, !available && styles.unavailableBadge]}>
            <Ionicons
              name={available ? 'checkmark-circle' : 'time'}
              size={11}
              color={available ? '#059669' : '#D97706'}
            />
            <Text style={[styles.statusText, !available && styles.unavailableText]} numberOfLines={1}>
              {available ? 'Available' : 'Rented'}
            </Text>
          </View>

          {/* BOTTOM RIGHT: Image count pill */}
          {imageCount > 0 ? (
            <View style={styles.imageCount}>
              <Ionicons name="images-outline" size={10} color="#FFFFFF" />
              <Text style={styles.imageCountText}>1 / {imageCount}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.content}>
        {/* DEVICE TITLE: exactly 1 line with ellipsis to prevent asymmetric layout */}
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          {device.name || device.title}
        </Text>

        {/* RATING & OWNER ROW */}
        <View style={styles.ratingOwnerRow}>
          <View style={styles.ratingGroup}>
            <Ionicons name="star" size={11} color="#F59E0B" />
            <Text style={styles.ratingNumber}>
              {rating.toFixed(1)}
            </Text>
            <Text style={styles.reviewCountText}>
              ({reviewCount} reviews)
            </Text>
          </View>

          {ownerName ? (
            <>
              <View style={styles.inlineDivider} />
              <View style={styles.ownerGroup}>
                <Ionicons name="person-circle" size={12} color="#64748B" />
                <Text style={styles.ownerNameText} numberOfLines={1}>
                  {ownerName}
                </Text>
              </View>
            </>
          ) : null}
        </View>

        {/* PRIMARY SPEC BADGE: Exactly 1 full-width spec to avoid truncation */}
        {primarySpec ? (
          <View style={styles.specsRow}>
            <View style={styles.specBadge}>
              <Ionicons name={getSpecIcon(primarySpec[0])} size={11} color="#475569" />
              <Text style={styles.specText} numberOfLines={1} ellipsizeMode="tail">
                {primarySpecDisplay}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.specsRowPlaceholder} />
        )}

        {/* CARD DIVIDER */}
        <View style={styles.cardDivider} />

        {/* FOOTER: RENTAL COUNT ON THE LEFT, PRICE ON THE RIGHT */}
        <View style={styles.footerRow}>
          <View style={styles.rentalCountContainer}>
            <Ionicons name="repeat-outline" size={11} color="#64748B" />
            <Text style={styles.rentalCountText} numberOfLines={1}>
              {rentalCount} {rentalCount === 1 ? 'rented' : 'rented'}
            </Text>
          </View>

          <Text style={styles.priceText} numberOfLines={1}>
            {priceAmount}
            <Text style={styles.priceSuffix}> đ/day</Text>
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    overflow: 'hidden',
  },
  defaultWidth: {
    width: '100%',
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1.15,
    backgroundColor: '#F8FAFC',
    position: 'relative',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  smallText: {
    fontSize: 9,
    color: '#94A3B8',
  },
  brandBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  brandBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0F172A',
  },
  heartButton: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  imageFooter: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 12,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#059669',
  },
  unavailableBadge: {
    backgroundColor: '#FEF3C7',
  },
  unavailableText: {
    color: '#D97706',
  },
  imageCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  imageCountText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  content: {
    padding: 10,
  },
  title: {
    fontSize: 13.5,
    lineHeight: 18,
    height: 18,
    color: '#0F172A',
    fontWeight: '800',
    marginBottom: 5,
  },
  ratingOwnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 16,
    marginBottom: 6,
  },
  ratingGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  ratingNumber: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  reviewCountText: {
    fontSize: 9.5,
    color: '#64748B',
  },
  noReviewsText: {
    fontSize: 9.5,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  inlineDivider: {
    width: 1,
    height: 10,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 4,
  },
  ownerGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ownerNameText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
    flexShrink: 1,
  },
  specsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
    marginBottom: 6,
  },
  specsRowPlaceholder: {
    height: 24,
    marginBottom: 6,
  },
  specBadge: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 7,
    backgroundColor: '#F1F5F9',
    paddingVertical: 3.5,
    paddingHorizontal: 7,
  },
  specText: {
    fontSize: 9.5,
    lineHeight: 13,
    color: '#334155',
    fontWeight: '600',
    flex: 1,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 8,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 24,
    gap: 4,
  },
  rentalCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
    flexShrink: 0,
  },
  rentalCountText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  priceText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F766E',
    textAlign: 'right',
    flexShrink: 1,
  },
  priceSuffix: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748B',
  },
});
