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
  useWindowDimensions,
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
import { DeviceCard } from '../../components/device/DeviceCard';
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

export function WishlistScreen({
  onBack,
  onNavigateToDeviceDetail,
  onNavigateToHome,
}: WishlistScreenProps) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 20
  );

  const dispatch = useAppDispatch();
  const wishlist = useAppSelector((state) => state.wishlist.items);
  const loading = useAppSelector((state) => state.wishlist.loading);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const columnWidth = (windowWidth - 32 - 12) / 2;

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

  // ─── 1. RENDER LIST ITEM (Horizontal Compact Card) ───
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
          {/* Top row: Brand + Favorite button */}
          <View style={styles.listHeaderRow}>
            <View style={styles.brandBadge}>
              <Text style={styles.brandText}>{item.brand || STRINGS.WISHLIST.DEFAULT_BRAND}</Text>
            </View>

            <TouchableOpacity
              style={styles.heartButton}
              onPress={() => handleRemoveItem(item)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="heart" size={18} color={colors.light.danger} />
            </TouchableOpacity>
          </View>

          {/* Title */}
          <Text style={styles.listTitle} numberOfLines={2}>
            {item.name || item.title}
          </Text>

          {/* Category & Rating */}
          <View style={styles.listMetaRow}>
            <Text style={styles.categoryText}>{item.category}</Text>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={11} color={colors.light.ratingStar} />
              <Text style={styles.ratingText}>
                {item.rating ? item.rating.toFixed(1) : '5.0'}
              </Text>
            </View>
          </View>

          {/* Bottom row: Price & View button */}
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

  // ─── 2. RENDER GRID ITEM (2 Columns using DeviceCard) ───
  const renderGridItem = ({ item }: { item: Device }) => (
    <View style={styles.gridCardWrapper}>
      <DeviceCard
        device={item}
        onPress={onNavigateToDeviceDetail}
        onToggleFavorite={handleRemoveItem}
        isFavorite={true}
        width={columnWidth}
      />
    </View>
  );

  // ─── 3. EMPTY STATE ───
  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="heart-dislike-outline" size={44} color={colors.light.textMuted} />
        </View>
        <Text style={styles.emptyTitle}>{STRINGS.WISHLIST.EMPTY_TITLE}</Text>
        <Text style={styles.emptySubtitle}>
          {STRINGS.WISHLIST.EMPTY_SUBTITLE}
        </Text>
        {onNavigateToHome && (
          <TouchableOpacity
            style={styles.exploreBtn}
            onPress={onNavigateToHome}
            activeOpacity={0.8}
          >
            <Ionicons name="compass-outline" size={18} color={colors.light.white} />
            <Text style={styles.exploreBtnText}>{STRINGS.WISHLIST.EXPLORE_DEVICES}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.light.surface} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={colors.light.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerTitleBox}>
          <Text style={styles.headerTitle}>{STRINGS.WISHLIST.TITLE}</Text>
          {wishlist.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{wishlist.length}</Text>
            </View>
          )}
        </View>

        {/* View Mode Switcher (Grid / List) */}
        {wishlist.length > 0 ? (
          <View style={styles.viewModeSwitch}>
            <TouchableOpacity
              style={[
                styles.modeBtn,
                viewMode === 'grid' && styles.modeBtnActive,
              ]}
              onPress={() => setViewMode('grid')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="grid"
                size={16}
                color={viewMode === 'grid' ? colors.light.primary : colors.light.textMuted}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeBtn,
                viewMode === 'list' && styles.modeBtnActive,
              ]}
              onPress={() => setViewMode('list')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="list"
                size={16}
                color={viewMode === 'list' ? colors.light.primary : colors.light.textMuted}
              />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Subheader status bar if items exist */}
      {wishlist.length > 0 && (
        <View style={styles.subHeader}>
          <View style={styles.subHeaderLeft}>
            <View style={styles.subHeaderIconBox}>
              <Ionicons name="heart" size={13} color={colors.light.danger} />
            </View>
            <Text style={styles.subHeaderText}>
              {STRINGS.WISHLIST.SAVED_COUNT_PREFIX}
              <Text style={styles.subHeaderHighlight}>{wishlist.length}</Text>
              {STRINGS.WISHLIST.SAVED_COUNT_SUFFIX}
            </Text>
          </View>
          <Text style={styles.subHeaderHint}>
            {viewMode === 'grid' ? STRINGS.WISHLIST.GRID_VIEW : STRINGS.WISHLIST.LIST_VIEW}
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.light.primary} />
          <Text style={styles.loadingText}>{STRINGS.WISHLIST.LOADING}</Text>
        </View>
      ) : (
        <FlatList
          key={viewMode}
          data={wishlist}
          keyExtractor={(item: Device) => item._id}
          numColumns={viewMode === 'grid' ? 2 : 1}
          columnWrapperStyle={viewMode === 'grid' ? styles.gridColumnWrapper : undefined}
          renderItem={viewMode === 'grid' ? renderGridItem : renderListItem}
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
              colors={[colors.light.primary]}
              tintColor={colors.light.primary}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  header: {
    backgroundColor: colors.light.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    borderRadius: 12,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.danger,
  },
  viewModeSwitch: {
    flexDirection: 'row',
    backgroundColor: colors.light.border,
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  modeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 7,
  },
  modeBtnActive: {
    backgroundColor: colors.light.surface,
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.borderDefault,
  },
  subHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subHeaderIconBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.light.dangerLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subHeaderText: {
    fontSize: 13,
    color: colors.light.textSecondary,
  },
  subHeaderHighlight: {
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  subHeaderHint: {
    fontSize: 12,
    color: colors.light.textMuted,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    paddingBottom: 36,
  },
  gridColumnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  gridCardWrapper: {
    marginBottom: 0,
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
    shadowColor: colors.light.shadow,
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
    borderColor: colors.light.border,
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
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  statusAvailable: {
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
  },
  statusRented: {
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusDotAvailable: {
    backgroundColor: colors.light.success,
  },
  statusDotRented: {
    backgroundColor: colors.light.error,
  },
  statusText: {
    fontSize: 9,
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
    paddingVertical: 2,
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
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.textPrimary,
    lineHeight: 18,
    marginTop: 2,
    marginBottom: 2,
  },
  listMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryText: {
    fontSize: 11,
    color: colors.light.textSecondary,
    textTransform: 'capitalize',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.light.warningLight,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  ratingText: {
    fontSize: 10,
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
    fontSize: 9,
    color: colors.light.textMuted,
    fontWeight: '500',
  },
  priceValue: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.light.primary,
  },
  priceUnit: {
    fontSize: 10,
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

export default WishlistScreen;
