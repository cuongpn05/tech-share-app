const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const plain = value => JSON.parse(JSON.stringify(value));
const tick = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };
function load(file, requireModule, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(`${__dirname}/${file}`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports, require: requireModule, console, ...globals });
  return exports;
}
const htmlModule = load('src/components/map/faviMapHtml.ts', () => ({}));
const id = '507f1f77bcf86cd799439011';
const otherId = '507f1f77bcf86cd799439012';
const hostileName = '</script><img src=x onerror=alert(1)>';
const device = { _id: id, name: hostileName, category: 'camera', pricePerDay: 340000,
  location: { type: 'Point', coordinates: [105.8544, 21.0285], addressText: 'Ha Noi' } };
const invalidDevices = [{ ...device, _id: otherId, location: null },
  { ...device, location: { type: 'Point', coordinates: [21, 200] } },
  { ...device, location: { type: 'Point', coordinates: ['105', 21] } },
  { ...device, location: { type: 'Point', coordinates: [NaN, 21] } }];
assert.deepEqual(plain(htmlModule.getMapDevices([device, device, ...invalidDevices])),
  [{ id, name: hostileName, coordinates: [105.8544, 21.0285] }]);
for (const value of ['bad', 'null', '{}', '{"type":"select","deviceId":"bad"}', 'x'.repeat(4097)]) {
  assert.equal(htmlModule.parseMapMessage(value), null);
}
assert.equal(htmlModule.parseMapMessage(JSON.stringify({ type: 'select', deviceId: id })).deviceId, id);

function bridge() {
  const outgoing = [], scripts = [], listeners = {}, events = {}, markers = [], flights = [];
  let clears = 0;
  const map = { clearMarkers() { clears++; markers.length = 0; },
    addMarker(coordinates, options) {
      const attributes = {}, clicks = {};
      markers.push({ coordinates: plain(coordinates), options, attributes, clicks });
      return { getElement: () => ({ setAttribute: (key, value) => { attributes[key] = value; },
        addEventListener: (key, fn) => { clicks[key] = fn; } }) };
    }, flyToLocation: (...args) => flights.push(plain(args)), on: (name, fn) => { events[name] = fn; },
    getCenter() { throw new Error('Broken vendor getCenter'); } };
  const originalCenter = () => ({ lng: 105.85, lat: 21.03 });
  const window = { ReactNativeWebView: { postMessage: value => outgoing.push(JSON.parse(value)) },
    addEventListener: (name, fn) => { listeners[`window:${name}`] = fn; },
    FaviMap: { ready: fn => fn(), create: () => map }, maplibregl: { Map: { prototype: { getCenter: originalCenter } } } };
  const document = { addEventListener: (name, fn) => { listeners[`document:${name}`] = fn; },
    createElement: () => ({}), head: { appendChild: script => scripts.push(script) } };
  const html = htmlModule.createFaviMapHtml('</script>test-key');
  assert.equal((html.match(/<\/script>/g) || []).length, 1);
  const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInNewContext(source, { window, document, FaviMap: window.FaviMap, setTimeout: () => 1, clearTimeout() {} });
  scripts[0].onload();
  assert.equal(map.getCenter, originalCenter);
  events.load();
  return { outgoing, markers, flights, events, scripts, clears: () => clears,
    receive: data => listeners['document:message']({ data: JSON.stringify(data) }) };
}
const b = bridge();
assert.deepEqual(b.outgoing, [{ type: 'ready' }]);
const update = { type: 'update', messageId: 1, position: [106.7009, 10.7769],
  devices: [{ id, name: hostileName, coordinates: [105.8544, 21.0285] }] };
b.receive(update);
assert.equal(b.markers.length, 2);
assert.deepEqual(b.markers[1].coordinates, [105.8544, 21.0285]);
assert.equal(b.markers[1].attributes['aria-label'], hostileName);
b.markers[1].clicks.click();
assert.deepEqual(b.outgoing.at(-1), { type: 'select', deviceId: id });
b.receive(update); assert.equal(b.clears(), 1);
b.receive({ type: 'focus', messageId: 2, position: [105.85, 21.03] });
assert.deepEqual(b.flights.at(-1), [[105.85, 21.03], 14]);
b.receive({ type: 'update', messageId: 3, position: null, devices: [] });
assert.equal(b.markers.length, 0);
for (const status of [401, 403, 429]) {
  const h = bridge(); h.events.error({ error: { status } });
  assert.equal(h.outgoing.at(-1).type, 'error');
  assert.match(h.outgoing.at(-1).message, status === 429 ? /quota/ : /API key/);
}
const failedScript = bridge(); failedScript.scripts[0].onerror();
assert.match(failedScript.outgoing.at(-1).message, /SDK/);
console.log('PASS HTML bridge (mock SDK): coordinates, GPS/focus, marker selection/update, duplicate messages, untrusted names, getCenter workaround, key/quota errors.');

function screenHarness(apiKey = 'test-key') {
  const slots = [], requests = [], timers = new Map(), opened = [], posts = [];
  let cursor = 0, pendingEffects = [], tree, gpsCallback, timerId = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial;
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ||= { current: initial }; },
    useMemo(fn, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) slots[i] = { deps, value: fn() }; return slots[i].value; },
    useEffect(fn, deps) { const i = cursor++; if (!same(slots[i]?.deps, deps)) {
      pendingEffects.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
    } },
  };
  const native = { StyleSheet: { create: value => value }, Linking: { openSettings: async () => {} } };
  for (const name of ['ActivityIndicator', 'Text', 'TextInput', 'TouchableOpacity', 'View']) native[name] = name;
  const location = { position: null, error: null, warning: null, source: 'CURRENT', isLocating: false, refresh: async () => {} };
  const service = { getCategories: async () => ['camera'], getNearbyDevices: params => new Promise((resolve, reject) => requests.push({ params, resolve, reject })) };
  const globals = { setTimeout: (fn, delay) => { const id = ++timerId; timers.set(id, { fn, delay }); return id; }, clearTimeout: id => timers.delete(id) };
  const { MapScreen } = load('src/screens/map/MapScreen.tsx', name => {
    if (name === 'react') return react;
    if (name === 'react-native') return native;
    if (name === 'react-native-webview') return { WebView: 'WebView' };
    if (name.includes('safe-area')) return { useSafeAreaInsets: () => ({ top: 0 }) };
    if (name.includes('vector-icons')) return { Ionicons: 'Icon' };
    if (name.includes('faviMapHtml')) return htmlModule;
    if (name.includes('config/faviMap')) return { FAVI_MAP_API_KEY: apiKey };
    if (name.includes('useHomeLocation')) return { useHomeLocation: callback => { gpsCallback = callback; return location; } };
    if (name.includes('deviceService')) return { deviceService: service, HOME_NEARBY_RADIUS_METERS: 10000 };
    if (name.includes('store')) return { useAppSelector: fn => fn({ devices: { selectedCategory: 'all', searchQuery: 'Sony' } }) };
    if (name.includes('CategoryBar')) return { CategoryBar: 'CategoryBar' };
    if (name.includes('colors')) return { colors: { light: {} } };
    throw Error(name);
  }, globals);
  function find(node, type) {
    if (Array.isArray(node)) return node.flatMap(child => find(child, type));
    if (!node || typeof node !== 'object') return [];
    return [...(node.type === type ? [node] : []), ...find(node.props?.children, type)];
  }
  function render() {
    cursor = 0; pendingEffects = [];
    tree = MapScreen({ onNavigateToDeviceDetail: id => opened.push(id) });
    for (const web of find(tree, 'WebView')) web.props.ref.current = { postMessage: value => posts.push(JSON.parse(value)) };
    pendingEffects.forEach(fn => fn());
  }
  render();
  return { render, requests, opened, posts, location, find: type => find(tree, type),
    text: () => JSON.stringify(tree), gps: position => { location.position = position; gpsCallback(position); },
    flush: () => { for (const [id, timer] of timers) if (timer.delay === 400) { timers.delete(id); timer.fn(); } },
    cleanup: () => slots.forEach(slot => slot?.cleanup?.()) };
}

(async () => {
  const missing = screenHarness('');
  assert.equal(missing.find('WebView').length, 0); assert.match(missing.text(), /key is missing/); missing.cleanup();
  const h = screenHarness();
  h.gps({ latitude: 21.0285, longitude: 105.8544 }); h.render(); h.flush();
  assert.equal(h.requests[0].params.radius, 10000);
  assert.equal(h.find('TextInput').length, 0);
  assert.equal(h.requests[0].params.search, undefined);
  h.find('CategoryBar')[0].props.onSelectCategory('camera'); h.render(); h.flush();
  h.requests[0].resolve([{ ...device, name: 'Old result' }]); await tick(); h.render();
  assert.doesNotMatch(h.text(), /Old result/);
  assert.equal(h.requests[1].params.category, 'camera');
  h.requests[1].resolve([device]); await tick(); h.render();
  const receive = data => h.find('WebView')[0].props.onMessage({ nativeEvent: { data: JSON.stringify(data) } });
  receive({ type: 'ready' }); h.render();
  assert.deepEqual(h.posts.at(-1).position, [105.8544, 21.0285]);
  receive({ type: 'select', deviceId: otherId }); h.render(); assert.doesNotMatch(h.text(), /View device/);
  receive({ type: 'select', deviceId: id }); h.render();
  const viewButton = h.find('TouchableOpacity').find(button => JSON.stringify(button).includes('View device'));
  viewButton.props.onPress(); assert.deepEqual(h.opened, [id]);
  h.find('CategoryBar')[0].props.onSelectCategory('all'); h.render(); h.flush();
  assert.equal(h.requests[2].params.category, 'all'); assert.equal(h.requests[2].params.search, undefined);
  h.requests[2].reject(Error('offline')); await tick(); h.render(); assert.match(h.text(), /Unable to load nearby/);
  const retry = h.find('TouchableOpacity').find(button => JSON.stringify(button).includes('Tap to retry'));
  retry.props.onPress(); h.render(); h.flush(); h.requests[3].resolve([]); await tick(); h.render();
  assert.match(h.text(), /No devices with valid coordinates/);
  h.location.error = 'Allow location access'; h.location.position = null; h.render();
  assert.match(h.text(), /Allow location access/); assert.equal(h.posts.at(-1).position, null);
  h.cleanup();
  console.log('PASS MapScreen (mock GPS/API/WebView): missing key, radius/category/All, no search or inherited search filter, stale response, selection/detail callback, loading/error/retry/empty, revoked permission.');

  const navigation = [];
  const react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: value => [value, () => {}], useEffect() {}, useCallback: fn => fn };
  const { HomeRoute } = load('src/navigation/HomeRoute.tsx', name => {
    if (name === 'react') return react;
    if (name === 'react-native') return { View: 'View', StyleSheet: { create: value => value } };
    if (name === '@react-navigation/native') return { useFocusEffect() {} };
    if (name.includes('safe-area')) return { useSafeAreaInsets: () => ({ bottom: 20 }) };
    if (name.includes('store')) return { useAppSelector: fn => fn({ auth: { isAuthenticated: true } }) };
    if (name.includes('/theme')) return { theme: { spacing: {}, colors: {}, radii: {} } };
    if (name.includes('/MapScreen')) return { MapScreen: 'MapScreen' };
    if (name.includes('BottomTabNavigator')) return { BottomTabNavigator: 'BottomTabs' };
    if (name.includes('notificationService')) return { notificationService: { getUnreadCountCached: () => 0 } };
    return {};
  });
  const routeTree = HomeRoute({ route: { params: { initialTab: 'map' } }, navigation: { navigate: (...args) => navigation.push(args) } });
  const [mapScreen, tabs] = routeTree.props.children;
  assert.equal(mapScreen.type, 'MapScreen');
  assert.equal(tabs.type, 'BottomTabs'); assert.ok(tabs.props.enabledTabs.includes('map'));
  mapScreen.props.onNavigateToDeviceDetail(id);
  assert.deepEqual(plain(navigation), [['DeviceDetail', { deviceId: id }]]);
  console.log('PASS HomeRoute: Nearby tab enabled, bottom tabs retained, existing DeviceDetail route receives selected ID.');

  const calls = [];
  const { deviceService } = load('src/services/deviceService.ts', () => ({ apiClient: { get: async (...args) => {
    calls.push(args); return { data: { success: true, data: [device] } };
  } } }));
  await deviceService.getNearbyDevices({ latitude: 21.0285, longitude: 105.8544, category: 'camera', radius: 10000 });
  assert.deepEqual(plain(calls[0]), ['/devices/nearby', { params: { lat: 21.0285, lng: 105.8544, radius: 10000, category: 'camera' } }]);
  await assert.rejects(() => deviceService.getNearbyDevices({ latitude: 200, longitude: 105 }), /valid location/);
  assert.equal(calls.length, 1);
  console.log('PASS service: existing full-radius API, lat/lng order, category only, no pagination, invalid coordinates rejected.');
  console.log('NOT TESTED here: real SDK rendering, tile authentication/billing, native WebView, Android/LDPlayer GPS.');
})().catch(error => { console.error(error); process.exitCode = 1; });
