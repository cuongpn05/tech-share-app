import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  RefreshControl,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  Linking,
  Platform,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// Hooks & Navigation
import { useHomeLocation, homeDistanceMeters, HOME_LOCATION_MOVEMENT_METERS, HomeCoordinate } from '../../hooks/useHomeLocation';
import { useAppDispatch, useAppSelector } from '../../store';

// Redux Actions
import {
  fetchDevices,
  refreshDevices,
  setSelectedCategory,
  clearFilters,
  resetDeviceDiscovery,
} from '../../store/slices/deviceSlice';
import { fetchWishlist, toggleFavoriteDevice } from '../../store/slices/wishlistSlice';

// Components (Được module hóa rõ ràng, dễ bảo trì)
import { HomeHeader } from '../../components/home/HomeHeader';
import { HomeSearchBar } from '../../components/home/HomeSearchBar';
import { OwnerSwitchBanner } from '../../components/home/OwnerSwitchBanner';
import { CategoryBar } from '../../components/home/CategoryBar';
import { PromoBanner } from '../../components/home/PromoBanner';
import { FeaturedRecommendations } from '../../components/home/FeaturedRecommendations';
import { SectionHeader } from '../../components/home/SectionHeader';
import { DeviceCard } from '../../components/device/DeviceCard';

// Services, Types & Constants
import { deviceService, GetDevicesParams, HOME_NEARBY_RADIUS_METERS } from '../../services/deviceService';
import { Device, DeviceCategory } from '../../types';
import { colors } from '../../theme/colors';
import { STRINGS } from '../../constants/strings';

/**
 * ============================================================================
 * HomeScreen.tsx – Màn hình Khám phá Thiết bị Công nghệ (Device Discovery)
 *
 * TRÁCH NHIỆM (RESPONSIBILITY):
 * 1. Màn hình trung tâm của ứng dụng TechShare, giúp người dùng tìm kiếm và thuê
 *    các thiết bị công nghệ (Máy ảnh, Drone, Laptop, VR, v.v.) ở gần mình nhất.
 * 2. Kết nối GPS thực tế của thiết bị với Backend MongoDB Geospatial ($geoNear).
 * 3. Tổ chức giao diện thành các khối thành phần nhỏ, dễ hiểu và dễ tái sử dụng:
 *    - HomeHeader (Logo, nút thông báo/đăng nhập)
 *    - HomeSearchBar (Tìm kiếm theo tên, thương hiệu)
 *    - CategoryBar (Bộ lọc danh mục sản phẩm)
 *    - PromoBanner (Banner khuyến mãi lướt tự động)
 *    - FeaturedRecommendations (Danh sách ngang thiết bị đánh giá cao nhất)
 *    - Danh sách lưới 2 cột các thiết bị lân cận (Nearby Devices Grid)
 *    - Nút nổi Trợ lý AI (AIAssistant FAB)
 * ============================================================================
 */

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DEVICES_PER_PAGE = 10;
const COLUMN_WIDTH = (SCREEN_WIDTH - 40) / 2; // 16px lề 2 bên + 8px khoảng cách giữa 2 cột

interface HomeScreenProps {
  navigation?: any;
  onNavigateToLogin?: () => void;
  onNavigateToDeviceDetail?: (deviceId: string) => void;
  onNavigateToMap?: () => void;
  showOwnerDashboard?: boolean;
  onNavigateToWishlist?: () => void;
  onNavigateToSearch?: () => void;
  onNavigateToNotifications?: () => void;
  onNavigateToChat?: () => void;
  onNavigateToAiConsultant?: () => void;
  onNavigateToOwnerDashboard?: () => void;
  unreadMessages?: number;
  unreadNotifications?: number;
}

export function HomeScreen({
  navigation,
  onNavigateToLogin,
  onNavigateToDeviceDetail,
  onNavigateToMap,
  showOwnerDashboard = false,
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

  // 1. DỮ LIỆU TỪ REDUX STORE (State Management)
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
  } = useAppSelector((state) => state.devices);

  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const favoriteIds = useAppSelector((state) => state.wishlist?.favoriteIds || []);

  // 2. STATE NỘI BỘ MÀN HÌNH (Local State)
  const [nearby, setNearby] = useState(true); // true = chế độ tìm gần GPS; false = xem tất cả
  const [recommendedDevices, setRecommendedDevices] = useState<Device[]>([]);
  const [categories, setCategories] = useState<DeviceCategory[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categoryReload, setCategoryReload] = useState(0);
  const [searchInput, setSearchInput] = useState('');

  // Refs giữ tọa độ và cờ chống gọi lặp request
  const currentLocationRef = useRef<HomeCoordinate | null>(null);
  const isLoadingNextPageRef = useRef(false);
  const latestFiltersRef = useRef({ category: selectedCategory, search: searchInput.trim() });
  latestFiltersRef.current = { category: selectedCategory, search: searchInput.trim() };

  // 3. TẢI DANH MỤC THIẾT BỊ TỪ BACKEND
  useEffect(() => {
    let isMounted = true;
    setIsLoadingCategories(true);
    setCategoryError(null);

    deviceService
      .getCategories()
      .then((data) => {
        if (isMounted) setCategories(data);
      })
      .catch(() => {
        if (isMounted) setCategoryError('Unable to load categories');
      })
      .finally(() => {
        if (isMounted) setIsLoadingCategories(false);
      });

    return () => {
      isMounted = false;
    };
  }, [categoryReload]);

  // 4. TẢI CÁC THIẾT BỊ NỔI BẬT (FEATURED RECOMMENDATIONS)
  useEffect(() => {
    let isMounted = true;
    deviceService
      .getRecommendedDevices(6)
      .then((data) => {
        if (isMounted) setRecommendedDevices(data);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  // 5. NẠP WISHLIST KHI ĐÃ ĐĂNG NHẬP
  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchWishlist());
    }
  }, [isAuthenticated, dispatch]);

  // 6. ĐỊNH VỊ GPS ĐỘNG (Custom Hook useHomeLocation)
  const location = useHomeLocation(handleLocationChange, nearby);

  /**
   * Hàm callback được gọi từ useHomeLocation khi:
   * - Lấy được tọa độ GPS ban đầu.
   * - Hoặc người dùng di chuyển lệch khỏi vị trí cũ từ 150 mét trở lên.
   */
  function handleLocationChange(coordinate: HomeCoordinate, force: boolean) {
    if (!nearby) return;

    const previousLocation = currentLocationRef.current;
    currentLocationRef.current = coordinate;

    const requestParams = {
      ...latestFiltersRef.current,
      nearby: true,
      ...coordinate,
      radius: HOME_NEARBY_RADIUS_METERS,
      page: 1,
      limit: DEVICES_PER_PAGE,
    };

    // Nếu chỉ refresh tại chỗ (di chuyển < 150m) thì giữ nguyên trang hiện tại
    const isRefreshingSameArea =
      force &&
      previousLocation &&
      homeDistanceMeters(previousLocation, coordinate) < HOME_LOCATION_MOVEMENT_METERS;

    if (isRefreshingSameArea) {
      dispatch(refreshDevices(requestParams));
      return;
    }

    // Nếu là vị trí mới: Xóa kết quả cũ và tải danh sách trang 1 từ đầu
    dispatch(resetDeviceDiscovery());
    dispatch(fetchDevices(requestParams));
  }

  /**
   * Gọi action Redux để tải danh sách thiết bị
   */
  function loadDevices(params: GetDevicesParams) {
    if (nearby && !currentLocationRef.current) return;

    return dispatch(
      fetchDevices({
        ...params,
        nearby,
        ...(nearby && currentLocationRef.current ? currentLocationRef.current : {}),
        radius: HOME_NEARBY_RADIUS_METERS,
        page: params.page || 1,
        limit: DEVICES_PER_PAGE,
      })
    );
  }

  // 7. XỬ LÝ TÌM KIẾM CÓ DEBOUNCE
  function handleSearchChange(value: string) {
    if (value.trim() !== searchInput.trim()) {
      dispatch(resetDeviceDiscovery());
    }
    setSearchInput(value);
  }

  useEffect(() => {
    dispatch(resetDeviceDiscovery());
    if (nearby && !currentLocationRef.current) return;

    // Chờ người dùng dừng gõ 400ms trước khi gửi request tìm kiếm
    const timer = setTimeout(() => {
      loadDevices({
        category: selectedCategory,
        search: searchInput.trim(),
        page: 1,
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [searchInput, nearby, selectedCategory]);

  // 8. CÁC HÀM XỬ LÝ TƯƠNG TÁC NGƯỜI DÙNG (User Actions)
  const handleSelectCategory = (category: DeviceCategory | 'all') => {
    latestFiltersRef.current = { ...latestFiltersRef.current, category };
    dispatch(setSelectedCategory(category));
  };

  const handleRefresh = () => {
    if (nearby) {
      void location.refresh(true);
    } else {
      dispatch(refreshDevices({ ...latestFiltersRef.current, nearby: false }));
    }
  };

  const handleLoadMore = () => {
    const isBusy = isLoading || isRefreshing || isLoadingNextPageRef.current;
    const isLocationBlocked = nearby && (!currentLocationRef.current || location.isLocating || !!location.error);
    const isPaginationBlocked = !!error || page < 1 || !hasNextPage;

    if (isLocationBlocked || isBusy || isPaginationBlocked) return;

    isLoadingNextPageRef.current = true;
    const req = loadDevices({
      category: selectedCategory,
      search: searchInput.trim(),
      page: page + 1,
    });

    void req?.finally(() => {
      isLoadingNextPageRef.current = false;
    });
  };

  const handleRetry = () => {
    loadDevices({ category: selectedCategory, search: searchInput.trim() });
  };

  const handleResetFilters = () => {
    latestFiltersRef.current = { category: 'all', search: '' };
    setSearchInput('');
    dispatch(clearFilters());
  };

  const handleToggleFavorite = (device: Device) => {
    if (!isAuthenticated) {
      Alert.alert(
        STRINGS.DEVICE_CARD.LOGIN_REQUIRED_TITLE,
        STRINGS.DEVICE_CARD.LOGIN_REQUIRED_MSG,
        [
          { text: STRINGS.COMMON.CANCEL, style: 'cancel' },
          { text: STRINGS.AUTH.LOGIN, onPress: () => onNavigateToLogin?.() },
        ]
      );
      return;
    }
    dispatch(toggleFavoriteDevice(device));
  };

  // ============================================================================
  // GIAO DIỆN HEADER CỦA DANH SÁCH (ListHeaderComponent)
  // ============================================================================
  const listHeader = (
    <View style={styles.headerArea}>
      {/* 1. Thanh tiêu đề trên cùng: Logo và nút chức năng */}
      <HomeHeader
        topInset={topInset}
        isAuthenticated={isAuthenticated}
        unreadMessages={unreadMessages}
        unreadNotifications={unreadNotifications}
        onNavigateToWishlist={onNavigateToWishlist}
        onNavigateToChat={onNavigateToChat}
        onNavigateToNotifications={onNavigateToNotifications}
        onNavigateToLogin={() => {
          if (onNavigateToLogin) onNavigateToLogin();
          else navigation?.navigate?.('Login');
        }}
      />

      {/* 2. Banner chuyển sang chế độ Chủ máy (nếu có quyền) */}
      <OwnerSwitchBanner
        visible={showOwnerDashboard}
        onPress={onNavigateToOwnerDashboard}
      />

      {/* 3. Thanh tìm kiếm thiết bị */}
      <HomeSearchBar
        value={searchInput}
        onChangeText={handleSearchChange}
        onClear={() => handleSearchChange('')}
      />

      {/* Thông báo tải danh mục nếu có */}
      {isLoadingCategories && <ActivityIndicator color={colors.light.primary} style={{ marginVertical: 4 }} />}
      {categoryError && (
        <TouchableOpacity onPress={() => setCategoryReload((v) => v + 1)}>
          <Text style={styles.errorSubtitle}>{categoryError}. Tap to retry.</Text>
        </TouchableOpacity>
      )}

      {/* 4. Thanh chọn danh mục thiết bị (Camera, Drone, Laptop, Audio, v.v.) */}
      <CategoryBar
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={handleSelectCategory}
      />

      {/* 5. Banner quảng cáo lướt tự động */}
      <PromoBanner />

      {/* 6. Danh sách ngang các thiết bị đề xuất đánh giá cao */}
      <FeaturedRecommendations
        devices={recommendedDevices}
        onSelectDevice={onNavigateToDeviceDetail}
      />

      {/* 7. Tiêu đề khu vực thiết bị chính kèm nút "View on Map" */}
      <SectionHeader
        title={nearby ? 'Nearby Devices' : STRINGS.HOME_SCREEN.SECTION_DISCOVER_TITLE}
        subtitle={
          selectedCategory === 'all'
            ? nearby
              ? location.cityName
                ? `Devices near ${location.cityName}`
                : 'Devices near your location'
              : STRINGS.HOME_SCREEN.SECTION_DISCOVER_SUB_ALL
            : STRINGS.HOME_SCREEN.SECTION_DISCOVER_SUB_FILTER(selectedCategory.toUpperCase())
        }
        badgeCount={hasLoaded && !(nearby && location.error) ? filteredDevices.length : undefined}
        actionText={nearby ? 'View on Map' : selectedCategory !== 'all' ? STRINGS.HOME_SCREEN.SEE_ALL : undefined}
        onActionPress={
          nearby
            ? onNavigateToMap
            : selectedCategory !== 'all'
            ? () => handleSelectCategory('all')
            : undefined
        }
      />
    </View>
  );

  // ============================================================================
  // CÁC GIAO DIỆN TRẠNG THÁI: LOADING, EMPTY, ERROR
  // ============================================================================

  // Skeleton hiển thị khi đang tải lần đầu
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

  // Giao diện khi chưa cấp quyền vị trí
  const renderLocationError = () => (
    <View style={styles.errorContainer}>
      <Ionicons name="location-outline" size={40} color={colors.light.primary} />
      <Text style={styles.errorTitle}>Location Permission Required</Text>
      <Text style={styles.errorSubtitle}>
        {location.error || 'Please enable location services to discover nearby devices.'}
      </Text>
      <View style={styles.errorButtonRow}>
        <TouchableOpacity style={styles.retryBtn} onPress={() => void location.refresh(true)}>
          <Ionicons name="reload-outline" size={14} color="#FFFFFF" />
          <Text style={styles.retryBtnText}>Retry GPS</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.retryBtn, { backgroundColor: colors.light.primary }]}
          onPress={() => setNearby(false)}
        >
          <Ionicons name="grid-outline" size={14} color="#FFFFFF" />
          <Text style={styles.retryBtnText}>Browse All</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={{ marginTop: 14 }} onPress={() => void Linking.openSettings()}>
        <Text style={styles.settingsLinkText}>Open Location Settings</Text>
      </TouchableOpacity>
    </View>
  );

  // Giao diện khi gặp lỗi mạng/API
  const renderErrorState = () => (
    <View style={styles.errorContainer}>
      <Ionicons name="alert-circle-outline" size={40} color={colors.light.error} />
      <Text style={styles.errorTitle}>{STRINGS.HOME_SCREEN.ERROR_TITLE}</Text>
      <Text style={styles.errorSubtitle}>{error}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={handleRetry} activeOpacity={0.8}>
        <Ionicons name="reload-outline" size={16} color={colors.light.white} />
        <Text style={styles.retryBtnText}>{STRINGS.HOME_SCREEN.TRY_AGAIN}</Text>
      </TouchableOpacity>
    </View>
  );

  // Giao diện danh sách trống
  const renderEmptyState = () => {
    if (nearby && location.error) return renderLocationError();
    if (error) return renderErrorState();
    if (isInitialLoading || (nearby && location.isLocating) || !hasLoaded) {
      return (
        <View>
          {searchInput.trim() ? <Text style={styles.emptySubtitle}>Searching for devices...</Text> : null}
          {renderLoadingSkeleton()}
        </View>
      );
    }

    if (nearby && filteredDevices.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="location-outline" size={36} color="#64748B" />
          </View>
          <Text style={styles.emptyTitle}>No devices found nearby</Text>
          <Text style={styles.emptySubtitle}>
            There are no available devices near your current location.
          </Text>
          <TouchableOpacity style={styles.resetBtn} onPress={() => setNearby(false)} activeOpacity={0.8}>
            <Ionicons name="globe-outline" size={16} color="#FFFFFF" />
            <Text style={styles.resetBtnText}>Browse All Devices</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconCircle}>
          <Ionicons name="hardware-chip-outline" size={36} color={colors.light.textSecondary} />
        </View>
        <Text style={styles.emptyTitle}>{STRINGS.HOME_SCREEN.EMPTY_TITLE}</Text>
        <Text style={styles.emptySubtitle}>
          {searchQuery || selectedCategory !== 'all'
            ? STRINGS.HOME_SCREEN.EMPTY_SUBTITLE_FILTER
            : STRINGS.HOME_SCREEN.EMPTY_SUBTITLE_ALL}
        </Text>

        {(searchQuery || selectedCategory !== 'all') && (
          <TouchableOpacity style={styles.resetBtn} onPress={handleResetFilters} activeOpacity={0.8}>
            <Ionicons name="refresh-outline" size={16} color={colors.light.white} />
            <Text style={styles.resetBtnText}>{STRINGS.HOME_SCREEN.SEE_ALL}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Render thẻ thiết bị 2 cột
  const renderDeviceCard = ({ item }: { item: Device }) => (
    <View style={styles.cardWrapper}>
      <DeviceCard
        device={item}
        onPress={onNavigateToDeviceDetail}
        onToggleFavorite={handleToggleFavorite}
        isFavorite={favoriteIds.includes(item._id)}
        width={COLUMN_WIDTH}
      />
    </View>
  );

  // Footer phân trang (Loading spinner hoặc hết dữ liệu)
  const renderListFooter = () => {
    if (filteredDevices.length === 0) return null;

    let footerContent;
    if (isLoadingMore || isRefreshing || (nearby && location.isLocating)) {
      footerContent = <ActivityIndicator color={colors.light.primary} />;
    } else if (error) {
      footerContent = (
        <TouchableOpacity onPress={() => loadDevices({ category: selectedCategory, search: searchInput.trim(), page: failedPage || 1 })}>
          <Text style={styles.errorSubtitle}>{error}</Text>
          <Text style={{ color: colors.light.primary, textAlign: 'center' }}>Retry loading devices</Text>
        </TouchableOpacity>
      );
    } else if (hasNextPage) {
      footerContent = (
        <TouchableOpacity onPress={handleLoadMore}>
          <Text style={{ color: colors.light.primary }}>Load more devices</Text>
        </TouchableOpacity>
      );
    } else {
      footerContent = <Text style={{ color: colors.light.textSecondary }}>All devices loaded</Text>;
    }

    return <View style={styles.footerContainer}>{footerContent}</View>;
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      {/* DANH SÁCH CUỘN CHÍNH (FlatList 2 Cột) */}
      <FlatList
        data={nearby && location.error ? [] : filteredDevices}
        keyExtractor={(item: Device) => item._id}
        renderItem={renderDeviceCard}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={listHeader}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderListFooter() ?? undefined}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing || (nearby && location.isRefreshingLocation)}
            onRefresh={handleRefresh}
            tintColor={colors.light.primary}
            colors={[colors.light.primary, colors.light.primaryHover]}
          />
        }
      />

      {/* NÚT TRỢ LÝ AI NỔI GÓC DƯỚI (Floating Action Button) */}
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
    </View>
  );
}

// ============================================================================
// STYLESHEET
// ============================================================================
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerArea: {
    paddingBottom: 4,
  },
  listContent: {
    paddingBottom: 24,
  },
  columnWrapper: {
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  cardWrapper: {
    width: COLUMN_WIDTH,
  },
  warningContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  warningText: {
    color: colors.light.textSecondary,
    fontSize: 12,
  },
  footerContainer: {
    padding: 20,
    alignItems: 'center',
  },
  aiConsultantButton: {
    position: 'absolute',
    right: 18,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.light.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  // Skeletons
  skeletonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 12,
  },
  skeletonCard: {
    flex: 1,
    height: 180,
    borderRadius: 14,
    backgroundColor: colors.light.surface,
    padding: 10,
    gap: 8,
  },
  skeletonImage: {
    width: '100%',
    height: 100,
    borderRadius: 10,
    backgroundColor: colors.light.border,
  },
  skeletonLine: {
    width: '80%',
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.light.border,
  },
  // Empty & Error States
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.light.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.light.border,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.light.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: colors.light.dangerLight,
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#EF4444',
    marginTop: 8,
    marginBottom: 4,
  },
  errorSubtitle: {
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 14,
  },
  errorButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EF4444',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.light.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  resetBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  settingsLinkText: {
    color: colors.light.primary,
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
