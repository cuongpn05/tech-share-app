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
import { HomeCoordinate, useHomeLocation } from '../../hooks/useHomeLocation';
import { deviceService } from '../../services/deviceService';
import { MapOwner, userService } from '../../services/userService';
import { useAppSelector } from '../../store';
import { Device, DeviceCategory } from '../../types';
import { colors } from '../../theme/colors';

interface MapScreenProps {
  onNavigateToDeviceDetail: (deviceId: string) => void;
  onNavigateToOwnerProfile?: (ownerId: string) => void;
}

// Tọa độ mặc định tại Việt Nam (Hà Nội: 21.0285, 105.8544)
const DEFAULT_COORDINATE: HomeCoordinate = { latitude: 21.0285, longitude: 105.8544 };

export function MapScreen({ onNavigateToDeviceDetail, onNavigateToOwnerProfile }: MapScreenProps) {
  const insets = useSafeAreaInsets();
  const homeCategory = useAppSelector(state => state.devices.selectedCategory);
  const [category, setCategory] = useState<DeviceCategory | 'all'>(homeCategory);
  const [categories, setCategories] = useState<DeviceCategory[]>([]);
  const [categoryError, setCategoryError] = useState(false);
  const [categoryRetry, setCategoryRetry] = useState(0);

  const [queryPosition, setQueryPosition] = useState<HomeCoordinate | null>(null);
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

  // Kích hoạt GPS và lắng nghe vị trí người dùng
  const location = useHomeLocation(coordinate => setQueryPosition(coordinate), true);
  const source = useMemo(() => ({ html: createGoogleMapHtml(), baseUrl: 'https://www.google.com' }), []);

  // Xác định tọa độ tìm kiếm (Ưu tiên GPS trong nước, fallback về Hà Nội)
  const effectivePosition: HomeCoordinate = useMemo(() => {
    const isCoordinateInVietnam = (coord: HomeCoordinate | null) =>
      Boolean(coord && coord.latitude >= 8 && coord.latitude <= 24 &&
              coord.longitude >= 102 && coord.longitude <= 110);

    if (isCoordinateInVietnam(queryPosition)) return queryPosition!;
    if (isCoordinateInVietnam(location.position)) return location.position!;
    return DEFAULT_COORDINATE;
  }, [queryPosition, location.position]);

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

  // Tải danh sách Chủ sở hữu & Thiết bị trên bản đồ (lọc theo Category và Tọa độ)
  useEffect(() => {
    let active = true;
    setLoadingOwners(true);
    setOwnerError(null);

    userService.getMapOwners({
      category: category !== 'all' ? category : undefined,
      lat: effectivePosition.latitude,
      lng: effectivePosition.longitude,
    })
      .then(data => {
        if (!active) return;
        setOwners(data);
      })
      .catch(() => {
        if (!active) return;
        setOwnerError('Không thể tải danh sách chủ sở hữu trên bản đồ. Vui lòng thử lại.');
      })
      .finally(() => {
        if (active) setLoadingOwners(false);
      });

    return () => { active = false; };
  }, [effectivePosition, category, ownerRetry]);

  // Bộ hẹn giờ kiểm tra tải bản đồ
  useEffect(() => {
    if (mapReady || mapError) return;
    const timeout = setTimeout(() => {
      setMapError('Bản đồ phản hồi quá lâu. Vui lòng kiểm tra kết nối mạng và thử lại.');
    }, 25000);
    return () => clearTimeout(timeout);
  }, [mapReady, mapError, mapReload]);

  // Đồng bộ vị trí người dùng và danh sách các chủ sở hữu sang WebView
  useEffect(() => {
    if (!mapReady || mapError) return;
    const isUserInVietnam = location.position &&
      location.position.latitude >= 8 && location.position.latitude <= 24 &&
      location.position.longitude >= 102 && location.position.longitude <= 110;

    const currentCoords = isUserInVietnam
      ? [location.position!.longitude, location.position!.latitude]
      : [effectivePosition.longitude, effectivePosition.latitude];

    webView.current?.postMessage(JSON.stringify({
      type: 'update',
      messageId: ++messageId.current,
      owners: markers,
      position: currentCoords,
      selectedId: selectedOwnerId,
    }));
  }, [mapReady, mapError, markers, location.position, effectivePosition, selectedOwnerId]);

  function handleMapMessage(event: WebViewMessageEvent) {
    const message = parseMapMessage(event.nativeEvent.data);
    if (message?.type === 'ready') setMapReady(true);
    if (message?.type === 'error') setMapError(message.message);
    if (message?.type === 'select') {
      const targetId = message.id || message.deviceId;
      if (targetId && markers.some(m => m.id === targetId)) {
        setSelectedOwnerId(targetId);
        setIsCollapsed(false); // Mở rộng panel khi chọn chủ mới
      } else {
        setSelectedOwnerId(null);
      }
    }
  }

  function focusMyLocation() {
    if (mapReady && !mapError) {
      const isUserInVietnam = location.position &&
        location.position.latitude >= 8 && location.position.latitude <= 24 &&
        location.position.longitude >= 102 && location.position.longitude <= 110;

      const targetPos = isUserInVietnam
        ? [location.position!.longitude, location.position!.latitude]
        : [DEFAULT_COORDINATE.longitude, DEFAULT_COORDINATE.latitude];

      webView.current?.postMessage(JSON.stringify({
        type: 'focus',
        messageId: ++messageId.current,
        position: targetPos,
      }));
    }
    void location.refresh(true);
  }

  function reloadMap() {
    setMapReady(false);
    setMapError(null);
    setMapReload(value => value + 1);
  }

  const locationMessage = location.error || location.warning;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Tiêu đề & Subtitle */}
      <View style={styles.header}>
        <Text style={styles.title}>Vị trí chủ thiết bị</Text>
        <Text style={styles.body}>Chạm vào chủ sở hữu trên bản đồ để xem các thiết bị cho thuê</Text>
      </View>

      {/* Thanh lọc Category */}
      <CategoryBar
        categories={categories}
        selectedCategory={category}
        onSelectCategory={(cat) => {
          setCategory(cat);
        }}
      />

      {categoryError ? (
        <TouchableOpacity style={styles.notice} onPress={() => setCategoryRetry(value => value + 1)}>
          <Text style={styles.error}>Không thể tải danh mục. Nhấn để thử lại.</Text>
        </TouchableOpacity>
      ) : null}

      {locationMessage ? (
        <View style={styles.notice}>
          <Text style={styles.error}>{locationMessage}</Text>
          <View style={styles.row}>
            <TouchableOpacity onPress={() => void location.refresh(true)}>
              <Text style={styles.link}>Thử lại GPS</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => void Linking.openSettings().catch(() => setOwnerError('Không thể mở cài đặt.'))}>
              <Text style={styles.link}>Mở cài đặt</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Trạng thái tải chủ sở hữu */}
      <View style={styles.notice}>
        {loadingOwners ? (
          <View style={styles.row}>
            <ActivityIndicator size="small" color={colors.light.primaryDark} />
            <Text style={styles.body}>Đang tìm các chủ thiết bị phù hợp...</Text>
          </View>
        ) : ownerError ? (
          <TouchableOpacity onPress={() => setOwnerRetry(value => value + 1)}>
            <Text style={styles.error}>{ownerError} Nhấn để thử lại.</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.body}>
            {markers.length > 0
              ? `Tìm thấy ${markers.length} chủ thiết bị trên bản đồ`
              : 'Không có chủ thiết bị nào trong danh mục này.'}
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
          onError={() => setMapError('Không thể tải bản đồ Google. Vui lòng kiểm tra mạng và thử lại.')}
          onRenderProcessGone={() => setMapError('Bộ xử lý bản đồ đã dừng. Vui lòng tải lại.')}
          onContentProcessDidTerminate={() => setMapError('Bộ xử lý bản đồ đã dừng. Vui lòng tải lại.')}
        />

        {(!mapReady || mapError) ? (
          <View style={styles.overlay}>
            {mapError ? (
              <>
                <Ionicons name="alert-circle-outline" size={44} color={colors.light.error} />
                <Text style={styles.errorCenter}>{mapError}</Text>
                <TouchableOpacity style={styles.button} onPress={reloadMap}>
                  <Text style={styles.buttonText}>Tải lại bản đồ</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <ActivityIndicator size="large" color={colors.light.primaryDark} />
                <Text style={styles.body}>Đang tải Google Maps...</Text>
              </>
            )}
          </View>
        ) : null}

        {/* Nút định vị GPS */}
        <TouchableOpacity
          style={styles.locate}
          onPress={focusMyLocation}
          accessibilityRole="button"
          accessibilityLabel="Vị trí của tôi"
        >
          <Ionicons name="locate" size={24} color={colors.light.primaryDark} />
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
                      ? `Cách ${(selectedOwner.distanceMeters / 1000).toFixed(1)} km`
                      : ''}
                    {selectedOwner.address ? ` · ${selectedOwner.address}` : ''}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.drawerControls}>
              {/* Nút Xem Hồ sơ */}
              {onNavigateToOwnerProfile ? (
                <TouchableOpacity
                  style={styles.viewProfileBtn}
                  onPress={() => onNavigateToOwnerProfile(selectedOwner.id || selectedOwner._id)}
                  accessibilityRole="button"
                  accessibilityLabel="Xem hồ sơ chủ sở hữu"
                >
                  <Text style={styles.viewProfileBtnText}>Hồ sơ</Text>
                  <Ionicons name="chevron-forward" size={12} color={colors.light.primaryDark} />
                </TouchableOpacity>
              ) : null}

              {/* Nút Đóng */}
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setSelectedOwnerId(null)}
                accessibilityLabel="Đóng thông tin chủ sở hữu"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={18} color={colors.light.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Dòng Tiêu đề Thiết bị và Nút Thu gọn / Mở rộng ở bên phải */}
          <View style={styles.devicesHeaderRow}>
            <View style={styles.devicesTitleGroup}>
              <Text style={styles.devicesSectionTitle}>
                Thiết bị cho thuê ({filteredOwnerDevices.length})
              </Text>
              {category !== 'all' ? (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>Lọc: {category}</Text>
                </View>
              ) : null}
            </View>

            {/* Nút Mở rộng / Thu gọn nằm bên phải của "Thiết bị cho thuê" */}
            <TouchableOpacity
              style={styles.toggleCollapseBtn}
              onPress={() => setIsCollapsed(!isCollapsed)}
              accessibilityRole="button"
              accessibilityLabel={isCollapsed ? 'Mở rộng danh sách thiết bị' : 'Thu gọn danh sách thiết bị'}
            >
              <Text style={styles.toggleCollapseText}>{isCollapsed ? 'Mở rộng' : 'Thu gọn'}</Text>
              <Ionicons
                name={isCollapsed ? 'chevron-down' : 'chevron-up'}
                size={15}
                color={colors.light.primaryDark}
              />
            </TouchableOpacity>
          </View>

          {/* Danh sách thiết bị (Chỉ hiển thị khi KHÔNG thu gọn) */}
          {!isCollapsed ? (
            <View style={styles.drawerExpandedContent}>
              {filteredOwnerDevices.length === 0 ? (
                <View style={styles.emptyDevicesBox}>
                  <Ionicons name="cube-outline" size={32} color={colors.light.textMuted} />
                  <Text style={styles.emptyDevicesText}>
                    Chủ sở hữu này không có thiết bị thuộc danh mục "{category}".
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
                              {device.category?.toUpperCase() || 'THIẾT BỊ'}
                            </Text>
                            <View style={[styles.statusPill, isAvailable ? styles.statusAvailable : styles.statusOther]}>
                              <Text style={[styles.statusPillText, isAvailable ? styles.statusAvailableText : styles.statusOtherText]}>
                                {isAvailable ? 'Sẵn sàng' : (device.status || 'Đang bận')}
                              </Text>
                            </View>
                          </View>

                          <Text style={styles.deviceItemName} numberOfLines={2}>
                            {device.name || device.title}
                          </Text>

                          <View style={styles.deviceItemFooter}>
                            <Text style={styles.deviceItemPrice}>
                              {typeof rate === 'number' && Number.isFinite(rate)
                                ? `${rate.toLocaleString('vi-VN')} đ/ngày`
                                : 'Liên hệ'}
                            </Text>
                            <View style={styles.viewDetailPill}>
                              <Text style={styles.viewDetailPillText}>Xem chi tiết</Text>
                              <Ionicons name="arrow-forward" size={13} color={colors.light.primaryDark} />
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
  map: { flex: 1, overflow: 'hidden' },
  webView: { flex: 1, backgroundColor: colors.light.background },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.light.background, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  locate: { position: 'absolute', right: 14, bottom: 20, padding: 12, borderRadius: 26, backgroundColor: colors.light.surface, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
  button: { paddingVertical: 11, paddingHorizontal: 16, backgroundColor: colors.light.primaryDark, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: colors.light.white, fontWeight: '700', fontSize: 14 },

  /* Bảng điều khiển Owner (Drawer) */
  drawerContainer: {
    backgroundColor: colors.light.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderTopColor: colors.light.borderDefault,
    elevation: 10,
    shadowColor: '#000',
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
    backgroundColor: '#E2E8F0',
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
    color: '#D97706',
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
    backgroundColor: '#F1F5F9',
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
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
  },
  deviceItemThumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
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
    backgroundColor: '#DCFCE7',
  },
  statusOther: {
    backgroundColor: '#F1F5F9',
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: '700',
  },
  statusAvailableText: {
    color: '#166534',
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
