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
import { createMapHtml, getMapDevices, parseMapMessage } from '../../components/map/mapHtml';
import { FAVI_MAP_API_KEY } from '../../config/faviMap';
import { HomeCoordinate, useHomeLocation } from '../../hooks/useHomeLocation';
import { deviceService, HOME_NEARBY_RADIUS_METERS } from '../../services/deviceService';
import { useAppSelector } from '../../store';
import { Device, DeviceCategory } from '../../types';
import { colors } from '../../theme/colors';

interface MapScreenProps {
  onNavigateToDeviceDetail: (deviceId: string) => void;
}

// 3 khu vực tập trung thiết bị chính trong hệ thống
const POPULAR_LOCATIONS: { name: string; coordinate: HomeCoordinate }[] = [
  { name: 'Hà Nội', coordinate: { latitude: 21.0285, longitude: 105.8544 } },
  { name: 'TP. Hồ Chí Minh', coordinate: { latitude: 10.7769, longitude: 106.7009 } },
  { name: 'Cần Thơ', coordinate: { latitude: 10.033, longitude: 105.788 } },
];

export function MapScreen({ onNavigateToDeviceDetail }: MapScreenProps) {
  const insets = useSafeAreaInsets();
  const homeCategory = useAppSelector(state => state.devices.selectedCategory);
  const [category, setCategory] = useState<DeviceCategory | 'all'>(homeCategory);
  const [categories, setCategories] = useState<DeviceCategory[]>([]);
  const [categoryError, setCategoryError] = useState(false);
  const [categoryRetry, setCategoryRetry] = useState(0);

  // Vị trí dùng để truy vấn thiết bị (mặc định khởi tạo ở Hà Nội để luôn có thiết bị hiển thị ngay)
  const [queryPosition, setQueryPosition] = useState<HomeCoordinate>({
    latitude: 21.0285,
    longitude: 105.8544,
  });
  const [selectedCityName, setSelectedCityName] = useState<string>('Hà Nội');

  const [devices, setDevices] = useState<Device[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [deviceRetry, setDeviceRetry] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReload, setMapReload] = useState(0);

  const webView = useRef<WebView>(null);
  const messageId = useRef(0);

  // Lắng nghe vị trí GPS thực tế của thiết bị
  const location = useHomeLocation((coordinate) => {
    setQueryPosition(coordinate);
    setSelectedCityName('Vị trí của tôi');
  }, true);

  const source = useMemo(() => ({ html: createMapHtml(FAVI_MAP_API_KEY) }), []);
  const markers = useMemo(() => getMapDevices(devices), [devices]);
  const selected = devices.find(device => device._id === selectedId);

  // Lấy danh mục thiết bị từ API
  useEffect(() => {
    let active = true;
    setCategoryError(false);
    deviceService.getCategories()
      .then(data => { if (active) setCategories(data); })
      .catch(() => { if (active) setCategoryError(true); });
    return () => { active = false; };
  }, [categoryRetry]);

  // Lấy danh sách thiết bị lân cận vị trí đang chọn
  useEffect(() => {
    let active = true;
    setDevices([]);
    setSelectedId(null);
    setDeviceError(null);
    if (!queryPosition) { setLoadingDevices(false); return; }

    setLoadingDevices(true);
    deviceService.getNearbyDevices({
      ...queryPosition,
      radius: HOME_NEARBY_RADIUS_METERS,
      category,
    })
      .then(data => { if (active) setDevices(data); })
      .catch(() => { if (active) setDeviceError('Không thể tải danh sách thiết bị. Nhấn để thử lại.'); })
      .finally(() => { if (active) setLoadingDevices(false); });

    return () => { active = false; };
  }, [queryPosition, category, deviceRetry]);

  // Timeout dự phòng khi bản đồ không load được
  useEffect(() => {
    if (mapReady || mapError) return;
    const timeout = setTimeout(() => {
      setMapError('Bản đồ phản hồi chậm. Vui lòng kiểm tra mạng hoặc thử tải lại.');
    }, 20000);
    return () => clearTimeout(timeout);
  }, [mapReady, mapError, mapReload]);

  // Cập nhật vị trí và markers vào WebView
  useEffect(() => {
    if (!mapReady || mapError) return;
    const pos = location.position || queryPosition;
    webView.current?.postMessage(JSON.stringify({
      type: 'update',
      messageId: ++messageId.current,
      devices: markers,
      position: pos ? [pos.longitude, pos.latitude] : null,
    }));
  }, [mapReady, mapError, markers, location.position, queryPosition]);

  function handleMapMessage(event: WebViewMessageEvent) {
    const message = parseMapMessage(event.nativeEvent.data);
    if (message?.type === 'ready') setMapReady(true);
    if (message?.type === 'error') setMapError(message.message);
    if (message?.type === 'select' && markers.some(marker => marker.id === message.deviceId)) {
      setSelectedId(message.deviceId);
    }
  }

  function focusMyLocation() {
    const position = location.position;
    if (position && mapReady && !mapError) {
      setQueryPosition(position);
      setSelectedCityName('Vị trí của tôi');
      webView.current?.postMessage(JSON.stringify({
        type: 'focus',
        messageId: ++messageId.current,
        position: [position.longitude, position.latitude],
      }));
    }
    void location.refresh(true);
  }

  function handleSelectCity(loc: { name: string; coordinate: HomeCoordinate }) {
    setSelectedCityName(loc.name);
    setQueryPosition(loc.coordinate);
    if (mapReady && !mapError) {
      webView.current?.postMessage(JSON.stringify({
        type: 'focus',
        messageId: ++messageId.current,
        position: [loc.coordinate.longitude, loc.coordinate.latitude],
      }));
    }
  }

  function reloadMap() {
    setMapReady(false);
    setMapError(null);
    setMapReload(value => value + 1);
  }

  const rate = selected?.pricePerDay ?? selected?.dailyRate;
  const locationMessage = location.error || location.warning;
  const firstImage = selected?.images?.[0];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Thiết bị lân cận</Text>
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>{selectedCityName}</Text>
          </View>
        </View>
        <Text style={styles.body}>Bản đồ thiết bị trong bán kính 10 km</Text>
      </View>

      {/* Danh mục */}
      <CategoryBar
        categories={categories}
        selectedCategory={category}
        onSelectCategory={setCategory}
      />

      {categoryError ? (
        <TouchableOpacity style={styles.notice} onPress={() => setCategoryRetry(v => v + 1)}>
          <Text style={styles.error}>Không thể tải danh mục. Nhấn để thử lại.</Text>
        </TouchableOpacity>
      ) : null}

      {/* Thông báo GPS nếu có */}
      {locationMessage ? (
        <View style={styles.notice}>
          <Text style={styles.error}>{locationMessage}</Text>
          <View style={styles.row}>
            <TouchableOpacity onPress={() => void location.refresh(true)}>
              <Text style={styles.link}>Thử lại GPS</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => void Linking.openSettings().catch(() => setDeviceError('Không thể mở cài đặt.'))}>
              <Text style={styles.link}>Mở cài đặt</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Thanh chọn nhanh thành phố */}
      <View style={styles.cityBar}>
        <Text style={styles.cityLabel}>Khu vực:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cityList}>
          {POPULAR_LOCATIONS.map(loc => {
            const isSelected = selectedCityName === loc.name;
            return (
              <TouchableOpacity
                key={loc.name}
                style={[styles.cityChip, isSelected && styles.cityChipActive]}
                onPress={() => handleSelectCity(loc)}
              >
                <Text style={[styles.cityChipText, isSelected && styles.cityChipTextActive]}>
                  {loc.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Thanh trạng thái tìm kiếm */}
      <View style={styles.statusBar}>
        {loadingDevices || location.isLocating ? (
          <View style={styles.row}>
            <ActivityIndicator size="small" color={colors.light.primaryDark} />
            <Text style={styles.body}>
              {location.isLocating ? 'Đang xác định vị trí của bạn...' : 'Đang tải thiết bị...'}
            </Text>
          </View>
        ) : deviceError ? (
          <TouchableOpacity onPress={() => setDeviceRetry(v => v + 1)}>
            <Text style={styles.error}>{deviceError}</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.body}>
            {markers.length > 0
              ? `Tìm thấy ${markers.length} thiết bị quanh ${selectedCityName}`
              : `Không tìm thấy thiết bị nào trong bán kính 10 km quanh ${selectedCityName}.`}
          </Text>
        )}
      </View>

      {/* Khung bản đồ WebView */}
      <View style={styles.map}>
        {!mapError ? (
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
            onShouldStartLoadWithRequest={request => {
              if (request.url === 'about:blank' || request.url.startsWith('data:text/html')) return true;
              if (request.isTopFrame === false) return true;
              if (!request.url.startsWith('http://') && !request.url.startsWith('https://')) return true;
              // Cho phép tải tài nguyên bản đồ từ CDN và Tile Server
              if (
                request.url.includes('unpkg.com') ||
                request.url.includes('google.com') ||
                request.url.includes('openstreetmap') ||
                request.url.includes('fastviet.vn')
              ) {
                return true;
              }
              return false;
            }}
            onError={() => setMapError('Không thể tải WebView bản đồ. Vui lòng thử lại.')}
            onHttpError={() => setMapError('Không thể tải tài nguyên bản đồ. Kiểm tra kết nối mạng.')}
          />
        ) : null}

        {/* Lớp phủ Loading hoặc Báo lỗi */}
        {(!mapReady || mapError) ? (
          <View style={styles.overlay}>
            {mapError ? (
              <>
                <Text style={styles.error}>{mapError}</Text>
                <TouchableOpacity style={styles.button} onPress={reloadMap}>
                  <Text style={styles.buttonText}>Tải lại bản đồ</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <ActivityIndicator size="large" color={colors.light.primaryDark} />
                <Text style={styles.body}>Đang tải bản đồ...</Text>
              </>
            )}
          </View>
        ) : null}

        {/* Nút định vị vị trí của tôi */}
        <TouchableOpacity
          style={styles.locate}
          onPress={focusMyLocation}
          accessibilityRole="button"
          accessibilityLabel="Vị trí của tôi"
        >
          <Ionicons name="locate" size={24} color={colors.light.primaryDark} />
        </TouchableOpacity>
      </View>

      {/* Panel thông tin thiết bị được chọn trên bản đồ */}
      {selected ? (
        <View style={styles.devicePanel}>
          <View style={styles.deviceRow}>
            {firstImage ? (
              <Image source={{ uri: firstImage }} style={styles.deviceThumb} />
            ) : (
              <View style={[styles.deviceThumb, styles.deviceThumbPlaceholder]}>
                <Ionicons name="hardware-chip-outline" size={24} color={colors.light.textSecondary} />
              </View>
            )}
            <View style={styles.deviceInfo}>
              <View style={styles.rowBetween}>
                <Text style={styles.deviceName} numberOfLines={1}>
                  {selected.name || selected.title}
                </Text>
                <TouchableOpacity onPress={() => setSelectedId(null)} accessibilityLabel="Đóng">
                  <Ionicons name="close" size={20} color={colors.light.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.body} numberOfLines={1}>
                {selected.category} · {selected.location?.addressText || selected.addressText || 'Chưa có địa chỉ'}
              </Text>
              <Text style={styles.priceText}>
                {typeof rate === 'number' && Number.isFinite(rate)
                  ? `${rate.toLocaleString('vi-VN')} đ/ngày`
                  : 'Giá thỏa thuận'}
                {typeof selected.distanceMeters === 'number' && Number.isFinite(selected.distanceMeters)
                  ? ` · ${(selected.distanceMeters / 1000).toFixed(1)} km`
                  : ''}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={() => onNavigateToDeviceDetail(selected._id)}
          >
            <Text style={styles.buttonText}>Xem chi tiết thiết bị</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.light.background },
  header: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, gap: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 22, fontWeight: '800', color: colors.light.textPrimary },
  badgeContainer: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#0284C7',
    fontSize: 12,
    fontWeight: '700',
  },
  body: { fontSize: 13, lineHeight: 18, color: colors.light.textSecondary },
  notice: { paddingHorizontal: 16, paddingBottom: 6, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  error: { color: colors.light.error, fontSize: 13, lineHeight: 18 },
  link: { color: colors.light.primaryDark, fontWeight: '700', fontSize: 13 },
  cityBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
  },
  cityLabel: { fontSize: 12, fontWeight: '700', color: colors.light.textSecondary },
  cityList: { gap: 8 },
  cityChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: colors.light.surface,
    borderWidth: 1,
    borderColor: colors.light.borderDefault,
  },
  cityChipActive: {
    backgroundColor: colors.light.primaryDark,
    borderColor: colors.light.primaryDark,
  },
  cityChipText: { fontSize: 12, color: colors.light.textPrimary, fontWeight: '600' },
  cityChipTextActive: { color: colors.light.white, fontWeight: '700' },
  statusBar: { paddingHorizontal: 16, paddingBottom: 6 },
  map: { flex: 1, overflow: 'hidden' },
  webView: { flex: 1, backgroundColor: colors.light.background },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.light.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 20,
  },
  locate: {
    position: 'absolute',
    right: 16,
    bottom: 20,
    padding: 12,
    borderRadius: 26,
    backgroundColor: colors.light.surface,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  devicePanel: {
    padding: 14,
    gap: 12,
    backgroundColor: colors.light.surface,
    borderTopWidth: 1,
    borderTopColor: colors.light.borderDefault,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  deviceRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  deviceThumb: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#E2E8F0' },
  deviceThumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  deviceInfo: { flex: 1, gap: 4 },
  deviceName: { fontSize: 15, fontWeight: '700', color: colors.light.textPrimary },
  priceText: { color: colors.light.primaryDark, fontWeight: '700', fontSize: 13 },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: colors.light.primaryDark,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: { color: colors.light.white, fontWeight: '700', fontSize: 14 },
});
