import { Device } from '../../types';

export interface MapDevice {
  id: string;
  name: string;
  coordinates: [number, number];
}

export function getMapDevices(devices: Device[]): MapDevice[] {
  const markers = new Map<string, MapDevice>();
  for (const device of devices) {
    const coordinates = device.location?.coordinates;
    if (device.location?.type !== 'Point' || !Array.isArray(coordinates) || coordinates.length !== 2 ||
        !Number.isFinite(coordinates[0]) || Math.abs(coordinates[0]) > 180 ||
        !Number.isFinite(coordinates[1]) || Math.abs(coordinates[1]) > 90 ||
        !/^[a-f\d]{24}$/i.test(device._id)) continue;
    markers.set(device._id, { id: device._id, name: device.name || device.title || 'Device', coordinates });
  }
  return [...markers.values()];
}

export type MapMessage = { type: 'ready' } | { type: 'select'; deviceId: string } |
  { type: 'error'; message: string };

export function parseMapMessage(value: string): MapMessage | null {
  if (value.length > 4096) return null;
  try {
    const data: unknown = JSON.parse(value);
    if (!data || typeof data !== 'object' || !('type' in data)) return null;
    if (data.type === 'ready') return { type: 'ready' };
    if (data.type === 'select' && 'deviceId' in data && typeof data.deviceId === 'string' &&
        /^[a-f\d]{24}$/i.test(data.deviceId)) return { type: 'select', deviceId: data.deviceId };
    if (data.type === 'error' && 'message' in data && typeof data.message === 'string') {
      return { type: 'error', message: data.message.slice(0, 300) };
    }
  } catch { /* Ignore malformed bridge messages. */ }
  return null;
}

// Only the encoded client key enters this HTML. Device content is sent as JSON after ready.
export function createFaviMapHtml(apiKey: string): string {
  const key = JSON.stringify(apiKey).replace(/</g, '\\u003c');
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body,#map{margin:0;width:100%;height:100%;background:#F8FAFC}body{overflow:hidden}.maplibregl-marker{cursor:pointer}</style>
</head><body><div id="map"></div><script>
(function () {
  var map, failed = false, ready = false, lastMessageId = 0;
  var devices = [], position = null, centered = false;
  function send(data) { window.ReactNativeWebView.postMessage(JSON.stringify(data)); }
  function fail(message) {
    if (failed) return;
    failed = true;
    clearTimeout(timeout);
    send({ type: 'error', message: message });
  }
  var timeout = setTimeout(function () {
    fail('Map timed out. Check your connection, API key and WebGL support.');
  }, 25000);
  window.addEventListener('error', function () { fail('Unable to load map resources. Check your connection and API key.'); }, true);
  window.addEventListener('unhandledrejection', function () { fail('Unable to initialize Favi Map. Please try again.'); });
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
      var element = marker.getElement();
      element.setAttribute('role', 'button');
      element.setAttribute('tabindex', '0');
      // text attributes avoid interpreting device names as HTML.
      element.setAttribute('aria-label', device.name);
      element.addEventListener('click', function () { send({ type: 'select', deviceId: device.id }); });
      element.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') send({ type: 'select', deviceId: device.id });
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
        devices = data.devices.filter(function (device) {
          return device && typeof device.id === 'string' && /^[a-f0-9]{24}$/i.test(device.id) &&
            typeof device.name === 'string' && validCoordinates(device.coordinates);
        });
        position = validCoordinates(data.position) ? data.position : null;
        renderMarkers();
        if (position && !centered) {
          map.flyToLocation(position, 13);
          centered = true;
        }
      } else if (data.type === 'focus' && validCoordinates(data.position)) {
        map.flyToLocation(data.position, 14);
      }
    } catch (error) { fail('Unable to update map markers. Please reload the map.'); }
  }
  // Android dispatches on document; iOS dispatches on window.
  document.addEventListener('message', receive);
  window.addEventListener('message', receive);
  var script = document.createElement('script');
  script.src = 'https://api-map.fastviet.vn/sdk/favimap.js?key=' + encodeURIComponent(${key});
  script.onerror = function () { fail('Unable to load Favi Map SDK. Check your connection and API key.'); };
  script.onload = function () {
    if (!window.FaviMap) { fail('Favi Map SDK is unavailable.'); return; }
    FaviMap.ready(function () {
      if (failed) return;
      try {
        map = FaviMap.create('map', { navigationControl: true, geolocateControl: false, satelliteControl: false });
        // SDK 1.1.0 shadows getCenter with recursion. Restore the inherited MapLibre method
        // on this instance so markers and camera controls work; the vendor source stays intact.
        map.getCenter = window.maplibregl.Map.prototype.getCenter;
        map.on('error', function (event) {
          var status = event.error && event.error.status;
          fail(status === 401 || status === 403 ? 'Favi Map rejected this API key or its restrictions.' :
            status === 429 ? 'Favi Map quota exceeded. Check API key usage.' :
            'Unable to load map tiles. Check your connection, API key and quota.');
        });
        map.on('load', function () {
          if (failed) return;
          ready = true;
          clearTimeout(timeout);
          send({ type: 'ready' });
        });
      } catch (error) { fail('Unable to initialize Favi Map. Check WebGL support.'); }
    });
  };
  document.head.appendChild(script);
})();
</script></body></html>`;
}
