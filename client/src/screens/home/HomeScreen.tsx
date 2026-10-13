import React, { useEffect, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { useHomeLocation, homeDistanceMeters, HOME_LOCATION_MOVEMENT_METERS } from '../../hooks/useHomeLocation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { HeaderActions } from '../../components/navigation/HeaderActions';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  fetchDevices,
  refreshDevices,
  setSelectedCategory,
  clearFilters,
  resetDeviceDiscovery,
} from '../../store/slices/deviceSlice';
import { CategoryBar } from '../../components/home/CategoryBar';
import { PromoBanner } from '../../components/home/PromoBanner';
import { SectionHeader } from '../../components/home/SectionHeader';
import { DeviceCard } from '../../components/device/DeviceCard';
import { GetDevicesParams, HOME_NEARBY_RADIUS_METERS } from '../../services/deviceService';
import { Device, DeviceCategory } from '../../types';
import { colors } from '../../theme/colors';
import { STRINGS } from '../../constants/strings';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COLUMN_WIDTH = (SCREEN_WIDTH - 40) / 2; // 16px screen padding + 8px gap


interface HomeScreenProps {
  onNavigateToDeviceDetail?: (deviceId: string) => void;
  showOwnerDashboard?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSearchSubmit?: () => void;
  onNavigateToWishlist?: () => void;
  onNavigateToSearch?: () => void;
  onNavigateToNotifications?: () => void;
  onNavigateToChat?: () => void;
  onNavigateToAiConsultant?: () => void;
  onNavigateToOwnerDashboard?: () => void;
  /** Số tin nhắn chưa đọc — hiện badge nếu > 0 */
  unreadMessages?: number;
  /** Số thông báo chưa đọc — hiện badge nếu > 0 */
  unreadNotifications?: number;
}

export function HomeScreen({
  onNavigateToDeviceDetail,
  showOwnerDashboard = false,
  searchValue = '',
  onSearchChange,
  onSearchSubmit,
  onNavigateToWishlist,
  onNavigateToNotifications,
  onNavigateToChat,
  onNavigateToAiConsultant,
  onNavigateToOwnerDashboard,
  unreadMessages = 0,
  unreadNotifications,
}: HomeScreenProps) {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 20
  );
  const dispatch = useAppDispatch();
  const {
    filteredDevices,
    selectedCategory,
    searchQuery,
    isLoading,
    isInitialLoading,
    isRefreshing,
    error,
    page,
    failedPage,
    hasNextPage,
    isLoadingMore,
    hasLoaded,
  } = useAppSelector(state => state.devices);

  const localSearch = searchValue;
  const searchEnabled = !!onSearchChange;

  const positionRef = useRef(null as { latitude: number; longitude: number } | null);
  const pagingRef = useRef(false);
  const filtersRef = useRef({ category: selectedCategory, search: localSearch });
  filtersRef.current = { category: selectedCategory, search: localSearch };

  const loadDevices = (params: GetDevicesParams) => {
    if (!positionRef.current) return;
    dispatch(fetchDevices({ ...params, ...positionRef.current, radius: HOME_NEARBY_RADIUS_METERS,
      page: params.page || 1, limit: 10 }));
  };
  const location = useHomeLocation((coordinate, force) => {
    const previous = positionRef.current;
    positionRef.current = coordinate;
    const params = { ...filtersRef.current, ...coordinate, radius: HOME_NEARBY_RADIUS_METERS, page: 1, limit: 10 };
    if (force && previous && homeDistanceMeters(previous, coordinate) < HOME_LOCATION_MOVEMENT_METERS) {
      dispatch(refreshDevices(params));
    } else {
      // Invalidate old location requests before starting the new query.
      dispatch(resetDeviceDiscovery());
      dispatch(fetchDevices(params));
    }
  });
  const { error: locationError, warning: locationWarning, isLocating, isRefreshingLocation } = location;
  const locationLabel = location.position
    ? `${location.position.latitude.toFixed(4)}, ${location.position.longitude.toFixed(4)}`
    : isLocating ? 'Getting your location...' : 'Location unavailable';

  useEffect(() => {
    if (__DEV__) {
      console.log('[HOME FILTER RENDER] ' + JSON.stringify({ category: selectedCategory, q: localSearch.trim(), page, count: filteredDevices.length, ids: filteredDevices.map(device => device._id), location: positionRef.current }));
      console.log('[HOME NEARBY] rendered count:', filteredDevices.length);
      console.log('[HOME NEARBY] radius:', HOME_NEARBY_RADIUS_METERS, 'meters');
      console.log('[HOME NEARBY] page:', page);
      console.log('[HOME NEARBY] limit:', 10);
    }
  }, [filteredDevices, page]);

  const handleSelectCategory = (category: DeviceCategory | 'all') => {

    filtersRef.current = { ...filtersRef.current, category };
    dispatch(setSelectedCategory(category));
    loadDevices(filtersRef.current);
  };

  const handleRefresh = () => {

    void location.refresh(true);
  };

  const handleRetry = () => {

    loadDevices({ category: selectedCategory, search: localSearch });
  };

  // Header của FlatList gồm: Search, CategoryBar, PromoBanner, SectionHeader
  const handleLoadMore = () => {
    if (!positionRef.current || isLocating || locationError || isLoading || isRefreshing ||
        pagingRef.current || error || page < 1 || !hasNextPage || localSearch !== searchQuery) return;
    pagingRef.current = true;
    void dispatch(fetchDevices({ ...positionRef.current, category: selectedCategory,
      search: searchQuery, radius: HOME_NEARBY_RADIUS_METERS, page: page + 1, limit: 10,
    })).finally(() => { pagingRef.current = false; });
  };

  const renderListHeader = useMemo(() => {
    return (
      <View style={styles.headerArea}>
        {/* TOP BAR: Logo & notifications */}
        <View style={[styles.topBar, { paddingTop: topInset + 8 }]}>
          <View style={styles.brandContainer}>
            <View style={styles.logoBadge}>
              <Ionicons name="hardware-chip" size={18} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.brandTitle}>{STRINGS.HOME_SCREEN.BRAND_TITLE}</Text>
              <View style={styles.locationRow}>
                <Text style={styles.locationText}>{locationLabel}</Text>
              </View>
            </View>
          </View>

          {/* Chat + Thông báo + Wishlist — dùng HeaderActions component */}
          <HeaderActions
            unreadMessages={unreadMessages}
            unreadNotifications={unreadNotifications}
            onPressWishlist={onNavigateToWishlist}
            onPressChat={onNavigateToChat}
            onPressNotifications={onNavigateToNotifications}
          />
        </View>

        {/* BANNER CHUYỂN NHANH VỀ BẢNG ĐIỀU KHIỂN CHỦ MÁY */}
        {showOwnerDashboard && (
          <TouchableOpacity
            style={styles.ownerSwitchBanner}
            onPress={onNavigateToOwnerDashboard}
            disabled={!onNavigateToOwnerDashboard}
            activeOpacity={0.85}
          >
            <View style={styles.ownerSwitchLeft}>
              <View style={styles.ownerSwitchIconBox}>
                <Ionicons name="briefcase" size={14} color={colors.light.primary} />
              </View>
              <Text style={styles.ownerSwitchText}>
                {STRINGS.HOME_SCREEN.OWNER_SWITCH_PREFIX}
                <Text style={styles.ownerSwitchTextBold}>{STRINGS.HOME_SCREEN.OWNER_SWITCH_BOLD}</Text>
              </Text>
            </View>
            <View style={styles.ownerSwitchCta}>
              <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        )}

        {/* SEARCH BAR */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={20} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder={STRINGS.HOME_SCREEN.SEARCH_PLACEHOLDER}
              placeholderTextColor={colors.light.textSecondary}
              editable={searchEnabled}
              accessibilityState={{ disabled: !searchEnabled }}
              value={localSearch}
              onChangeText={onSearchChange}
              accessibilityLabel="Search devices"
              onSubmitEditing={onSearchSubmit}
              returnKeyType="search"
            />
            {localSearch.length > 0 ? (
              <TouchableOpacity
                onPress={() => onSearchChange?.('')}
                disabled={!onSearchChange}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                style={{ padding: 6 }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle" size={20} color={colors.light.textMuted} />
              </TouchableOpacity>
            ) : (
              <View style={styles.searchFilterIcon}>
                <Ionicons name="options-outline" size={18} color={colors.light.primary} />
              </View>
            )}
          </View>
        </View>

        {/* 6 DEVICE CATEGORIES */}
        <CategoryBar
          selectedCategory={selectedCategory}
          onSelectCategory={handleSelectCategory}
        />

        {/* PROMO BANNER CAROUSEL */}
        <PromoBanner
          
        />

        {locationWarning && (
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <Text style={{ color: colors.light.textSecondary }}>{locationWarning} Showing your last known area.</Text>
          </View>
        )}
        {/* SECTION HEADER */}
        <SectionHeader
          title={STRINGS.HOME_SCREEN.SECTION_DISCOVER_TITLE}
          subtitle={
            selectedCategory === 'all'
              ? STRINGS.HOME_SCREEN.SECTION_DISCOVER_SUB_ALL
              : STRINGS.HOME_SCREEN.SECTION_DISCOVER_SUB_FILTER(selectedCategory.toUpperCase())
          }
          badgeCount={hasLoaded && !locationError ? filteredDevices.length : undefined}
          actionText={selectedCategory !== 'all' ? STRINGS.HOME_SCREEN.SEE_ALL : undefined}
          onActionPress={
            selectedCategory !== 'all'
              ? () => {

                  filtersRef.current = { ...filtersRef.current, category: 'all' };
                  dispatch(setSelectedCategory('all'));
                  loadDevices(filtersRef.current);
                }
              : undefined
          }
        />
      </View>
    );
  }, [
    searchEnabled,
    onSearchChange,
    onSearchSubmit,
    selectedCategory,
    filteredDevices.length,
    hasLoaded,
    locationError,
    locationWarning,
    locationLabel,
    localSearch,
    dispatch,
    onNavigateToNotifications,
    topInset,
    showOwnerDashboard,
    onNavigateToOwnerDashboard,
    unreadMessages,
    unreadNotifications,
    onNavigateToChat,
  ]);

  // Loading Skeleton State
  const renderLoadingSkeleton = () => (
    <View style={styles.skeletonContainer}>
      <View style={styles.skeletonCard}>
        <View style={styles.skeletonImage} />
        <View style={styles.skeletonLine} />
        <View style={[styles.skeletonLine, { width: '60%' }]} />
      </View>
      <View style={styles.skeletonCard}>
        <View style={styles.skeletonImage} />
        <View style={styles.skeletonLine} />
        <View style={[styles.skeletonLine, { width: '60%' }]} />
      </View>
    </View>
  );

  // Empty State
  const renderEmptyState = () => {
    if (locationError) return renderLocationError();
    if (error) return renderErrorState();
    if (isInitialLoading || isLocating || !hasLoaded) {
      return renderLoadingSkeleton();
    }

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="hardware-chip-outline" size={36} color="#64748B" />
        </View>
        <Text style={styles.emptyTitle}>{STRINGS.HOME_SCREEN.EMPTY_TITLE}</Text>
        <Text style={styles.emptySubtitle}>
          {searchQuery || selectedCategory !== 'all'
            ? STRINGS.HOME_SCREEN.EMPTY_SUBTITLE_FILTER
            : STRINGS.HOME_SCREEN.EMPTY_SUBTITLE_ALL}
        </Text>

        {(searchQuery || selectedCategory !== 'all') && (
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={() => {

              filtersRef.current = { category: 'all', search: '' };
              onSearchChange?.('');
              dispatch(clearFilters());
              loadDevices({ category: 'all', search: '' });
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh-outline" size={16} color="#FFFFFF" />
            <Text style={styles.resetBtnText}>{STRINGS.HOME_SCREEN.SEE_ALL}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Error State
  const renderErrorState = () => (
    <View style={styles.errorContainer}>
      <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
      <Text style={styles.errorTitle}>{STRINGS.HOME_SCREEN.ERROR_TITLE}</Text>
      <Text style={styles.errorSubtitle}>{error}</Text>
      <TouchableOpacity
        style={styles.retryBtn}
        onPress={handleRetry}
        activeOpacity={0.8}
      >
        <Ionicons name="reload-outline" size={16} color="#FFFFFF" />
        <Text style={styles.retryBtnText}>{STRINGS.HOME_SCREEN.TRY_AGAIN}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderLocationError = () => (
    <View style={styles.errorContainer}>
      <Ionicons name="location-outline" size={40} color={colors.light.primary} />
      <Text style={styles.errorTitle}>Unable to determine your location</Text>
      <Text style={styles.errorSubtitle}>{locationError}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={() => void location.refresh()}>
        <Text style={styles.retryBtnText}>Try Again</Text>
      </TouchableOpacity>
      <TouchableOpacity style={{ marginTop: 16 }} onPress={() => void Linking.openSettings()}>
        <Text style={{ color: colors.light.primary }}>Open Settings</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.light.background} />

        <FlatList
          data={filteredDevices}
          keyExtractor={(item: Device) => item._id}
          renderItem={({ item }: { item: Device }) => (
            <View style={styles.cardWrapper}>
              <DeviceCard
                device={item}
                onPress={onNavigateToDeviceDetail}
                width={COLUMN_WIDTH}
              />
            </View>
          )}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderListHeader}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={filteredDevices.length > 0 ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              {isLoadingMore || isRefreshing || isLocating ? <ActivityIndicator color={colors.light.primary} /> : error ? (
                <TouchableOpacity onPress={() => {
                  if (positionRef.current) dispatch(fetchDevices({ ...positionRef.current,
                    category: selectedCategory, search: searchQuery, radius: HOME_NEARBY_RADIUS_METERS, page: failedPage || 1, limit: 10 }));
                }}>
                  <Text style={styles.errorSubtitle}>{error}</Text>
                  <Text style={{ color: colors.light.primary, textAlign: 'center' }}>Retry loading devices</Text>
                </TouchableOpacity>
              ) : hasNextPage ? (
                <TouchableOpacity onPress={handleLoadMore}>
                  <Text style={{ color: colors.light.primary }}>Load more devices</Text>
                </TouchableOpacity>
              ) : <Text style={{ color: colors.light.textSecondary }}>All devices loaded</Text>}
            </View>
          ) : null}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing || isRefreshingLocation}
              onRefresh={handleRefresh}
              tintColor={colors.light.primary}
              colors={[colors.light.primary, colors.light.primaryHover]}
            />
          }
        />

      {(
        <TouchableOpacity
          style={[styles.aiConsultantButton, { bottom: insets.bottom + 16 }]}
          onPress={onNavigateToAiConsultant}
          disabled={!onNavigateToAiConsultant}
          accessibilityState={{ disabled: !onNavigateToAiConsultant }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={STRINGS.HOME_SCREEN.AI_CONSULTANT_ACCESSIBILITY_LABEL}
        >
          <Ionicons name="sparkles" size={23} color={colors.light.white} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  aiConsultantButton: {
    position: 'absolute',
    right: 18,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  listContent: {
    paddingBottom: 24,
  },
  headerArea: {
    paddingBottom: 4,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  ownerSwitchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.light.primaryLight,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ownerSwitchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  ownerSwitchIconBox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.light.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerSwitchText: {
    fontSize: 12,
    color: colors.light.primaryDark,
  },
  ownerSwitchTextBold: {
    fontWeight: '700',
    color: colors.light.primaryDark,
  },
  ownerSwitchCta: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.light.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.light.textPrimary,
    letterSpacing: 0.5,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  locationText: {
    fontSize: 11,
    color: colors.light.textSecondary,
  },
  notificationBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.light.error,
    position: 'absolute',
    top: 8,
    right: 8,
    borderWidth: 1.5,
    borderColor: colors.light.surface,
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginVertical: 6,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.light.border,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: colors.light.textPrimary,
    fontSize: 14,
  },
  searchFilterIcon: {
    padding: 4,
  },
  columnWrapper: {
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  cardWrapper: {
    width: COLUMN_WIDTH,
  },
  skeletonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 12,
  },
  skeletonCard: {
    width: COLUMN_WIDTH,
    height: 220,
    backgroundColor: colors.light.surface,
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  skeletonImage: {
    width: '100%',
    height: 120,
    backgroundColor: colors.light.border,
    borderRadius: 12,
    marginBottom: 12,
  },
  skeletonLine: {
    height: 12,
    backgroundColor: colors.light.border,
    borderRadius: 6,
    marginBottom: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.light.primaryLight,
    borderWidth: 1,
    borderColor: colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.light.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  resetBtnText: {
    color: colors.light.white,
    fontSize: 13,
    fontWeight: '700',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    backgroundColor: colors.light.dangerLight,
    margin: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.light.error,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.light.error,
    marginTop: 8,
    marginBottom: 4,
  },
  errorSubtitle: {
    fontSize: 13,
    color: colors.light.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.light.error,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  retryBtnText: {
    color: colors.light.white,
    fontSize: 13,
    fontWeight: '600',
  },
});
