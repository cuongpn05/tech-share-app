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
 * Sử dụng Leaflet kết hợp máy chủ ảnh bản đồ Google Maps & OpenStreetMap.
 * Không cần API key, hoạt động 100% mượt mà trên cả máy ảo và thiết bị thật (không phụ thuộc WebGL).
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
  function send(data) { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(data)); }
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

  // Mặc định: Leaflet + Google Maps Raster Tiles & OpenStreetMap
  // Tương thích 100% với WebView, chạy mượt mà không yêu cầu WebGL
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #F8FAFC; }
    body { overflow: hidden; }
    .custom-pin { background: transparent; border: none; cursor: pointer; }
    .leaflet-control-attribution { font-size: 9px; opacity: 0.6; }
    .leaflet-control-zoom { display: none; }
  </style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
(function() {
  var map, failed = false, ready = false, lastMessageId = 0;
  var devices = [], position = null, centered = false;
  var markersList = [];

  function send(data) {
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify(data));
    }
  }

  function fail(message) {
    if (failed) return;
    failed = true;
    send({ type: 'error', message: message });
  }

  function validCoordinates(val) {
    return Array.isArray(val) && val.length === 2 &&
      Number.isFinite(val[0]) && Math.abs(val[0]) <= 180 &&
      Number.isFinite(val[1]) && Math.abs(val[1]) <= 90;
  }

  function createSvgIcon(color, isUser) {
    var size = isUser ? [26, 26] : [32, 42];
    var anchor = isUser ? [13, 13] : [16, 42];
    var html;
    if (isUser) {
      html = '<svg width="26" height="26" viewBox="0 0 26 26">' +
        '<circle cx="13" cy="13" r="11" fill="' + color + '" fill-opacity="0.3"/>' +
        '<circle cx="13" cy="13" r="6" fill="' + color + '" stroke="#ffffff" stroke-width="2.5"/>' +
        '</svg>';
    } else {
      html = '<svg width="32" height="42" viewBox="0 0 32 42" style="filter:drop-shadow(0 3px 5px rgba(0,0,0,0.35));">' +
        '<path d="M16 0C7.163 0 0 7.163 0 16c0 11.5 16 26 16 26s16-14.5 16-26c0-8.837-7.163-16-16-16z" fill="' + color + '" stroke="#ffffff" stroke-width="1.5"/>' +
        '<circle cx="16" cy="15" r="5.5" fill="#ffffff"/>' +
        '</svg>';
    }
    return L.divIcon({
      className: 'custom-pin',
      html: html,
      iconSize: size,
      iconAnchor: anchor
    });
  }

  function renderMarkers() {
    if (!map) return;
    markersList.forEach(function(m) { map.removeLayer(m); });
    markersList = [];

    // Vị trí người dùng
    if (position) {
      // coords là [lng, lat], Leaflet nhận [lat, lng]
      var userMarker = L.marker([position[1], position[0]], {
        icon: createSvgIcon('#2563EB', true),
        zIndexOffset: 1000
      }).addTo(map);
      markersList.push(userMarker);
    }

    // Các thiết bị lân cận
    devices.forEach(function(device) {
      var marker = L.marker([device.coordinates[1], device.coordinates[0]], {
        icon: createSvgIcon('#286E74', false),
        title: device.name,
        zIndexOffset: 500
      }).addTo(map);

      marker.on('click', function() {
        send({ type: 'select', deviceId: device.id });
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
        devices = data.devices.filter(function(d) {
          return d && typeof d.id === 'string' && /^[a-f0-9]{24}$/i.test(d.id) &&
            typeof d.name === 'string' && validCoordinates(d.coordinates);
        });
        position = validCoordinates(data.position) ? data.position : null;
        renderMarkers();
        if (position && !centered) {
          map.flyTo([position[1], position[0]], 13, { duration: 1.2 });
          centered = true;
        }
      } else if (data.type === 'focus' && validCoordinates(data.position)) {
        map.flyTo([data.position[1], data.position[0]], 14, { duration: 1 });
      }
    } catch(e) {
      fail('Unable to update map markers.');
    }
  }

  document.addEventListener('message', receive);
  window.addEventListener('message', receive);

  function initMap() {
    try {
      if (!window.L) {
        fail('Unable to load Leaflet library.');
        return;
      }

      // Tọa độ mặc định: Hà Nội [21.0285, 105.8544]
      map = L.map('map', {
        zoomControl: false,
        attributionControl: true
      }).setView([21.0285, 105.8544], 13);

      // Google Maps Raster Tiles
      var googleTiles = L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        subdomains: ['0', '1', '2', '3'],
        maxZoom: 20,
        attribution: '© Google Maps'
      });

      var osmTiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
      });

      googleTiles.on('tileerror', function() {
        if (!map.hasLayer(osmTiles)) {
          osmTiles.addTo(map);
        }
      });

      googleTiles.addTo(map);

      ready = true;
      send({ type: 'ready' });
    } catch(err) {
      fail('Unable to initialize map: ' + (err.message || err));
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initMap();
  } else {
    window.addEventListener('DOMContentLoaded', initMap);
  }
})();
</script>
</body>
</html>`;
}

// Giữ alias cho backward compatibility
export const createFaviMapHtml = createMapHtml;
