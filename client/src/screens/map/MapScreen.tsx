import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryBar } from '../../components/home/CategoryBar';
import {
  createGoogleMapHtml,
  getMapOwnersMarkers,
  parseMapMessage,
} from '../../components/map/mapHtml';
import { HomeCoordinate, homeDistanceMeters, useHomeLocation } from '../../hooks/useHomeLocation';
import { deviceService } from '../../services/deviceService';
import { MapOwner, userService } from '../../services/userService';
import { useAppSelector } from '../../store';
import { Device, DeviceCategory } from '../../types';
import { colors } from '../../theme/colors';
import { STRINGS } from '../../constants/strings';

interface MapScreenProps {
  onNavigateToDeviceDetail: (deviceId: string) => void;
  onNavigateToOwnerProfile?: (ownerId: string) => void;
}

export function MapScreen({ onNavigateToDeviceDetail, onNavigateToOwnerProfile }: MapScreenProps) {
  const insets = useSafeAreaInsets();
  const homeCategory = useAppSelector(state => state.devices.selectedCategory);
  const [category, setCategory] = useState<DeviceCategory | 'all'>(homeCategory);
  const [categories, setCategories] = useState<DeviceCategory[]>([]);
  const [categoryError, setCategoryError] = useState(false);
  const [categoryRetry, setCategoryRetry] = useState(0);

  // Tọa độ tìm kiếm thiết bị lân cận (khởi tạo động từ GPS thực tế, KHÔNG hardcode Hà Nội)
  const [searchCoordinate, setSearchCoordinate] = useState<HomeCoordinate | null>(null);
  // Tọa độ tâm bản đồ hiện tại (cập nhật khi người dùng kéo bản đồ sang khu vực khác)
  const [mapCenter, setMapCenter] = useState<HomeCoordinate | null>(null);

  const [owners, setOwners] = useState<MapOwner[]>([]);
  const [loadingOwners, setLoadingOwners] = useState(false);
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [ownerRetry, setOwnerRetry] = useState(0);

  const [selectedOwnerId, setSelectedOwnerId] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReload, setMapReload] = useState(0);

  const webView = useRef<WebView>(null);
  const messageId = useRef(0);
  const hasFocusedInitialGps = useRef(false);

  // Kích hoạt GPS và lắng nghe vị trí người dùng thực tế
  const location = useHomeLocation((coordinate) => {
    // Khi nhận được GPS thực tế, cập nhật tọa độ tìm kiếm nếu chưa có hoặc vừa định vị
    setSearchCoordinate(prev => prev ?? coordinate);
    setMapCenter(prev => prev ?? coordinate);
  }, true);

  const source = useMemo(() => ({ html: createGoogleMapHtml(), baseUrl: 'https://www.google.com' }), []);

  // Vị trí GPS thực tế của người dùng (chỉ có khi được cấp quyền và GPS hợp lệ)
  const userGps = location.position;

  // Trích xuất các ghim Chủ sở hữu (Owner)
  const markers = useMemo(() => getMapOwnersMarkers(owners), [owners]);

  // Tìm chủ sở hữu đang được chọn
  const selectedOwner = useMemo(() => {
    if (!selectedOwnerId) return null;
    return owners.find(o => (o.id || o._id) === selectedOwnerId) || null;
  }, [owners, selectedOwnerId]);

  // Lọc danh sách thiết bị của chủ sở hữu theo Category đang chọn
  const filteredOwnerDevices = useMemo(() => {
    if (!selectedOwner || !Array.isArray(selectedOwner.devices)) return [];
    if (category === 'all') return selectedOwner.devices;
    return selectedOwner.devices.filter(
      d => d.category?.toLowerCase() === category.toLowerCase()
    );
  }, [selectedOwner, category]);

  // Tải danh mục thiết bị
  useEffect(() => {
    let active = true;
    setCategoryError(false);
    deviceService.getCategories()
      .then(data => { if (active) setCategories(data); })
      .catch(() => { if (active) setCategoryError(true); });
    return () => { active = false; };
  }, [categoryRetry]);

  // Tải danh sách Chủ sở hữu & Thiết bị trên bản đồ (lọc theo tọa độ tìm kiếm động, bán kính 50km)
  useEffect(() => {
    let active = true;
    if (!searchCoordinate) {
      setOwners([]);
      return;
    }

    setLoadingOwners(true);
    setOwnerError(null);

    userService.getMapOwners({
      category: category !== 'all' ? category : undefined,
      lat: searchCoordinate.latitude,
      lng: searchCoordinate.longitude,
      radius: 50000, // 50 km quanh tọa độ tìm kiếm
    })
      .then(data => {
        if (!active) return;
        setOwners(data);
      })
      .catch(() => {
        if (!active) return;
        setOwnerError(STRINGS.MAP.ERR_LOAD_OWNERS);
      })
      .finally(() => {
        if (active) setLoadingOwners(false);
      });

    return () => { active = false; };
  }, [searchCoordinate, category, ownerRetry]);

  useEffect(() => {
    if (mapReady || mapError) return;
    const timeout = setTimeout(() => {
      setMapError(STRINGS.MAP.ERR_MAP_TIMEOUT);
    }, 25000);
    return () => clearTimeout(timeout);
  }, [mapReady, mapError, mapReload]);

  // Đồng bộ vị trí người dùng thực tế và danh sách các chủ sở hữu sang WebView
  useEffect(() => {
    if (!mapReady || mapError) return;

    // Tọa độ người dùng chỉ gửi khi CÓ GPS THẬT (không bao giờ giả lập vị trí cố định)
    const userGpsCoords = userGps
      ? [userGps.longitude, userGps.latitude]
      : null;

    // Lấy vị trí và thông tin các thiết bị thuộc chủ sở hữu đang chọn
    const selectedOwnerDevices = selectedOwner
      ? filteredOwnerDevices.map(d => ({
          id: d._id,
          name: d.name || d.title,
          price: d.pricePerDay ?? d.dailyRate,
          category: d.category,
          coordinates: d.location?.coordinates || selectedOwner.coordinates,
          address: d.location?.addressText || d.addressText || selectedOwner.address,
        }))
      : [];

    webView.current?.postMessage(JSON.stringify({
      type: 'update',
      messageId: ++messageId.current,
      owners: markers,
      devices: selectedOwnerDevices,
      position: userGpsCoords,
      selectedId: selectedOwnerId,
    }));

    // Tự động di chuyển tới vị trí GPS của người dùng lần đầu tiên khi lấy được tọa độ
    if (userGps && !hasFocusedInitialGps.current) {
      hasFocusedInitialGps.current = true;
      webView.current?.postMessage(JSON.stringify({
        type: 'focus',
        messageId: ++messageId.current,
        position: [userGps.longitude, userGps.latitude],
      }));
    }
  }, [mapReady, mapError, markers, userGps, selectedOwnerId, filteredOwnerDevices]);

  function handleMapMessage(event: WebViewMessageEvent) {
    const message = parseMapMessage(event.nativeEvent.data);
    if (!message) return;

    if (message.type === 'ready') setMapReady(true);
    if (message.type === 'error') setMapError(message.message);
    if (message.type === 'select') {
      const targetId = message.id || message.deviceId;
      if (targetId && markers.some(m => m.id === targetId)) {
        setSelectedOwnerId(targetId);
        setIsCollapsed(false); // Mở rộng panel khi chọn chủ mới
      } else {
        setSelectedOwnerId(null);
      }
    }
    if (message.type === 'select_device') {
      onNavigateToDeviceDetail(message.deviceId);
    }
    // Khi người dùng kéo bản đồ sang khu vực khác (lắng nghe sự kiện dragend từ Leaflet)
    if (message.type === 'center_change') {
      const newCenter: HomeCoordinate = {
        latitude: message.center[1],
        longitude: message.center[0],
      };
      setMapCenter(newCenter);
      // Nếu chưa có tọa độ tìm kiếm (ví dụ người dùng từ chối GPS), dùng tâm bản đồ để tải dữ liệu
      if (!searchCoordinate) {
        setSearchCoordinate(newCenter);
      }
    }
  }

  // Tiêu điểm bản đồ vào vị trí cụ thể của thiết bị
  function focusOnDevice(device: Device) {
    const coords = device.location?.coordinates || (device as any).coordinates || selectedOwner?.coordinates;
    if (coords && Array.isArray(coords) && coords.length === 2 && mapReady && !mapError) {
      webView.current?.postMessage(JSON.stringify({
        type: 'focus_device',
        messageId: ++messageId.current,
        position: coords,
      }));
    }
  }

  // Nút định vị My Location: Đưa bản đồ về vị trí GPS thực tế của người dùng
  function focusMyLocation() {
    if (userGps) {
      setSearchCoordinate(userGps);
      setMapCenter(userGps);
      if (mapReady && !mapError) {
        webView.current?.postMessage(JSON.stringify({
          type: 'focus',
          messageId: ++messageId.current,
          position: [userGps.longitude, userGps.latitude],
        }));
      }
    }
    // Lấy lại vị trí GPS mới nhất
    void location.refresh(true);
  }

  // Nút tìm kiếm tại khu vực hiện tại trên bản đồ (khi người dùng kéo bản đồ đi xa > 3km)
  function handleSearchThisArea() {
    if (mapCenter) {
      setSearchCoordinate(mapCenter);
    }
  }

  // Kiểm tra xem người dùng có đang kéo bản đồ ra xa khỏi điểm đã tìm kiếm hay không (> 3km)
  const isMovedAway = Boolean(
    mapCenter &&
    searchCoordinate &&
    homeDistanceMeters(mapCenter, searchCoordinate) > 3000
  );

  function reloadMap() {
    setMapReady(false);
    setMapError(null);
    setMapReload(value => value + 1);
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Tiêu đề & Subtitle */}
      <View style={styles.header}>
        <Text style={styles.title}>{STRINGS.MAP.TITLE}</Text>
        <Text style={styles.body}>{STRINGS.MAP.SUBTITLE}</Text>
      </View>

      {/* Category Filter Bar */}
      <CategoryBar
        categories={categories}
        selectedCategory={category}
        onSelectCategory={(cat) => {
          setCategory(cat);
        }}
      />

      {categoryError ? (
        <TouchableOpacity style={styles.notice} onPress={() => setCategoryRetry(value => value + 1)}>
          <Text style={styles.error}>{STRINGS.MAP.ERR_LOAD_CATEGORIES}</Text>
        </TouchableOpacity>
      ) : null}

      {/* GPS Status / Location Permission */}
      {location.isLocating && !userGps && !searchCoordinate ? (
        <View style={styles.locationBannerLoading}>
          <View style={styles.row}>
            <ActivityIndicator size="small" color={colors.light.primaryDark} />
            <Text style={styles.body}>{STRINGS.MAP.LOCATING_GPS}</Text>
          </View>
        </View>
      ) : location.error && !userGps ? (
        <View style={styles.locationBannerError}>
          <View style={styles.row}>
            <Ionicons name="location-outline" size={18} color={colors.light.error} />
            <Text style={[styles.error, { flex: 1 }]}>{location.error}</Text>
          </View>
          <View style={[styles.row, { marginTop: 4 }]}>
            <TouchableOpacity
              style={styles.actionBtnSmall}
              onPress={() => void location.refresh(true)}
              accessibilityRole="button"
              accessibilityLabel={STRINGS.MAP.RETRY_GPS}
            >
              <Ionicons name="refresh" size={13} color={colors.light.primaryDark} />
              <Text style={styles.link}>{STRINGS.MAP.RETRY_GPS}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtnSmall}
              onPress={() => void Linking.openSettings().catch(() => setOwnerError(STRINGS.MAP.ERR_OPEN_SETTINGS))}
              accessibilityRole="button"
              accessibilityLabel={STRINGS.MAP.OPEN_SETTINGS}
            >
              <Ionicons name="settings-outline" size={13} color={colors.light.primaryDark} />
              <Text style={styles.link}>{STRINGS.MAP.OPEN_SETTINGS}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : location.warning ? (
        <View style={styles.notice}>
          <Text style={styles.warningText}>{location.warning}</Text>
        </View>
      ) : null}

      {/* Owner & Device Loading Status */}
      <View style={styles.notice}>
        {loadingOwners ? (
          <View style={styles.row}>
            <ActivityIndicator size="small" color={colors.light.primaryDark} />
            <Text style={styles.body}>{STRINGS.MAP.SEARCHING_OWNERS}</Text>
          </View>
        ) : ownerError ? (
          <TouchableOpacity onPress={() => setOwnerRetry(value => value + 1)}>
            <Text style={styles.error}>{ownerError} {STRINGS.MAP.TRY_AGAIN}</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.body}>
            {searchCoordinate
              ? (markers.length > 0
                ? STRINGS.MAP.FOUND_OWNERS(markers.length)
                : STRINGS.MAP.NO_OWNERS_FOUND(category))
              : STRINGS.MAP.WAITING_GPS}
          </Text>
        )}
      </View>

      {/* Google Maps Container */}
      <View style={styles.map}>
        <WebView
          key={mapReload}
          ref={webView}
          source={source}
          style={styles.webView}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          mixedContentMode="always"
          allowFileAccess={false}
          javaScriptCanOpenWindowsAutomatically={false}
          setSupportMultipleWindows={false}
          geolocationEnabled={false}
          onMessage={handleMapMessage}
          onError={() => setMapError(STRINGS.MAP.ERR_MAP_LOAD)}
          onRenderProcessGone={() => setMapError(STRINGS.MAP.ERR_MAP_PROCESS)}
          onContentProcessDidTerminate={() => setMapError(STRINGS.MAP.ERR_MAP_PROCESS)}
        />

        {/* Search this area button */}
        {isMovedAway ? (
          <TouchableOpacity
            style={styles.searchAreaBtn}
            onPress={handleSearchThisArea}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={STRINGS.MAP.SEARCH_THIS_AREA}
          >
            <Ionicons name="search" size={15} color={colors.light.primaryDark} />
            <Text style={styles.searchAreaBtnText}>{STRINGS.MAP.SEARCH_THIS_AREA}</Text>
          </TouchableOpacity>
        ) : null}

        {(!mapReady || mapError) ? (
          <View style={styles.overlay}>
            {mapError ? (
              <>
                <Ionicons name="alert-circle-outline" size={44} color={colors.light.error} />
                <Text style={styles.errorCenter}>{mapError}</Text>
                <TouchableOpacity style={styles.button} onPress={reloadMap}>
                  <Text style={styles.buttonText}>{STRINGS.MAP.RELOAD_MAP}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <ActivityIndicator size="large" color={colors.light.primaryDark} />
                <Text style={styles.body}>{STRINGS.MAP.LOADING_MAP}</Text>
              </>
            )}
          </View>
        ) : null}

        {/* Locate My Location button */}
        <TouchableOpacity
          style={styles.locate}
          onPress={focusMyLocation}
          accessibilityRole="button"
          accessibilityLabel={STRINGS.MAP.MY_LOCATION}
        >
          <Ionicons
            name={userGps ? "navigate" : "locate"}
            size={24}
            color={userGps ? colors.light.primaryDark : colors.light.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Bảng điều khiển Owner và Danh sách thiết bị (Có nút thu gọn / mở rộng) */}
      {selectedOwner ? (
        <View style={styles.drawerContainer}>
          {/* Thanh Header: Thông tin Chủ sở hữu + Nút Hồ sơ + Nút Đóng */}
          <View style={styles.drawerHeaderBar}>
            <View style={styles.drawerHeaderLeft}>
              {selectedOwner.avatar ? (
                <Image source={{ uri: selectedOwner.avatar }} style={styles.ownerThumb} />
              ) : (
                <View style={[styles.ownerThumb, styles.ownerThumbPlaceholder]}>
                  <Ionicons name="person" size={18} color={colors.light.primaryDark} />
                </View>
              )}
              <View style={styles.ownerHeaderInfo}>
                <View style={styles.ownerNameRow}>
                  <Text style={styles.ownerTitle} numberOfLines={1}>{selectedOwner.name}</Text>
                  {selectedOwner.isVerified ? (
                    <Ionicons name="shield-checkmark" size={15} color={colors.light.primaryHover} />
                  ) : null}
                </View>
                <View style={styles.ownerMetaSubRow}>
                  {typeof selectedOwner.rating === 'number' && selectedOwner.rating > 0 ? (
                    <Text style={styles.ownerRatingBadge}>★ {selectedOwner.rating.toFixed(1)}  ·  </Text>
                  ) : null}
                  <Text style={styles.ownerDistanceText} numberOfLines={1}>
                    {typeof selectedOwner.distanceMeters === 'number'
                      ? STRINGS.MAP.DISTANCE_KM((selectedOwner.distanceMeters / 1000).toFixed(1))
                      : ''}
                    {selectedOwner.address ? ` · ${selectedOwner.address}` : ''}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.drawerControls}>
              {/* View Profile Button */}
              {onNavigateToOwnerProfile ? (
                <TouchableOpacity
                  style={styles.viewProfileBtn}
                  onPress={() => onNavigateToOwnerProfile(selectedOwner.id || selectedOwner._id)}
                  accessibilityRole="button"
                  accessibilityLabel={STRINGS.MAP.VIEW_OWNER_PROFILE}
                >
                  <Text style={styles.viewProfileBtnText}>{STRINGS.MAP.OWNER_PROFILE}</Text>
                  <Ionicons name="chevron-forward" size={12} color={colors.light.primaryDark} />
                </TouchableOpacity>
              ) : null}

              {/* Close Button */}
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setSelectedOwnerId(null)}
                accessibilityLabel={STRINGS.MAP.CLOSE_OWNER_INFO}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={18} color={colors.light.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Devices Header Row */}
          <View style={styles.devicesHeaderRow}>
            <View style={styles.devicesTitleGroup}>
              <Text style={styles.devicesSectionTitle}>
                {STRINGS.MAP.AVAILABLE_DEVICES(filteredOwnerDevices.length)}
              </Text>
              {category !== 'all' ? (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>{STRINGS.MAP.FILTER_LABEL(category)}</Text>
                </View>
              ) : null}
            </View>

            {/* Expand / Collapse Toggle Button */}
            <TouchableOpacity
              style={styles.toggleCollapseBtn}
              onPress={() => setIsCollapsed(!isCollapsed)}
              accessibilityRole="button"
              accessibilityLabel={isCollapsed ? STRINGS.MAP.EXPAND_DEVICE_LIST : STRINGS.MAP.COLLAPSE_DEVICE_LIST}
            >
              <Text style={styles.toggleCollapseText}>{isCollapsed ? STRINGS.MAP.EXPAND : STRINGS.MAP.COLLAPSE}</Text>
              <Ionicons
                name={isCollapsed ? 'chevron-down' : 'chevron-up'}
                size={15}
                color={colors.light.primaryDark}
              />
            </TouchableOpacity>
          </View>

          {/* Devices List */}
          {!isCollapsed ? (
            <View style={styles.drawerExpandedContent}>
              {filteredOwnerDevices.length === 0 ? (
                <View style={styles.emptyDevicesBox}>
                  <Ionicons name="cube-outline" size={32} color={colors.light.textMuted} />
                  <Text style={styles.emptyDevicesText}>
                    {STRINGS.MAP.NO_DEVICES_CATEGORY(category)}
                  </Text>
                </View>
              ) : (
                <ScrollView style={styles.devicesScrollList} showsVerticalScrollIndicator={false}>
                  {filteredOwnerDevices.map((device: Device) => {
                    const rate = device.pricePerDay ?? device.dailyRate;
                    const imgUrl = device.images?.[0];
                    const isAvailable = device.status === 'available';

                    return (
                      <TouchableOpacity
                        key={device._id}
                        style={styles.deviceItemCard}
                        onPress={() => onNavigateToDeviceDetail(device._id)}
                        activeOpacity={0.7}
                      >
                        {imgUrl ? (
                          <Image source={{ uri: imgUrl }} style={styles.deviceItemThumb} />
                        ) : (
                          <View style={[styles.deviceItemThumb, styles.deviceThumbPlaceholder]}>
                            <Ionicons name="cube-outline" size={22} color={colors.light.textSecondary} />
                          </View>
                        )}

                        <View style={styles.deviceItemInfo}>
                          <View style={styles.rowBetween}>
                            <Text style={styles.deviceItemCategory}>
                              {device.category?.toUpperCase() || STRINGS.MAP.DEFAULT_TITLE.toUpperCase()}
                            </Text>
                            <View style={[styles.statusPill, isAvailable ? styles.statusAvailable : styles.statusOther]}>
                              <Text style={[styles.statusPillText, isAvailable ? styles.statusAvailableText : styles.statusOtherText]}>
                                {isAvailable ? STRINGS.MAP.AVAILABLE : (device.status || STRINGS.MAP.UNAVAILABLE)}
                              </Text>
                            </View>
                          </View>

                          <Text style={styles.deviceItemName} numberOfLines={2}>
                            {device.name || device.title}
                          </Text>

                          {/* Device location and distance */}
                          <View style={styles.deviceLocationRow}>
                            <Ionicons name="location-outline" size={12} color={colors.light.primaryDark} />
                            <Text style={styles.deviceLocationText} numberOfLines={1}>
                              {device.location?.addressText || device.addressText || selectedOwner.address || 'Vietnam'}
                              {typeof device.distanceMeters === 'number'
                                ? ` · ${STRINGS.MAP.DISTANCE_KM((device.distanceMeters / 1000).toFixed(1))}`
                                : ''}
                            </Text>
                          </View>

                          <View style={styles.deviceItemFooter}>
                            <Text style={styles.deviceItemPrice}>
                              {typeof rate === 'number' && Number.isFinite(rate)
                                ? `${rate.toLocaleString('en-US')} VND${STRINGS.MAP.PER_DAY}`
                                : STRINGS.MAP.CONTACT}
                            </Text>
                            <View style={styles.deviceActionsRow}>
                              <TouchableOpacity
                                style={styles.focusDevicePill}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  focusOnDevice(device);
                                }}
                                accessibilityRole="button"
                                accessibilityLabel={STRINGS.MAP.FOCUS_DEVICE}
                              >
                                <Ionicons name="map-outline" size={11} color={colors.light.primaryDark} />
                                <Text style={styles.focusDevicePillText}>{STRINGS.MAP.FOCUS}</Text>
                              </TouchableOpacity>
                              <View style={styles.viewDetailPill}>
                                <Text style={styles.viewDetailPillText}>{STRINGS.MAP.DETAILS}</Text>
                                <Ionicons name="arrow-forward" size={12} color={colors.light.primaryDark} />
                              </View>
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.light.background },
  header: { paddingHorizontal: 16, paddingTop: 12, gap: 4 },
  title: { fontSize: 22, fontWeight: '800', color: colors.light.textPrimary },
  body: { fontSize: 13, lineHeight: 19, color: colors.light.textSecondary, flexShrink: 1 },
  notice: { paddingHorizontal: 16, paddingBottom: 6, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  error: { color: colors.light.error, fontSize: 13, lineHeight: 19 },
  errorCenter: { color: colors.light.error, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  link: { color: colors.light.primaryDark, fontWeight: '700', fontSize: 13 },
  warningText: { color: colors.light.warning, fontSize: 13, lineHeight: 19 },
  map: { flex: 1, overflow: 'hidden' },
  webView: { flex: 1, backgroundColor: colors.light.background },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.light.background, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  locate: { position: 'absolute', right: 14, bottom: 20, padding: 12, borderRadius: 26, backgroundColor: colors.light.surface, elevation: 4, shadowColor: colors.light.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
  button: { paddingVertical: 11, paddingHorizontal: 16, backgroundColor: colors.light.primaryDark, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: colors.light.white, fontWeight: '700', fontSize: 14 },

  /* Nút tìm kiếm tại khu vực này khi kéo bản đồ */
  searchAreaBtn: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.light.surface,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 22,
    elevation: 5,
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: colors.light.primaryDark,
    zIndex: 10,
  },
  searchAreaBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.primaryDark,
  },

  /* Banners thông báo trạng thái vị trí */
  locationBannerLoading: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.light.primaryLight,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.borderSubtle,
  },
  locationBannerError: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.light.dangerLight,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.redBorder,
    gap: 4,
  },
  actionBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
    marginRight: 8,
  },

  /* Bảng điều khiển Owner (Drawer) */
  drawerContainer: {
    backgroundColor: colors.light.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderTopColor: colors.light.borderDefault,
    elevation: 10,
    shadowColor: colors.light.shadow,
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    maxHeight: 450,
  },
  drawerHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.borderDefault,
  },
  drawerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  ownerThumb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.light.borderDefault,
  },
  ownerThumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.light.primaryLight,
  },
  ownerHeaderInfo: {
    flex: 1,
    gap: 2,
  },
  ownerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ownerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.light.textPrimary,
  },
  ownerMetaSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  ownerRatingBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.warning,
  },
  ownerDistanceText: {
    fontSize: 12,
    color: colors.light.textSecondary,
    flexShrink: 1,
  },
  drawerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
  },
  viewProfileBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.primaryDark,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: colors.light.borderSubtle,
  },

  /* Tiêu đề danh sách thiết bị và nút Mở rộng / Thu gọn */
  devicesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingBottom: 4,
  },
  devicesTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  devicesSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.light.textPrimary,
  },
  categoryBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: colors.light.primaryLight,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.light.primaryDark,
  },
  toggleCollapseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: colors.light.primaryLight,
    borderRadius: 14,
  },
  toggleCollapseText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.light.primaryDark,
  },

  /* Nội dung mở rộng */
  drawerExpandedContent: {
    paddingTop: 8,
    gap: 8,
  },
  emptyDevicesBox: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyDevicesText: {
    fontSize: 13,
    color: colors.light.textSecondary,
    textAlign: 'center',
  },

  /* Thẻ thiết bị */
  devicesScrollList: {
    maxHeight: 260,
  },
  deviceItemCard: {
    flexDirection: 'row',
    gap: 10,
    padding: 9,
    backgroundColor: colors.light.background,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
  },
  deviceItemThumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: colors.light.borderDefault,
  },
  deviceThumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceItemInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  deviceItemCategory: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.light.textSecondary,
    letterSpacing: 0.5,
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  statusAvailable: {
    backgroundColor: colors.light.successLight,
  },
  statusOther: {
    backgroundColor: colors.light.borderSubtle,
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: '700',
  },
  statusAvailableText: {
    color: colors.light.success,
  },
  statusOtherText: {
    color: colors.light.textSecondary,
  },
  deviceItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.light.textPrimary,
    lineHeight: 18,
  },
  deviceItemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deviceItemPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.light.primaryDark,
  },
  deviceLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginVertical: 2,
  },
  deviceLocationText: {
    fontSize: 11,
    color: colors.light.textSecondary,
    flexShrink: 1,
  },
  deviceActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  focusDevicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 6,
    backgroundColor: colors.light.primaryLight,
  },
  focusDevicePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.light.primaryDark,
  },
  viewDetailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  viewDetailPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.light.primaryDark,
  },
});
