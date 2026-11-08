import { Device } from '../../types';
import { MapOwner } from '../../services/userService';

export interface MapDevice {
  id: string;
  name: string;
  price?: number;
  category?: string;
  coordinates: [number, number]; // [longitude, latitude]
}

export interface MapOwnerMarker {
  id: string;
  name: string;
  count: number;
  coordinates: [number, number]; // [longitude, latitude]
}

/**
 * Trích xuất các ghim Chủ sở hữu (Owner) hiển thị trên bản đồ.
 */
export function getMapOwnersMarkers(owners: MapOwner[]): MapOwnerMarker[] {
  const markers: MapOwnerMarker[] = [];
  for (const owner of owners) {
    const coords = owner.coordinates;
    const targetId = owner.id || owner._id;
    if (
      !Array.isArray(coords) ||
      coords.length !== 2 ||
      !Number.isFinite(coords[0]) ||
      !Number.isFinite(coords[1]) ||
      Math.abs(coords[0]) > 180 ||
      Math.abs(coords[1]) > 90 ||
      !/^[a-f\d]{24}$/i.test(targetId)
    ) {
      continue;
    }
    markers.push({
      id: targetId,
      name: owner.name || 'Chủ sở hữu',
      count: owner.deviceCount || (owner.devices?.length ?? 0),
      coordinates: [coords[0], coords[1]],
    });
  }
  return markers;
}

/**
 * Trích xuất và kiểm tra tọa độ hợp lệ của các thiết bị để vẽ lên bản đồ (tương thích ngược).
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
    const rate = device.pricePerDay ?? device.dailyRate;
    markers.set(device._id, {
      id: device._id,
      name: device.name || device.title || 'Thiết bị',
      category: device.category,
      price: typeof rate === 'number' && Number.isFinite(rate) ? rate : undefined,
      coordinates: [coordinates[0], coordinates[1]],
    });
  }
  return [...markers.values()];
}

export type MapMessage =
  | { type: 'ready' }
  | { type: 'select'; id: string; deviceId?: string }
  | { type: 'error'; message: string };

/**
 * Phân tích thông điệp nhận từ WebView qua cầu nối JSON (postMessage).
 */
export function parseMapMessage(value: string): MapMessage | null {
  if (typeof value !== 'string' || value.length > 4096) return null;
  try {
    const data: unknown = JSON.parse(value);
    if (!data || typeof data !== 'object' || !('type' in data)) return null;
    if (data.type === 'ready') return { type: 'ready' };
    if (data.type === 'select') {
      const targetId = (data as any).id || (data as any).deviceId || '';
      if (typeof targetId === 'string' && (/^[a-f\d]{24}$/i.test(targetId) || targetId === '')) {
        return { type: 'select', id: targetId, deviceId: targetId };
      }
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
 * Tạo mã HTML cho bản đồ Google Maps hiển thị trong WebView.
 * Hiển thị vị trí các Chủ sở hữu (Owners) kèm số lượng thiết bị, hỗ trợ lọc theo danh mục.
 */
export function createGoogleMapHtml(): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css" />
  <style>
    * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #E5E3DF; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    
    /* Vị trí của người dùng - Điểm xanh đập nhịp kiểu Google Maps */
    .user-marker {
      position: relative;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .user-dot {
      width: 14px;
      height: 14px;
      background: #1A73E8;
      border: 2.5px solid #FFFFFF;
      border-radius: 50%;
      box-shadow: 0 1px 4px rgba(0,0,0,0.4);
      z-index: 2;
    }
    .user-pulse {
      position: absolute;
      width: 34px;
      height: 34px;
      background: rgba(26, 115, 232, 0.28);
      border-radius: 50%;
      animation: userPulse 2s infinite ease-out;
      z-index: 1;
    }
    @keyframes userPulse {
      0% { transform: scale(0.4); opacity: 1; }
      100% { transform: scale(1.6); opacity: 0; }
    }

    /* Ghim Chủ sở hữu (Owner Pin) */
    .owner-pin-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      transform-origin: bottom center;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .owner-pin-wrap:hover, .owner-pin-wrap.selected {
      transform: scale(1.22);
    }
    .owner-badge-pill {
      background: #286E74;
      color: #FFFFFF;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 12px;
      white-space: nowrap;
      box-shadow: 0 2px 6px rgba(0,0,0,0.25);
      border: 1.5px solid rgba(255,255,255,0.95);
      margin-bottom: -4px;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 3px;
    }
    .owner-pin-wrap.selected .owner-badge-pill {
      background: #E07A5F;
    }
    .owner-pin-icon svg {
      filter: drop-shadow(0 3px 5px rgba(0,0,0,0.32));
    }
    .owner-name-label {
      background: rgba(255, 255, 255, 0.95);
      color: #1E293B;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 6px;
      white-space: nowrap;
      max-width: 100px;
      overflow: hidden;
      text-overflow: ellipsis;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      margin-top: 1px;
      border: 1px solid #E2E8F0;
    }
    .owner-pin-wrap.selected .owner-name-label {
      background: #E07A5F;
      color: #FFFFFF;
      border-color: #E07A5F;
    }

    /* Nút chuyển chế độ bản đồ (Bản đồ / Vệ tinh) */
    .layer-toggle {
      position: absolute;
      top: 12px;
      left: 12px;
      z-index: 999;
      background: #FFFFFF;
      border-radius: 8px;
      display: flex;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      overflow: hidden;
      border: 1px solid #D1D5DB;
    }
    .layer-btn {
      border: none;
      background: #FFFFFF;
      padding: 7px 12px;
      font-size: 12px;
      font-weight: 600;
      color: #4B5563;
      cursor: pointer;
      outline: none;
      transition: all 0.15s;
    }
    .layer-btn.active {
      background: #286E74;
      color: #FFFFFF;
    }

    /* Nhãn hiệu Google Maps */
    .google-badge {
      position: absolute;
      bottom: 8px;
      left: 10px;
      z-index: 999;
      background: rgba(255, 255, 255, 0.92);
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 700;
      color: #3C4043;
      box-shadow: 0 1px 3px rgba(0,0,0,0.18);
      pointer-events: none;
      user-select: none;
      display: flex;
      align-items: center;
      gap: 3px;
    }
    .g-blue { color: #4285F4; }
    .g-red { color: #EA4335; }
    .g-yellow { color: #FBBC05; }
    .g-green { color: #34A853; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="layer-toggle">
    <button id="btn-road" class="layer-btn active" onclick="switchLayer('road')">Bản đồ</button>
    <button id="btn-sat" class="layer-btn" onclick="switchLayer('sat')">Vệ tinh</button>
  </div>
  <div class="google-badge">
    <span class="g-blue">G</span><span class="g-red">o</span><span class="g-yellow">o</span><span class="g-blue">g</span><span class="g-green">l</span><span class="g-red">e</span> Maps
  </div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js" onerror="this.onerror=null;this.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';"></script>
  <script>
    (function () {
      var map, roadLayer, satLayer, currentLayer = 'road';
      var userMarker = null;
      var markersMap = {};
      var failed = false, ready = false, lastMessageId = 0;
      var items = [], position = null, centered = false, selectedId = null;

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

      function escapeHtml(text) {
        return (text || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      }

      function toLatLng(coords) {
        if (!coords || !Array.isArray(coords) || coords.length < 2) return null;
        var c0 = Number(coords[0]);
        var c1 = Number(coords[1]);
        if (!isFinite(c0) || !isFinite(c1)) return null;
        if (Math.abs(c0) > 90 && Math.abs(c1) <= 90) return [c1, c0];
        if (Math.abs(c1) > 90 && Math.abs(c0) <= 90) return [c0, c1];
        return [c1, c0];
      }

      function validCoordinates(coords) {
        return Array.isArray(coords) && coords.length === 2 &&
          isFinite(coords[0]) && Math.abs(coords[0]) <= 180 &&
          isFinite(coords[1]) && Math.abs(coords[1]) <= 90;
      }

      window.switchLayer = function (type) {
        if (type === currentLayer || !map) return;
        if (type === 'sat') {
          map.removeLayer(roadLayer);
          map.addLayer(satLayer);
          document.getElementById('btn-sat').className = 'layer-btn active';
          document.getElementById('btn-road').className = 'layer-btn';
          currentLayer = 'sat';
        } else {
          map.removeLayer(satLayer);
          map.addLayer(roadLayer);
          document.getElementById('btn-road').className = 'layer-btn active';
          document.getElementById('btn-sat').className = 'layer-btn';
          currentLayer = 'road';
        }
      };

      function renderMarkers() {
        if (!map || !window.L) return;

        // Vẽ vị trí người dùng
        if (position) {
          var userLatLng = toLatLng(position);
          if (userLatLng) {
            if (!userMarker) {
              var userIcon = L.divIcon({
                className: 'user-marker-wrap',
                html: '<div class="user-marker"><div class="user-pulse"></div><div class="user-dot"></div></div>',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
              });
              userMarker = L.marker(userLatLng, { icon: userIcon, zIndexOffset: 2000 }).addTo(map);
            } else {
              userMarker.setLatLng(userLatLng);
            }
          }
        } else if (userMarker) {
          map.removeLayer(userMarker);
          userMarker = null;
        }

        // Vẽ ghim các Chủ sở hữu (Owners)
        var activeIds = {};
        items.forEach(function (item) {
          activeIds[item.id] = true;
          var pinLatLng = toLatLng(item.coordinates);
          if (!pinLatLng) return;

          var isSelected = (item.id === selectedId);
          var pinColor = isSelected ? '#E07A5F' : '#286E74';
          var countText = (item.count || 0) + ' máy';

          var pinHtml = '<div class="owner-pin-wrap ' + (isSelected ? 'selected' : '') + '">' +
            '<div class="owner-badge-pill">' + countText + '</div>' +
            '<div class="owner-pin-icon">' +
              '<svg width="34" height="42" viewBox="0 0 34 42" fill="none">' +
                '<path d="M17 0C7.61 0 0 7.61 0 17C0 29.75 17 42 17 42C17 42 34 29.75 34 17C34 7.61 26.39 0 17 0Z" fill="' + pinColor + '"/>' +
                '<circle cx="17" cy="16" r="10.5" fill="#FFFFFF"/>' +
                '<path d="M11 14L17 10L23 14V21H11V14Z" fill="' + pinColor + '"/>' +
                '<path d="M15 21V17H19V21" fill="#FFFFFF"/>' +
              '</svg>' +
            '</div>' +
            '<div class="owner-name-label">' + escapeHtml(item.name) + '</div>' +
          '</div>';

          var ownerIcon = L.divIcon({
            className: 'owner-icon-container',
            html: pinHtml,
            iconSize: [36, 56],
            iconAnchor: [18, 56]
          });

          if (markersMap[item.id]) {
            markersMap[item.id].setIcon(ownerIcon);
            markersMap[item.id].setLatLng(pinLatLng);
            markersMap[item.id].setZIndexOffset(isSelected ? 1000 : 100);
          } else {
            var m = L.marker(pinLatLng, {
              icon: ownerIcon,
              zIndexOffset: isSelected ? 1000 : 100
            }).addTo(map);

            m.on('click', function (e) {
              if (e && e.originalEvent) e.originalEvent.stopPropagation();
              selectedId = item.id;
              renderMarkers();
              map.panTo(pinLatLng, { animate: true, duration: 0.6 });
              send({ type: 'select', id: item.id, deviceId: item.id });
            });

            markersMap[item.id] = m;
          }
        });

        // Xóa ghim không còn tồn tại
        Object.keys(markersMap).forEach(function (id) {
          if (!activeIds[id]) {
            map.removeLayer(markersMap[id]);
            delete markersMap[id];
          }
        });
      }

      function receive(event) {
        if (!ready || failed || !event || typeof event.data !== 'string') return;
        try {
          var data = JSON.parse(event.data);
          if (!data || !Number.isSafeInteger(data.messageId) || data.messageId <= lastMessageId) return;
          lastMessageId = data.messageId;

          if (data.type === 'update') {
            var rawList = Array.isArray(data.owners) ? data.owners : (Array.isArray(data.devices) ? data.devices : []);
            items = rawList.filter(function (d) {
              return d && typeof d.id === 'string' && /^[a-f0-9]{24}$/i.test(d.id) &&
                typeof d.name === 'string' && validCoordinates(d.coordinates);
            });

            if (data.selectedId !== undefined) {
              selectedId = data.selectedId;
            }
            position = validCoordinates(data.position) ? data.position : null;
            renderMarkers();

            // Tự động căn giữa
            if (position && !centered) {
              var targetLatLng = toLatLng(position);
              if (targetLatLng) {
                map.setView(targetLatLng, 13);
                centered = true;
              }
            } else if (!centered && items.length > 0) {
              var bounds = L.latLngBounds(items.map(function (d) { return toLatLng(d.coordinates); }));
              map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
              centered = true;
            }
          } else if (data.type === 'focus' && validCoordinates(data.position)) {
            var focusLatLng = toLatLng(data.position);
            if (focusLatLng) {
              map.flyTo(focusLatLng, 15, { animate: true, duration: 1 });
            }
          }
        } catch (e) {
          fail('Lỗi cập nhật dữ liệu bản đồ.');
        }
      }

      document.addEventListener('message', receive);
      window.addEventListener('message', receive);

      function initMap() {
        if (!window.L) {
          fail('Không thể khởi tạo thư viện bản đồ.');
          return;
        }

        try {
          // Google Maps chuẩn tiếng Việt
          roadLayer = L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}', {
            subdomains: ['0', '1', '2', '3'],
            maxZoom: 20,
            attribution: 'Google Maps'
          });

          // Google Maps vệ tinh kết hợp nhãn đường
          satLayer = L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&hl=vi&x={x}&y={y}&z={z}', {
            subdomains: ['0', '1', '2', '3'],
            maxZoom: 20,
            attribution: 'Google Maps'
          });

          map = L.map('map', {
            center: [21.0285, 105.8544], // Mặc định Hà Nội
            zoom: 13,
            zoomControl: false,
            layers: [roadLayer],
            attributionControl: false
          });

          L.control.zoom({ position: 'topright' }).addTo(map);

          map.on('click', function () {
            if (selectedId) {
              selectedId = null;
              renderMarkers();
              send({ type: 'select', id: '', deviceId: '' });
            }
          });

          ready = true;
          send({ type: 'ready' });
        } catch (e) {
          fail('Không thể khởi tạo Google Maps: ' + (e && e.message ? e.message : 'Lỗi không xác định'));
        }
      }

      if (window.L) {
        initMap();
      } else {
        var checkCount = 0;
        var checkInterval = setInterval(function () {
          checkCount++;
          if (window.L) {
            clearInterval(checkInterval);
            initMap();
          } else if (checkCount > 50) {
            clearInterval(checkInterval);
            fail('Tải thư viện Google Maps quá thời gian. Vui lòng thử lại.');
          }
        }, 200);
      }
    })();
  </script>
</body>
</html>`;
}

// Giữ alias cho backward compatibility
export const createMapHtml = createGoogleMapHtml;
export const createFaviMapHtml = createGoogleMapHtml;
