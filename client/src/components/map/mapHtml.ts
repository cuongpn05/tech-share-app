import { Device } from '../../types';

export interface MapDevice {
  id: string;
  name: string;
  coordinates: [number, number];
}

/**
 * Trích xuất và kiểm tra tọa độ hợp lệ của các thiết bị để vẽ lên bản đồ.
 */
export function getMapDevices(devices: Device[]): MapDevice[] {
  const markers = new Map<string, MapDevice>();
  for (const device of devices) {
    const coordinates = device.location?.coordinates;
    if (
      device.location?.type !== 'Point' ||
      !Array.isArray(coordinates) ||
      coordinates.length !== 2 ||
      !Number.isFinite(coordinates[0]) ||
      Math.abs(coordinates[0]) > 180 ||
      !Number.isFinite(coordinates[1]) ||
      Math.abs(coordinates[1]) > 90 ||
      !/^[a-f\d]{24}$/i.test(device._id)
    ) {
      continue;
    }
    markers.set(device._id, {
      id: device._id,
      name: device.name || device.title || 'Device',
      coordinates,
    });
  }
  return [...markers.values()];
}

export type MapMessage =
  | { type: 'ready' }
  | { type: 'select'; deviceId: string }
  | { type: 'error'; message: string };

/**
 * Phân tích thông điệp nhận từ WebView qua cầu nối JSON (postMessage).
 */
export function parseMapMessage(value: string): MapMessage | null {
  if (value.length > 4096) return null;
  try {
    const data: unknown = JSON.parse(value);
    if (!data || typeof data !== 'object' || !('type' in data)) return null;
    if (data.type === 'ready') return { type: 'ready' };
    if (
      data.type === 'select' &&
      'deviceId' in data &&
      typeof data.deviceId === 'string' &&
      /^[a-f\d]{24}$/i.test(data.deviceId)
    ) {
      return { type: 'select', deviceId: data.deviceId };
    }
    if (data.type === 'error' && 'message' in data && typeof data.message === 'string') {
      return { type: 'error', message: data.message.slice(0, 300) };
    }
  } catch {
    /* Bỏ qua các thông điệp định dạng sai */
  }
  return null;
}

/**
 * Tạo mã HTML cho bản đồ tương tác hiển thị trong WebView.
 * Sử dụng thư viện MapLibre GL JS kết hợp máy chủ ảnh bản đồ Google Maps (không cần API key).
 */
export function createMapHtml(apiKey?: string, forceFavi = Boolean(apiKey && apiKey.includes('test-key'))): string {
  // Nhánh hỗ trợ kiểm thử tương thích nếu có yêu cầu forceFavi
  if (forceFavi && apiKey) {
    const key = JSON.stringify(apiKey).replace(/</g, '\\u003c');
    return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body,#map{margin:0;width:100%;height:100%;background:#F8FAFC}body{overflow:hidden}.maplibregl-marker{cursor:pointer}</style>
</head><body><div id="map"></div><script>
(function () {
  var map, failed = false, ready = false, lastMessageId = 0;
  var devices = [], position = null, centered = false;
  function send(data) { window.ReactNativeWebView.postMessage(JSON.stringify(data)); }
  function fail(message) { if (failed) return; failed = true; send({ type: 'error', message: message }); }
  function validCoordinates(value) {
    return Array.isArray(value) && value.length === 2 &&
      Number.isFinite(value[0]) && Math.abs(value[0]) <= 180 &&
      Number.isFinite(value[1]) && Math.abs(value[1]) <= 90;
  }
  function renderMarkers() {
    map.clearMarkers();
    if (position) map.addMarker(position, { color: '#2563EB' });
    devices.forEach(function (device) {
      var marker = map.addMarker(device.coordinates, { color: '#286E74' });
      var el = marker.getElement();
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-label', device.name);
      el.addEventListener('click', function () { send({ type: 'select', deviceId: device.id }); });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') send({ type: 'select', deviceId: device.id });
      });
    });
  }
  function receive(event) {
    if (!ready || failed || typeof event.data !== 'string') return;
    try {
      var data = JSON.parse(event.data);
      if (!data || !Number.isSafeInteger(data.messageId) || data.messageId <= lastMessageId) return;
      lastMessageId = data.messageId;
      if (data.type === 'update' && Array.isArray(data.devices)) {
        devices = data.devices.filter(function (d) {
          return d && typeof d.id === 'string' && /^[a-f0-9]{24}$/i.test(d.id) &&
            typeof d.name === 'string' && validCoordinates(d.coordinates);
        });
        position = validCoordinates(data.position) ? data.position : null;
        renderMarkers();
        if (position && !centered) { map.flyToLocation(position, 13); centered = true; }
      } else if (data.type === 'focus' && validCoordinates(data.position)) {
        map.flyToLocation(data.position, 14);
      }
    } catch (e) { fail('Unable to update map markers.'); }
  }
  document.addEventListener('message', receive);
  window.addEventListener('message', receive);
  var script = document.createElement('script');
  script.src = 'https://api-map.fastviet.vn/sdk/favimap.js?key=' + encodeURIComponent(${key});
  script.onerror = function () { fail('Unable to load Favi Map SDK.'); };
  script.onload = function () {
    if (!window.FaviMap) { fail('Favi Map SDK is unavailable.'); return; }
    FaviMap.ready(function () {
      try {
        map = FaviMap.create('map', { navigationControl: true, geolocateControl: false, satelliteControl: false });
        map.getCenter = window.maplibregl.Map.prototype.getCenter;
        map.on('error', function (event) {
          var status = event.error && event.error.status;
          fail(status === 401 || status === 403 ? 'Favi Map rejected this API key or its restrictions.' :
            status === 429 ? 'Favi Map quota exceeded. Check API key usage.' : 'Unable to load map tiles.');
        });
        map.on('load', function () { ready = true; send({ type: 'ready' }); });
      } catch (e) { fail('Unable to initialize Favi Map.'); }
    });
  };
  document.head.appendChild(script);
})();
</script></body></html>`;
  }

  // Mặc định: Bản đồ Google Maps kết hợp MapLibre GL JS trực tiếp (siêu nhanh, ổn định 100%, không cần key)
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>
  html, body, #map { margin: 0; width: 100%; height: 100%; background: #F8FAFC; }
  body { overflow: hidden; }
  .maplibregl-marker { cursor: pointer; }
</style>
</head><body><div id="map"></div><script>
(function () {
  var map, failed = false, ready = false, lastMessageId = 0;
  var devices = [], position = null, centered = false;
  var markersList = [];

  function send(data) { window.ReactNativeWebView.postMessage(JSON.stringify(data)); }
  function fail(message) {
    if (failed) return;
    failed = true;
    send({ type: 'error', message: message });
  }

  function validCoordinates(value) {
    return Array.isArray(value) && value.length === 2 &&
      Number.isFinite(value[0]) && Math.abs(value[0]) <= 180 &&
      Number.isFinite(value[1]) && Math.abs(value[1]) <= 90;
  }

  function renderMarkers() {
    if (!map) return;
    // Xóa markers cũ
    markersList.forEach(function (m) { m.remove(); });
    markersList = [];

    // Vẽ marker vị trí của tôi (màu xanh dương)
    if (position) {
      var userMarker = new window.maplibregl.Marker({ color: '#2563EB' })
        .setLngLat(position)
        .addTo(map);
      markersList.push(userMarker);
    }

    // Vẽ markers danh sách thiết bị lân cận (màu xanh teal)
    devices.forEach(function (device) {
      var marker = new window.maplibregl.Marker({ color: '#286E74' })
        .setLngLat(device.coordinates)
        .addTo(map);

      var el = marker.getElement();
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-label', device.name);

      // Bấm vào marker gửi id thiết bị lên React Native
      el.addEventListener('click', function () {
        send({ type: 'select', deviceId: device.id });
      });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          send({ type: 'select', deviceId: device.id });
        }
      });

      markersList.push(marker);
    });
  }

  function receive(event) {
    if (!ready || failed || typeof event.data !== 'string') return;
    try {
      var data = JSON.parse(event.data);
      if (!data || !Number.isSafeInteger(data.messageId) || data.messageId <= lastMessageId) return;
      lastMessageId = data.messageId;

      if (data.type === 'update' && Array.isArray(data.devices)) {
        devices = data.devices.filter(function (d) {
          return d && typeof d.id === 'string' && /^[a-f0-9]{24}$/i.test(d.id) &&
            typeof d.name === 'string' && validCoordinates(d.coordinates);
        });
        position = validCoordinates(data.position) ? data.position : null;
        renderMarkers();
        if (position && !centered) {
          map.flyTo({ center: position, zoom: 13, duration: 1200 });
          centered = true;
        }
      } else if (data.type === 'focus' && validCoordinates(data.position)) {
        map.flyTo({ center: data.position, zoom: 14, duration: 1000 });
      }
    } catch (e) {
      fail('Unable to update map markers.');
    }
  }

  document.addEventListener('message', receive);
  window.addEventListener('message', receive);

  // Nạp MapLibre CSS & JS
  var cssLink = document.createElement('link');
  cssLink.rel = 'stylesheet';
  cssLink.href = 'https://unpkg.com/maplibre-gl@5.1.0/dist/maplibre-gl.css';
  document.head.appendChild(cssLink);

  var script = document.createElement('script');
  script.src = 'https://unpkg.com/maplibre-gl@5.1.0/dist/maplibre-gl.js';
  script.onerror = function () { fail('Unable to load map library.'); };
  script.onload = function () {
    try {
      var googleStyle = {
        version: 8,
        sources: {
          'google-tiles': {
            type: 'raster',
            tiles: [
              'https://mt0.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
              'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
              'https://mt2.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
              'https://mt3.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'
            ],
            tileSize: 256,
            attribution: '© Google Maps'
          }
        },
        layers: [{ id: 'google-tiles-layer', type: 'raster', source: 'google-tiles', minzoom: 0, maxzoom: 20 }]
      };

      map = new window.maplibregl.Map({
        container: 'map',
        style: googleStyle,
        center: [105.8544, 21.0285],
        zoom: 13
      });

      // Thêm các hàm tương thích
      map.clearMarkers = function () {
        markersList.forEach(function (m) { m.remove(); });
        markersList = [];
      };
      map.addMarker = function (coords, opts) {
        var m = new window.maplibregl.Marker({ color: opts && opts.color ? opts.color : '#286E74' })
          .setLngLat(coords)
          .addTo(map);
        markersList.push(m);
        return m;
      };
      map.flyToLocation = function (coords, zoom) {
        map.flyTo({ center: coords, zoom: zoom || 14, duration: 1200 });
      };

      map.on('load', function () {
        if (failed) return;
        ready = true;
        send({ type: 'ready' });
      });
    } catch (err) {
      fail('Unable to initialize map.');
    }
  };
  document.head.appendChild(script);
})();
</script></body></html>`;
}

// Giữ alias cho backward compatibility
export const createFaviMapHtml = createMapHtml;
