import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

const formatPrice = (price?: number): string => {
  if (!Number.isFinite(price)) return 'Price unavailable';
  return `${price!.toLocaleString('en-US')}${STRINGS.DEVICE_CARD.PRICE_SUFFIX}`;
};

const resolveImageUri = (url?: string): string => {
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

// Một số dữ liệu cũ có image/imageUrl; giữ fallback này mà không dùng any.
type DeviceImageData = Pick<Device, 'images'> & {
  image?: unknown;
  imageUrl?: unknown;
};

function getDeviceImageUrl(device: DeviceImageData): string | undefined {
  const images: unknown = device.images || device.image || device.imageUrl;
  if (Array.isArray(images) && images.length > 0) return images[0];
  if (typeof images === 'string' && images.trim()) return images;
  return undefined;
}

export function DeviceCard({ device, onPress, width, onToggleFavorite, isFavorite = false }: DeviceCardProps) {
  const imageUrl = getDeviceImageUrl(device);
  const imageUri = resolveImageUri(imageUrl);

  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [imageUri]);
  const address = device.location?.addressText || device.location?.address || device.addressText;
  const rating = device.stats?.ratingAvg ?? device.rating;
  const reviewCount = device.stats?.ratingCount ?? device.reviewCount ?? 0;
  const distance = device.distanceMeters;

  const isAvailable = device.status === 'available';

  return (
    <TouchableOpacity
      style={[styles.card, width ? { width } : styles.defaultWidth]}
      onPress={() => onPress?.(device._id)}
      disabled={!onPress}
      accessibilityState={{ disabled: !onPress }}
      activeOpacity={0.85}
    >
      {/* Device image & status badge */}
      <View style={styles.imageContainer}>
        {imageUri && !imageFailed ? (
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover"
            onError={() => setImageFailed(true)} />
        ) : (
          <View style={[styles.image, { alignItems: 'center', justifyContent: 'center' }]}>
            <Ionicons name="image-outline" size={32} color={colors.light.textSecondary} />
            <Text style={styles.locationText}>Image unavailable</Text>
          </View>
        )}

        {/* Brand badge */}
        <View style={styles.brandBadge}>
          <Text style={styles.brandText}>{device.brand}</Text>
        </View>

        {/* Nút Thả tim */}
        <TouchableOpacity
          style={styles.cardHeartBtn}
          onPress={() => onToggleFavorite?.(device)}
          disabled={!onToggleFavorite}
          accessibilityState={{ disabled: !onToggleFavorite }}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={16}
            color={isFavorite ? colors.light.danger : colors.light.textSecondary}
          />
        </TouchableOpacity>

        {/* Badge trạng thái (Tuân thủ theme-skill.md) */}
        <View
          style={[
            styles.statusBadge,
            isAvailable ? styles.statusAvailable : styles.statusRented,
          ]}
        >
          <View
            style={[
              styles.statusDot,
              isAvailable ? styles.statusDotAvailable : styles.statusDotRented,
            ]}
          />
          <Text
            style={[
              styles.statusText,
              isAvailable ? styles.statusTextAvailable : styles.statusTextRented,
            ]}
          >
            {STRINGS.DEVICE_CARD.STATUS_LABELS[device.status] ?? STRINGS.DEVICE_CARD.UNAVAILABLE}
          </Text>
        </View>
      </View>

      {/* Device info content */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {device.name || device.title}
        </Text>

        <Text style={styles.locationText}>{device.category}</Text>
        {Number.isFinite(distance) && distance! >= 0 && (
          <Text style={styles.locationText}>
            {distance! < 1000 ? Math.round(distance!) + ' m' : (distance! / 1000).toFixed(1) + ' km'}
          </Text>
        )}

        {/* Rating & Lượt đánh giá */}
        <View style={styles.metaRow}>
          <View style={styles.ratingBox}>
            <Ionicons name="star" size={13} color={colors.light.ratingStar} />
            <Text style={styles.ratingText}>
              {Number.isFinite(rating) ? rating.toFixed(1) : '?'}
            </Text>
            <Text style={styles.reviewCount}>({reviewCount})</Text>
          </View>

          {/* Địa điểm */}
          {address ? (
            <View style={styles.locationBox}>
              <Ionicons name="location-outline" size={12} color={colors.light.textSecondary} />
              <Text style={styles.locationText} numberOfLines={1}>
                {address.split(',').slice(-2).join(',').trim()}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Giá thuê & Nút xem */}
        <View style={styles.bottomRow}>
          <View>
            <Text style={styles.priceLabel}>{STRINGS.DEVICE_CARD.DAILY_RATE}</Text>
            <Text style={styles.priceText}>{formatPrice(device.pricePerDay ?? device.dailyRate)}</Text>
          </View>

          <View style={styles.arrowBtn}>
            <Ionicons name="arrow-forward" size={14} color={colors.light.white} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.light.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.light.border,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    marginBottom: 14,
  },
  defaultWidth: {
    width: '100%',
  },
  imageContainer: {
    width: '100%',
    height: 140,
    backgroundColor: colors.light.border,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  brandBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  brandText: {
    color: colors.light.primary,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statusBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  cardHeartBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  statusAvailable: {
    backgroundColor: colors.light.primaryLight,
    borderWidth: 1,
    borderColor: colors.light.primary,
  },
  statusRented: {
    backgroundColor: colors.light.warningLight,
    borderWidth: 1,
    borderColor: colors.light.warning,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotAvailable: {
    backgroundColor: colors.light.primary,
  },
  statusDotRented: {
    backgroundColor: colors.light.warning,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusTextAvailable: {
    color: colors.light.primaryDark,
  },
  statusTextRented: {
    color: colors.light.warning,
  },
  content: {
    padding: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.textPrimary,
    lineHeight: 18,
    minHeight: 36,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 10,
    gap: 8,
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  reviewCount: {
    fontSize: 11,
    color: colors.light.textSecondary,
  },
  locationBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    justifyContent: 'flex-end',
  },
  locationText: {
    fontSize: 11,
    color: colors.light.textSecondary,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.light.border,
  },
  priceLabel: {
    fontSize: 10,
    color: colors.light.textSecondary,
  },
  priceText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.light.primary,
  },
  arrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
