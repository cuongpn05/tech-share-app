import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Image,
  ActivityIndicator,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  fetchWishlist as getWishlistAction,
  toggleFavoriteDevice,
} from '../../store/slices/wishlistSlice';
import { Device } from '../../types';
import { colors } from '../../theme/colors';
import { STRINGS } from '../../constants/strings';
import { API_BASE_URL } from '../../config/api';

export interface WishlistScreenProps {
  onBack: () => void;
  onNavigateToDeviceDetail: (deviceId: string) => void;
  onNavigateToHome?: () => void;
}

const formatPrice = (price: number): string => {
  return price.toLocaleString('en-US') + STRINGS.WISHLIST.CURRENCY_VND;
};

const resolveImageUri = (url?: string): string => {
  const fallback =
    'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500';
  if (!url || typeof url !== 'string' || !url.trim()) return fallback;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) {
    const origin = API_BASE_URL.replace(/\/api\/?$/, '');
    return `${origin}${url}`;
  }
  return url;
};

/**
 * WishlistScreen
 *
 * Màn hình danh sách thiết bị yêu thích chuẩn giao diện List view (thẻ ngang) đồng bộ với hệ thống chung (Owner, Admin, Renter).
 */
export function WishlistScreen({
  onBack,
  onNavigateToDeviceDetail,
  onNavigateToHome,
}: WishlistScreenProps) {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 20
  );

  const dispatch = useAppDispatch();
  const wishlist = useAppSelector((state) => state.wishlist.items);
  const loading = useAppSelector((state) => state.wishlist.loading);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      dispatch(getWishlistAction());
    }, [dispatch])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await dispatch(getWishlistAction());
    setRefreshing(false);
  };

  const handleRemoveItem = (device: Device) => {
    dispatch(toggleFavoriteDevice(device));
  };

  // ─── RENDER LIST ITEM (Horizontal Card) ───
  const renderListItem = ({ item }: { item: Device }) => {
    const rawImages: any = item.images || (item as any).image;
    const rawUrl =
      Array.isArray(rawImages) && rawImages.length > 0
        ? rawImages[0]
        : typeof rawImages === 'string' && rawImages.trim()
        ? rawImages
        : undefined;

    const imageUrl = resolveImageUri(rawUrl);
    const isAvailable = item.status === 'available';
    const ratingValue = Number(item.rating || 5.0).toFixed(1);

    return (
      <TouchableOpacity
        style={styles.listCard}
        onPress={() => onNavigateToDeviceDetail(item._id)}
        activeOpacity={0.88}
      >
        {/* Thumbnail Image */}
        <View style={styles.listImageWrapper}>
          <Image
            source={{ uri: imageUrl }}
            style={styles.listImage}
            resizeMode="cover"
          />
          <View
            style={[
              styles.listStatusBadge,
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
              {isAvailable ? STRINGS.WISHLIST.AVAILABLE : STRINGS.WISHLIST.RENTED}
            </Text>
          </View>
        </View>

        {/* Content Info */}
        <View style={styles.listContentBox}>
          {/* Top row: Brand Badge + Favorite Button */}
          <View style={styles.listHeaderRow}>
            <View style={styles.brandBadge}>
              <Text style={styles.brandText}>
                {item.brand || STRINGS.WISHLIST.DEFAULT_BRAND}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.heartButton}
              onPress={() => handleRemoveItem(item)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="heart" size={17} color={colors.light.danger} />
            </TouchableOpacity>
          </View>

          {/* Title */}
          <Text style={styles.listTitle} numberOfLines={1}>
            {item.name || item.title}
          </Text>

          {/* Meta row: Category + Rating */}
          <View style={styles.listMetaRow}>
            <Text style={styles.categoryText}>
              {typeof item.category === 'object' && item.category !== null
                ? (item.category as any).name || 'Tech'
                : item.category || 'Tech'}
            </Text>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={10} color={colors.light.warning} />
              <Text style={styles.ratingText}>{ratingValue}</Text>
            </View>
          </View>

          {/* Footer: Daily rate + Price + Arrow button */}
          <View style={styles.listFooter}>
            <View>
              <Text style={styles.priceSub}>{STRINGS.WISHLIST.DAILY_RATE}</Text>
              <Text style={styles.priceValue}>
                {formatPrice(item.dailyRate || item.pricePerDay || 0)}
                <Text style={styles.priceUnit}>{STRINGS.WISHLIST.PER_DAY}</Text>
              </Text>
            </View>

            <View style={styles.arrowCircleBtn}>
              <Ionicons name="arrow-forward" size={14} color={colors.light.white} />
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ─── EMPTY STATE ───
  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="heart-dislike-outline" size={40} color={colors.light.danger} />
        </View>
        <Text style={styles.emptyTitle}>{STRINGS.WISHLIST.EMPTY_TITLE}</Text>
        <Text style={styles.emptySubtitle}>{STRINGS.WISHLIST.EMPTY_SUBTITLE}</Text>
        {onNavigateToHome && (
          <TouchableOpacity
            style={styles.exploreBtn}
            onPress={onNavigateToHome}
            activeOpacity={0.85}
          >
            <Ionicons name="sparkles" size={16} color={colors.light.white} />
            <Text style={styles.exploreBtnText}>{STRINGS.WISHLIST.EXPLORE_DEVICES}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: topInset }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.light.surface} />

      {/* 1. Header Bar: Back, Centered Title + Count Badge */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {onBack && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={onBack}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-back" size={22} color={colors.light.textPrimary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{STRINGS.WISHLIST.TITLE}</Text>
          {wishlist.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{wishlist.length}</Text>
            </View>
          )}
        </View>

        <View style={styles.headerRight} />
      </View>

      {/* 2. Sub-Header Summary */}
      {wishlist.length > 0 && (
        <View style={styles.subHeader}>
          <View style={styles.subHeaderLeft}>
            <View style={styles.subHeaderIconCircle}>
              <Ionicons name="heart" size={13} color={colors.light.danger} />
            </View>
            <Text style={styles.subHeaderText}>
              {STRINGS.WISHLIST.SAVED_COUNT_PREFIX}
              <Text style={{ fontWeight: '700', color: colors.light.textPrimary }}>
                {wishlist.length}
              </Text>
              {STRINGS.WISHLIST.SAVED_COUNT_SUFFIX}
            </Text>
          </View>
        </View>
      )}

      {/* 3. Main Content / List */}
      {loading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.light.primary} />
          <Text style={styles.loadingText}>{STRINGS.WISHLIST.LOADING}</Text>
        </View>
      ) : (
        <FlatList
          data={wishlist}
          keyExtractor={(item: Device) => item._id}
          renderItem={renderListItem}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={[
            styles.listContent,
            wishlist.length === 0 && { flex: 1, justifyContent: 'center' },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.light.primary}
              colors={[colors.light.primary]}
            />
          }
        />
      )}
    </View>
  );
}

export default WishlistScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.borderSubtle,
  },
  headerLeft: {
    width: 38,
    alignItems: 'flex-start',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.light.background,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  countBadge: {
    backgroundColor: colors.light.dangerLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 6,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.danger,
  },
  headerRight: {
    width: 38,
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.light.background,
  },
  subHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subHeaderIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.light.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  subHeaderText: {
    fontSize: 13,
    color: colors.light.textSecondary,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    paddingBottom: 36,
  },

  // ─── COMPACT LIST CARD STYLES ───
  listCard: {
    backgroundColor: colors.light.surface,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
    padding: 12,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  listImageWrapper: {
    width: 104,
    height: 104,
    borderRadius: 12,
    backgroundColor: colors.light.background,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.light.borderSubtle,
  },
  listImage: {
    width: '100%',
    height: '100%',
  },
  listStatusBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 2.5,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    gap: 3.5,
  },
  statusAvailable: {},
  statusRented: {},
  statusDot: {
    width: 5.5,
    height: 5.5,
    borderRadius: 3,
  },
  statusDotAvailable: {
    backgroundColor: colors.light.success,
  },
  statusDotRented: {
    backgroundColor: colors.light.error,
  },
  statusText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  statusTextAvailable: {
    color: colors.light.success,
  },
  statusTextRented: {
    color: colors.light.error,
  },
  listContentBox: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandBadge: {
    backgroundColor: colors.light.primaryLight,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  brandText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.light.primary,
    textTransform: 'uppercase',
  },
  heartButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.light.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: colors.light.textPrimary,
    lineHeight: 19,
    marginTop: 2,
    marginBottom: 2,
  },
  listMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryText: {
    fontSize: 11.5,
    color: colors.light.textSecondary,
    textTransform: 'capitalize',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.light.warningLight,
    paddingHorizontal: 5.5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  ratingText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: colors.light.warning,
  },
  listFooter: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.light.borderSubtle,
  },
  priceSub: {
    fontSize: 9.5,
    color: colors.light.textMuted,
    fontWeight: '500',
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.light.primary,
  },
  priceUnit: {
    fontSize: 10.5,
    fontWeight: '500',
    color: colors.light.textSecondary,
  },
  arrowCircleBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── COMMON STATES ───
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: colors.light.textSecondary,
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.light.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.light.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  exploreBtnText: {
    color: colors.light.white,
    fontSize: 14,
    fontWeight: '600',
  },
});
