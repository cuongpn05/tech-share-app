const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const homePath = 'client/src/screens/home/HomeScreen.tsx';
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

function compile(source, dependencies, globals = {}) {
  const exported = {};
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText, { exports: exported, __DEV__: false, console: { log() {} }, require: dependencies, ...globals });
  return exported;
}

const strings = compile(read('client/src/constants/strings.ts'), () => {}).STRINGS;
const native = { StyleSheet: { create: value => value }, Dimensions: { get: () => ({ width: 390 }) },
  Platform: { OS: 'android' }, Linking: { openSettings() {} } };
for (const name of ['View', 'Text', 'TextInput', 'TouchableOpacity', 'FlatList', 'RefreshControl', 'StatusBar', 'ActivityIndicator']) native[name] = name;

function find(tree, type) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => find(child, type));
  return [...(tree.type === type ? [tree] : []), ...find(tree.props?.children, type)];
}

function harness(source, changes = {}, locationChanges = {}) {
  const state = { filteredDevices: [], selectedCategory: 'all', searchQuery: '', isLoading: false,
    isInitialLoading: false, isRefreshing: false, error: null, page: 1, failedPage: null,
    hasNextPage: true, isLoadingMore: false, hasLoaded: true, ...changes };
  const dispatched = [];
  const refreshCalls = [];
  const completions = [];
  let locationCallback;
  const modes = [];
  const useStateValues = [changes.nearby || false, ['gaming', 'tablet'], null, false, 0, ''];
  let stateIndex = 0;
  const location = { position: null, error: null, warning: null, isLocating: false,
    isRefreshingLocation: false, refresh: force => refreshCalls.push(force), ...locationChanges };
  const react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: initial => [useStateValues[stateIndex++], value => modes.push(value)],
    useEffect() {}, useMemo: fn => fn(), useRef: value => ({ current: value }) };
  const actions = Object.fromEntries(['fetchDevices', 'refreshDevices', 'setSelectedCategory', 'clearFilters', 'resetDeviceDiscovery']
    .map(type => [type, payload => ({ type, payload })]));
  const exported = compile(source, name => {
    if (name === 'react') return react;
    if (name === 'react-native') return native;
    if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 24, bottom: 0 }) };
    if (name === '@expo/vector-icons') return { Ionicons: 'Ionicons' };
    if (name.endsWith('/store')) return { useAppSelector: select => select({ devices: state, auth: { isAuthenticated: false } }), useAppDispatch: () => action => {
      dispatched.push(action);
      return new Promise(resolve => completions.push(resolve));
    } };
    if (name.endsWith('/deviceSlice')) return actions;
    if (name.endsWith('/useHomeLocation')) return { useHomeLocation: (callback, enabled) => { locationCallback = callback; modes.push({ enabled }); return location; },
      HOME_LOCATION_MOVEMENT_METERS: 150, homeDistanceMeters: (from, to) => Math.abs(from.latitude - to.latitude) * 111000 };
    if (name.endsWith('/deviceService')) return { HOME_NEARBY_RADIUS_METERS: 10000 };
    if (name.endsWith('/strings')) return { STRINGS: strings };
    if (name.endsWith('/colors')) return { colors: { light: {} } };
    const component = name.split('/').pop();
    return { [component]: component };
  });
  const searchChanges = [];
  const tree = exported.HomeScreen({ onSearchChange: value => searchChanges.push(value) });
  const list = find(tree, 'FlatList')[0].props;
  return { tree, list, dispatched, refreshCalls, searchChanges, completions, modes,
    locate: (latitude = 21, force = false) => locationCallback({ latitude, longitude: 105 }, force) };
}


const source = read(homePath);
const all = harness(source, {}, { error: 'Permission denied', isLocating: true });
assert.equal(all.modes[0].enabled, false);
const categoryBar = find(all.list.ListHeaderComponent, 'CategoryBar')[0];
assert.deepEqual(plain(categoryBar.props.categories), ['gaming', 'tablet']);
categoryBar.props.onSelectCategory('gaming');
assert.equal(all.dispatched.at(-1).type, 'setSelectedCategory');
assert.equal(all.dispatched.at(-1).payload, 'gaming');
all.list.refreshControl.props.onRefresh();
assert.equal(all.dispatched.at(-1).type, 'refreshDevices');
assert.equal(all.refreshCalls.length, 0);
assert.equal(find(all.list.ListEmptyComponent(), 'Text').some(n => n.props.children.includes('Permission denied')), false);
const nearby = harness(source, { nearby: true, hasLoaded: false, isInitialLoading: true }, { isLocating: true });
assert.equal(nearby.modes[0].enabled, true);
assert.equal(find(nearby.list.ListEmptyComponent(), 'Text').length, 0, 'skeleton while waiting GPS');
nearby.locate(21);
assert.equal(nearby.dispatched.at(-1).payload.nearby, true);
assert.equal(nearby.dispatched.at(-1).payload.latitude, 21);
assert.equal(nearby.dispatched.at(-1).payload.radius, 10000);
const denied = harness(source, { nearby: true, filteredDevices: [{ _id: 'stale' }] }, { error: 'Permission denied' });
assert.equal(denied.list.data.length, 0);
assert.ok(find(denied.list.ListEmptyComponent(), 'Text').some(n => n.props.children.includes('Permission denied')));
const offline = harness(source, { error: 'Offline' });
assert.ok(find(offline.list.ListEmptyComponent(), 'Text').some(n => n.props.children.includes('Offline')));
const empty = harness(source);
assert.ok(find(empty.list.ListEmptyComponent(), 'Text').some(n => n.props.children.includes(strings.HOME_SCREEN.EMPTY_TITLE)));
const more = harness(source, { filteredDevices: [{ _id: 'a' }], isLoadingMore: true });
assert.equal(find(more.list.ListFooterComponent, 'ActivityIndicator').length, 1);
console.log('PASS rendered Home callbacks: All without GPS, categories from API, refresh, Nearby coordinates/radius, location denial hides stale data, loading/empty/API error. Native UI not exercised.');

const cardReact = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  useState: value => [value, () => {}], useEffect() {} };
const { DeviceCard } = compile(read('client/src/components/device/DeviceCard.tsx'), name => {
  if (name === 'react') return cardReact;
  if (name === 'react-native') return { ...native, Image: 'Image' };
  if (name === '@expo/vector-icons') return { Ionicons: 'Ionicons' };
  if (name.endsWith('/colors')) return { colors: { light: {} } };
  if (name.endsWith('/strings')) return { STRINGS: strings };
  if (name.endsWith('/api')) return { API_BASE_URL: 'http://localhost:5000/api' };
  throw new Error(name);
});
const card = DeviceCard({ device: { _id: 'db-device', name: 'Database camera', pricePerDay: 450000,
  category: 'camera', stats: { ratingAvg: 0, ratingCount: 0 },
  location: { addressText: 'District 1, Ho Chi Minh City' }, distanceMeters: 1250 } });
const texts = find(card, 'Text').flatMap(n => n.props.children);
assert.ok(texts.includes('Database camera'));
assert.ok(texts.includes('450,000' + strings.DEVICE_CARD.PRICE_SUFFIX));
assert.ok(texts.includes('0.0'), 'zero rating must not become a fake five stars');
assert.ok(texts.includes('1.3 km'));
assert.ok(texts.includes('District 1, Ho Chi Minh City'));
assert.ok(texts.includes('Image unavailable'));
const missing = DeviceCard({ device: { _id: 'missing-optional' } });
assert.ok(find(missing, 'Text').some(n => n.props.children.includes('Price unavailable')));
console.log('PASS DeviceCard: DB fields, addressText, distance, zero rating, missing images/optional fields; no fake photo.');
