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
  const address = device.location?.addressText || device.location?.address || device.addressText;
  const rating = device.stats?.ratingAvg ?? device.rating;
  const reviewCount = device.stats?.ratingCount ?? device.reviewCount;
  const distance = device.distanceMeters;
  const available = device.status === 'available';
  const imageCount = Array.isArray(device.images) ? device.images.filter(url => typeof url === 'string' && url.trim()).length : 0;
  const specs = device.specs && typeof device.specs === 'object'
    ? Object.entries(device.specs).filter(([, value]) => typeof value === 'string' && value.trim()).slice(0, 3) : [];

  return (
    <TouchableOpacity style={[styles.card, width ? { width } : styles.defaultWidth]}
      onPress={() => onPress?.(device._id)} disabled={!onPress} accessibilityRole="button"
      accessibilityLabel={device.name || device.title} accessibilityState={{ disabled: !onPress }} activeOpacity={0.88}>
      <View style={styles.imageContainer}>
        {imageUri && !imageFailed ? <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain"
          onError={() => setImageFailed(true)} /> : <View style={styles.placeholder}>
          <Ionicons name="image-outline" size={30} color={colors.light.textMuted} />
          <Text style={styles.smallText}>Image unavailable</Text>
        </View>}
        {device.brand ? <View style={styles.brandBadge}><Text style={styles.brandText} numberOfLines={1}>{device.brand}</Text></View> : null}
        <TouchableOpacity
          style={styles.heartButton}
          onPress={handleHeartPress}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          accessibilityState={{ selected: isFavorite }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={isFavorite ? 'heart' : 'heart-outline'}
            size={18}
            color={isFavorite ? colors.light.danger : colors.light.textSecondary}
          />
        </TouchableOpacity>
        <View style={styles.imageFooter}>
          <View style={[styles.statusBadge, !available && styles.unavailableBadge]}>
            <View style={[styles.statusDot, !available && styles.unavailableDot]} />
            <Text style={[styles.statusText, !available && styles.unavailableText]} numberOfLines={1}>
              {available ? 'Available' : STRINGS.DEVICE_CARD.UNAVAILABLE}
            </Text>
          </View>
          {imageCount > 0 ? <View style={styles.imageCount}>
            <Ionicons name="images-outline" size={12} color={colors.light.white} />
            <Text style={styles.imageCountText}>{imageCount}</Text>
          </View> : null}
        </View>
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>{device.name || device.title}</Text>
        <Text style={styles.category} numberOfLines={1}>{device.category}</Text>
        <View style={styles.metaBlock}>
          <View style={styles.metaRow}>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={12} color={colors.light.ratingStar} />
              <Text style={styles.ratingText}>{Number.isFinite(rating) ? rating.toFixed(1) : '—'}</Text>
              {Number.isFinite(reviewCount) ? <Text style={styles.smallText} numberOfLines={1}>({reviewCount})</Text> : null}
            </View>
            {typeof address === 'string' && address.trim() ? <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={12} color={colors.light.textSecondary} />
              <Text style={styles.locationText} numberOfLines={1}>{address.split(',').slice(-2).join(',').trim()}</Text>
            </View> : null}
          </View>
          {Number.isFinite(distance) && distance! >= 0 ? <Text style={styles.smallText} numberOfLines={1}>
            {distance! < 1000 ? Math.round(distance!) + ' m' : (distance! / 1000).toFixed(1) + ' km'}
          </Text> : null}
        </View>
        <View style={styles.specs}>
          {specs.map(([key, value]) => <View key={key} style={styles.specBadge}>
            <Text style={styles.specText} numberOfLines={1} accessibilityLabel={key + ': ' + value}>{value}</Text>
          </View>)}
        </View>
        <View style={styles.priceSection}>
          <View style={styles.priceInfo}>
            <Text style={styles.priceLabel}>{STRINGS.DEVICE_CARD.DAILY_RATE}</Text>
            <Text style={styles.priceText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {formatPrice(device.pricePerDay ?? device.dailyRate)}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.arrowButton}
            disabled={!onPress}
            accessibilityRole="button"
            accessibilityLabel="View device details"
            accessibilityState={{ disabled: !onPress }}
            onPress={() => onPress?.(device._id)}
            hitSlop={4}
          >
            <Ionicons name="arrow-forward" size={18} color={colors.light.white} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, backgroundColor: colors.light.surface, borderWidth: 1, borderColor: colors.light.border,
    marginBottom: 14, elevation: 3, shadowColor: colors.light.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8 },
  defaultWidth: { width: '100%' },
  imageContainer: { width: '100%', aspectRatio: 1.2, backgroundColor: colors.light.border,
    borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  brandBadge: { position: 'absolute', top: 9, left: 9, maxWidth: '55%', backgroundColor: colors.light.primaryLight,
    borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  brandText: { fontSize: 9, fontWeight: '800', color: colors.light.primaryDark, textTransform: 'uppercase' },
  heartButton: { position: 'absolute', top: 7, right: 7, width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.light.surface, elevation: 2,
    shadowColor: colors.light.shadow, shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  imageFooter: { position: 'absolute', left: 7, right: 7, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, gap: 4, borderWidth: 1,
    borderColor: colors.light.success, borderRadius: 12, backgroundColor: colors.light.successLight, paddingHorizontal: 6, paddingVertical: 4 },
  statusDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.light.success },
  statusText: { flexShrink: 1, fontSize: 9, fontWeight: '700', color: colors.light.success },
  unavailableBadge: { borderColor: colors.light.warning, backgroundColor: colors.light.warningLight },
  unavailableDot: { backgroundColor: colors.light.warning },
  unavailableText: { color: colors.light.textSecondary },
  imageCount: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(15,23,42,0.65)',
    borderRadius: 7, paddingHorizontal: 5, paddingVertical: 4 },
  imageCountText: { color: colors.light.white, fontSize: 10, fontWeight: '700' },
  content: { height: 184, padding: 10, gap: 4 },
  title: { height: 36, fontSize: 13, lineHeight: 18, color: colors.light.textPrimary, fontWeight: '800' },
  category: { fontSize: 11, lineHeight: 14, color: colors.light.textSecondary, textTransform: 'capitalize' },
  metaBlock: { height: 30, gap: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: '55%' },
  ratingText: { fontSize: 11, fontWeight: '700', color: colors.light.textPrimary },
  smallText: { fontSize: 9, lineHeight: 12, color: colors.light.textSecondary, flexShrink: 1 },
  locationRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingLeft: 5, borderLeftWidth: 1, borderLeftColor: colors.light.borderDefault },
  locationText: { flex: 1, minWidth: 0, fontSize: 9, lineHeight: 12, color: colors.light.textSecondary },
  specs: { height: 21, flexDirection: 'row', gap: 4 },
  specBadge: { flex: 1, minWidth: 0, alignSelf: 'flex-start', borderRadius: 6, backgroundColor: colors.light.background,
    paddingHorizontal: 4, paddingVertical: 4 },
  specText: { fontSize: 8, lineHeight: 11, color: colors.light.textSecondary },
  priceSection: { marginTop: 'auto', paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.light.border,
    flexDirection: 'row', alignItems: 'center', gap: 5 },
  priceInfo: { flex: 1, minWidth: 0, gap: 3 },
  priceLabel: { fontSize: 10, color: colors.light.textSecondary },
  priceText: { fontSize: 13, fontWeight: '800', color: colors.light.primaryDark },
  arrowButton: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.light.primary,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});
