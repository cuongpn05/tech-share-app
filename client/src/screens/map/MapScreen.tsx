import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryBar } from '../../components/home/CategoryBar';
import { createFaviMapHtml, getMapDevices, parseMapMessage } from '../../components/map/mapHtml';
import { FAVI_MAP_API_KEY } from '../../config/faviMap';
import { HomeCoordinate, useHomeLocation } from '../../hooks/useHomeLocation';
import { deviceService, HOME_NEARBY_RADIUS_METERS } from '../../services/deviceService';
import { useAppSelector } from '../../store';
import { Device, DeviceCategory } from '../../types';
import { colors } from '../../theme/colors';

interface MapScreenProps {
  onNavigateToDeviceDetail: (deviceId: string) => void;
}

export function MapScreen({ onNavigateToDeviceDetail }: MapScreenProps) {
  const insets = useSafeAreaInsets();
  const homeCategory = useAppSelector(state => state.devices.selectedCategory);
  const [category, setCategory] = useState<DeviceCategory | 'all'>(homeCategory);
  const [categories, setCategories] = useState<DeviceCategory[]>([]);
  const [categoryError, setCategoryError] = useState(false);
  const [categoryRetry, setCategoryRetry] = useState(0);
  const [queryPosition, setQueryPosition] = useState<HomeCoordinate | null>(null);
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
  const location = useHomeLocation(coordinate => setQueryPosition(coordinate), !!FAVI_MAP_API_KEY);
  const source = useMemo(() => ({ html: createFaviMapHtml(FAVI_MAP_API_KEY) }), []);
  const markers = useMemo(() => getMapDevices(devices), [devices]);
  const selected = devices.find(device => device._id === selectedId);

  useEffect(() => {
    if (!FAVI_MAP_API_KEY) return;
    let active = true;
    setCategoryError(false);
    deviceService.getCategories().then(data => { if (active) setCategories(data); })
      .catch(() => { if (active) setCategoryError(true); });
    return () => { active = false; };
  }, [categoryRetry]);

  useEffect(() => {
    let active = true;
    setDevices([]);
    setSelectedId(null);
    setDeviceError(null);
    if (!queryPosition || location.error) { setLoadingDevices(false); return; }
    setLoadingDevices(true);
    deviceService.getNearbyDevices({ ...queryPosition, radius: HOME_NEARBY_RADIUS_METERS,
      category }).then(data => { if (active) setDevices(data); })
      .catch(() => { if (active) setDeviceError('Unable to load nearby devices. Please try again.'); })
      .finally(() => { if (active) setLoadingDevices(false); });
    return () => { active = false; };
  }, [queryPosition, category, deviceRetry, location.error]);

  useEffect(() => {
    if (mapReady || mapError || !FAVI_MAP_API_KEY) return;
    const timeout = setTimeout(() => setMapError('Map timed out. Check your connection and API key.'), 30000);
    return () => clearTimeout(timeout);
  }, [mapReady, mapError, mapReload]);

  useEffect(() => {
    if (!mapReady || mapError) return;
    const position = location.position;
    webView.current?.postMessage(JSON.stringify({ type: 'update', messageId: ++messageId.current,
      devices: markers, position: position ? [position.longitude, position.latitude] : null }));
  }, [mapReady, mapError, markers, location.position]);

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
      webView.current?.postMessage(JSON.stringify({ type: 'focus', messageId: ++messageId.current,
        position: [position.longitude, position.latitude] }));
    }
    void location.refresh(true);
  }

  function reloadMap() {
    setMapReady(false);
    setMapError(null);
    setMapReload(value => value + 1);
  }

  if (!FAVI_MAP_API_KEY) return (
    <View style={[styles.center, { paddingTop: insets.top }]}>
      <Ionicons name="map-outline" size={40} color={colors.light.primaryDark} />
      <Text style={styles.title}>Favi Map key is missing</Text>
      <Text style={styles.body}>Set EXPO_PUBLIC_FAVI_MAP_API_KEY in client/.env, then restart Expo.</Text>
    </View>
  );

  const rate = selected?.pricePerDay ?? selected?.dailyRate;
  const locationMessage = location.error || location.warning;
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Nearby Devices</Text>
        <Text style={styles.body}>Devices within 10 km of your location</Text>
      </View>
      <CategoryBar categories={categories} selectedCategory={category} onSelectCategory={setCategory} />
      {categoryError ? <TouchableOpacity style={styles.notice} onPress={() => setCategoryRetry(value => value + 1)}>
        <Text style={styles.error}>Unable to load categories. Tap to retry.</Text>
      </TouchableOpacity> : null}
      {locationMessage ? <View style={styles.notice}>
        <Text style={styles.error}>{locationMessage}</Text>
        <View style={styles.row}>
          <TouchableOpacity onPress={() => void location.refresh(true)}><Text style={styles.link}>Retry GPS</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => void Linking.openSettings().catch(() => setDeviceError('Unable to open settings.'))}>
            <Text style={styles.link}>Open settings</Text>
          </TouchableOpacity>
        </View>
      </View> : null}
      <View style={styles.notice}>
        {loadingDevices || location.isLocating ? <View style={styles.row}>
          <ActivityIndicator size="small" color={colors.light.primaryDark} />
          <Text style={styles.body}>{location.isLocating ? 'Getting your location...' : 'Loading devices...'}</Text>
        </View> : deviceError ? <TouchableOpacity onPress={() => setDeviceRetry(value => value + 1)}>
          <Text style={styles.error}>{deviceError} Tap to retry.</Text>
        </TouchableOpacity> : location.position && !location.error ? <Text style={styles.body}>
          {markers.length ? `${markers.length} devices on map` : 'No devices with valid coordinates found within 10 km.'}
          {location.source !== 'CURRENT' ? ' Using last known location.' : ''}
        </Text> : null}
      </View>
      <View style={styles.map}>
        {!mapError ? <WebView key={mapReload} ref={webView} source={source} style={styles.webView}
          originWhitelist={['*']} javaScriptEnabled domStorageEnabled mixedContentMode="never"
          allowFileAccess={false} javaScriptCanOpenWindowsAutomatically={false} setSupportMultipleWindows={false}
          geolocationEnabled={false} onMessage={handleMapMessage}
          onShouldStartLoadWithRequest={request => request.url === 'about:blank' || request.url.startsWith('data:text/html')}
          onError={() => setMapError('Unable to load the map WebView. Please try again.')}
          onHttpError={() => setMapError('Map request failed. Check your connection and API key.')}
          onRenderProcessGone={() => setMapError('Map renderer stopped. Please reload the map.')}
          onContentProcessDidTerminate={() => setMapError('Map renderer stopped. Please reload the map.')} /> : null}
        {!mapReady || mapError ? <View style={styles.overlay}>
          {mapError ? <><Text style={styles.error}>{mapError}</Text>
            <TouchableOpacity style={styles.button} onPress={reloadMap}><Text style={styles.buttonText}>Reload map</Text></TouchableOpacity>
          </> : <><ActivityIndicator color={colors.light.primaryDark} /><Text style={styles.body}>Loading Favi Map...</Text></>}
        </View> : null}
        <TouchableOpacity style={styles.locate} onPress={focusMyLocation}
          accessibilityRole="button" accessibilityLabel="My location">
          <Ionicons name="locate" size={24} color={colors.light.primaryDark} />
        </TouchableOpacity>
      </View>
      {selected ? <View style={styles.devicePanel}>
        <View style={styles.row}>
          <Text style={styles.deviceName} numberOfLines={2}>{selected.name || selected.title}</Text>
          <TouchableOpacity onPress={() => setSelectedId(null)} accessibilityLabel="Close selected device">
            <Ionicons name="close" size={20} color={colors.light.textSecondary} />
          </TouchableOpacity>
        </View>
        <Text style={styles.body} numberOfLines={1}>{selected.category} · {selected.location?.addressText || selected.addressText || 'Address unavailable'}</Text>
        <Text style={styles.link}>{typeof rate === 'number' && Number.isFinite(rate) ? `${rate.toLocaleString('vi-VN')} đ/ngày` : 'Price unavailable'}
          {typeof selected.distanceMeters === 'number' && Number.isFinite(selected.distanceMeters) ? ` · ${(selected.distanceMeters / 1000).toFixed(1)} km` : ''}</Text>
        <TouchableOpacity style={styles.button} onPress={() => onNavigateToDeviceDetail(selected._id)}>
          <Text style={styles.buttonText}>View device</Text>
        </TouchableOpacity>
      </View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.light.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: colors.light.background },
  header: { paddingHorizontal: 16, paddingTop: 12, gap: 6 },
  title: { fontSize: 22, fontWeight: '800', color: colors.light.textPrimary },
  body: { fontSize: 13, lineHeight: 19, color: colors.light.textSecondary, flexShrink: 1 },
  notice: { paddingHorizontal: 16, paddingBottom: 8, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  error: { color: colors.light.error, fontSize: 13, lineHeight: 19 },
  link: { color: colors.light.primaryDark, fontWeight: '700', fontSize: 13 },
  map: { flex: 1, overflow: 'hidden' },
  webView: { flex: 1, backgroundColor: colors.light.background },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.light.background, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  locate: { position: 'absolute', right: 14, bottom: 44, padding: 12, borderRadius: 26, backgroundColor: colors.light.surface, elevation: 3 },
  devicePanel: { padding: 14, gap: 8, backgroundColor: colors.light.surface, borderTopWidth: 1, borderTopColor: colors.light.borderDefault },
  deviceName: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.light.textPrimary },
  button: { paddingVertical: 11, paddingHorizontal: 16, backgroundColor: colors.light.primaryDark, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: colors.light.white, fontWeight: '700' },
});
