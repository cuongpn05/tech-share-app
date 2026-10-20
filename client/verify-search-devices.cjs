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

const toolkit = require('@reduxjs/toolkit');
const requests = [];
const deviceService = {
  getCategories: async () => ['camera', 'gaming'],
  getDevicesPage: params => new Promise((resolve, reject) => requests.push({ params, resolve, reject })),
  getNearbyDevicesPage: params => new Promise((resolve, reject) => requests.push({ params, resolve, reject })),
};
const slice = compile(read('client/src/store/slices/deviceSlice.ts'), name =>
  name === '@reduxjs/toolkit' ? toolkit : { deviceService });
const store = toolkit.configureStore({ reducer: slice.default });
const slots = [];
let cursor = 0;
let effects = [];
let clock = 0;
let timerId = 0;
const timers = new Map();
let locationCallback;
let locationEnabled;
const location = { position: null, isLocating: false, isRefreshingLocation: false,
  error: null, warning: null, refresh() {} };
const react = {
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  useState(initial) {
    const index = cursor++;
    if (!(index in slots)) slots[index] = initial;
    return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
  },
  useRef(initial) {
    const index = cursor++;
    return slots[index] ||= { current: initial };
  },
  useEffect(callback, dependencies) {
    const index = cursor++;
    const previous = slots[index];
    if (previous && dependencies.every((value, i) => Object.is(value, previous.dependencies[i]))) return;
    effects.push(() => {
      previous?.cleanup?.();
      slots[index] = { dependencies, cleanup: callback() };
    });
  },
};
const { HomeScreen } = compile(read(homePath), name => {
  if (name === 'react') return react;
  if (name === 'react-native') return native;
  if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 24, bottom: 0 }) };
  if (name === '@expo/vector-icons') return { Ionicons: 'Ionicons' };
  if (name.endsWith('/store')) return { useAppDispatch: () => store.dispatch,
    useAppSelector: select => select({ devices: store.getState(), auth: { isAuthenticated: false } }) };
  if (name.endsWith('/deviceSlice')) return slice;
  if (name.endsWith('/useHomeLocation')) return {
    useHomeLocation: (callback, enabled) => { locationCallback = callback; locationEnabled = enabled; return location; },
    homeDistanceMeters: () => 0, HOME_LOCATION_MOVEMENT_METERS: 150,
  };
  if (name.endsWith('/deviceService')) return { deviceService, HOME_NEARBY_RADIUS_METERS: 10000 };
  if (name.endsWith('/strings')) return { STRINGS: strings };
  if (name.endsWith('/colors')) return { colors: { light: {} } };
  const component = name.split('/').pop();
  return { [component]: component };
}, {
  setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, at: clock + delay }); return id; },
  clearTimeout: id => timers.delete(id),
});

let list;
function render() {
  cursor = 0;
  effects = [];
  const tree = HomeScreen({});
  list = find(tree, 'FlatList')[0].props;
  effects.forEach(effect => effect());
}
function advance(milliseconds) {
  clock += milliseconds;
  for (const [id, timer] of [...timers]) {
    if (timer.at <= clock) { timers.delete(id); timer.callback(); }
  }
}
function input(value) {
  find(list.ListHeaderComponent, 'TextInput')[0].props.onChangeText(value);
  render();
}
const tick = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };
const page = (ids, pageNumber = 1, hasNextPage = false) => ({
  data: ids.map(_id => ({ _id, name: _id, title: _id })),
  pagination: { page: pageNumber, limit: 10, totalItems: hasNextPage ? 12 : ids.length,
    totalPages: hasNextPage ? 2 : 1, hasNextPage },
});
const textIncludes = (tree, text) => find(tree, 'Text').some(node => node.props.children.includes(text));

(async () => {
  render(); await tick(); render();
  assert.equal(locationEnabled, false);
  const field = find(list.ListHeaderComponent, 'TextInput')[0].props;
  assert.equal(field.placeholder, 'Search devices...');
  assert.notEqual(field.editable, false, 'search must work without props from HomeRoute');
  advance(400);
  const initial = requests.shift();
  initial.resolve(page(['all'])); await tick(); render();
  input('    '); advance(500);
  assert.equal(requests.length, 0, 'whitespace alone must not issue a search');
  input('c'); advance(100);
  input('ca'); advance(100);
  input(' camera '); advance(399);
  assert.equal(requests.length, 0);
  assert.ok(textIncludes(list.ListEmptyComponent(), 'Searching devices...'));
  advance(1);
  const old = requests.shift();
  assert.equal(old.params.search, 'camera');
  assert.equal(old.params.page, 1);
  input('sony');
  old.resolve(page(['old-camera'])); await tick(); render();
  assert.equal(store.getState().devices.length, 0, 'old response cannot update results during debounce');
  advance(400);
  const latest = requests.shift();
  assert.equal(latest.params.search, 'sony');
  latest.resolve(page(['sony'], 1, true)); await tick(); render();
  assert.equal(store.getState().devices[0]._id, 'sony');
  const loadMore = find(list.ListFooterComponent, 'TouchableOpacity')[0];
  loadMore.props.onPress();
  const next = requests.shift();
  assert.equal(next.params.page, 2);
  assert.equal(next.params.search, 'sony');
  next.resolve(page(['sony-2'], 2)); await tick(); render();
  input('missing'); advance(400);
  assert.equal(store.getState().page, 0);
  const missing = requests.shift();
  assert.equal(missing.params.page, 1);
  missing.resolve(page([])); await tick(); render();
  assert.ok(textIncludes(list.ListEmptyComponent(), 'No devices found'));
  find(list.ListHeaderComponent, 'TouchableOpacity').find(node => node.props.accessibilityLabel === 'Clear search').props.onPress();
  render(); advance(400);
  const cleared = requests.shift();
  assert.equal(cleared.params.search, '');
  cleared.resolve(page(['all-again'])); await tick(); render();
  input('offline'); advance(400);
  requests.shift().reject(new Error('Offline')); await tick(); render();
  assert.ok(textIncludes(list.ListEmptyComponent(), 'Offline'));
  find(list.ListEmptyComponent(), 'TouchableOpacity')[0].props.onPress();
  const retry = requests.shift();
  assert.equal(retry.params.search, 'offline');
  retry.resolve(page([])); await tick(); render();
  input('camera'); advance(100);
  find(list.ListHeaderComponent, 'CategoryBar')[0].props.onSelectCategory('camera');
  render(); advance(400);
  const category = requests.shift();
  assert.equal(category.params.category, 'camera');
  assert.equal(category.params.search, 'camera');
  category.resolve(page(['category-camera'])); await tick(); render();
  find(list.ListHeaderComponent, 'TouchableOpacity').find(node => node.props.key === 'true').props.onPress();
  render(); advance(400);
  assert.equal(locationEnabled, true);
  assert.equal(requests.length, 0, 'Nearby waits for real coordinates');
  locationCallback({ latitude: 21, longitude: 105 }, false);
  const nearby = requests.shift();
  assert.equal(nearby.params.nearby, true);
  assert.equal(nearby.params.search, 'camera');
  assert.equal(nearby.params.category, 'camera');
  assert.equal(nearby.params.latitude, 21);
  nearby.resolve(page(['near-camera'])); await tick(); render();
  assert.equal(store.getState().devices[0]._id, 'near-camera');
  assert.equal(requests.length, 0);
  console.log('PASS Home + real Redux: editable search, 400ms debounce, trim/whitespace, rapid typing, stale response during debounce, reset/pagination, X clear, loading/empty/error/retry, Category and Nearby. GPS/native UI simulated.');
})().catch(error => { console.error(error); process.exitCode = 1; });

