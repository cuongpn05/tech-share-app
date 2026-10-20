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

native.Image = 'Image';
const requests = [];
const slots = [];
let cursor = 0;
let effects = [];
let updates = 0;
let tree;
const rented = [];
let backs = 0;
const react = {
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  useState(initial) {
    const index = cursor++;
    if (!(index in slots)) slots[index] = initial;
    return [slots[index], value => { updates++; slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
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
const detailPath = 'client/src/screens/device/DeviceDetailScreen.tsx';
const { DeviceDetailScreen } = compile(read(detailPath), name => {
  if (name === 'react') return react;
  if (name === 'react-native') return native;
  if (name === '@expo/vector-icons') return { Ionicons: 'Ionicons' };
  if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) };
  if (name.endsWith('/colors')) return { colors: { light: {} } };
  if (name.endsWith('/api')) return { API_BASE_URL: 'http://localhost:5000/api' };
  if (name.endsWith('/deviceService')) return { deviceService: {
    getDeviceById: (id, options) => new Promise((resolve, reject) => requests.push({ id, options, resolve, reject })),
  } };
  throw new Error(name);
});
let id = '507f1f77bcf86cd799439011';
function render(nextId = id) {
  id = nextId; cursor = 0; effects = [];
  tree = DeviceDetailScreen({ deviceId: id, onBack: () => backs++, onRent: value => rented.push(value) });
  effects.forEach(effect => effect());
}
const tick = async () => { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); };
const texts = () => find(tree, 'Text').flatMap(node => node.props.children);
const press = label => find(tree, 'TouchableOpacity').find(node => node.props.accessibilityLabel === label).props.onPress();
const data = {
  _id: id, name: 'Database camera', category: 'camera', pricePerDay: 450000, status: 'available',
  description: 'A long description from the database.', images: ['/uploads/camera.jpg', 'https://example.com/second.jpg'],
  specs: { cpu_model: 'M3', RAM: '32GB', videoResolution: '4K', nil: null, absent: 'undefined', bad: { nested: true }, zero: 0 },
  ownerId: { name: 'Database owner', address: { fullAddress: 'Owner area' } },
  location: { addressText: 'District 1, Ho Chi Minh City' },
};
const navigationCalls = [];
const navigation = { navigate: (...args) => navigationCalls.push(args), goBack: () => navigationCalls.push(['Back']) };
const navReact = { createElement: react.createElement, useState: initial => [initial, () => {}],
  useEffect() {}, useRef: value => ({ current: value }), useCallback: callback => callback };
const theme = { spacing: {}, radii: {}, colors: { brand: {}, text: {} }, typography: { fontSize: {}, fontWeight: {} } };
function navDependencies(name) {
  if (name === 'react') return navReact;
  if (name === 'react-native') return native;
  if (name === '@expo/vector-icons') return { Ionicons: 'Ionicons' };
  if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) };
  if (name === '@react-navigation/native-stack') return { createNativeStackNavigator: () => ({ Navigator: 'Navigator', Screen: 'Screen' }) };
  if (name.endsWith('/store')) return { useAppSelector: select => select({ auth: { isAuthenticated: false, user: null } }) };
  if (name.endsWith('/theme') || name.endsWith('/tokens')) return { theme };
  const component = name.split('/').pop();
  return { [component]: component, default: component };
}
(async () => {
  const { HomeRoute } = compile(read('client/src/navigation/HomeRoute.tsx'), navDependencies);
  const home = HomeRoute({ navigation });
  find(home, 'HomeScreen')[0].props.onNavigateToDeviceDetail(id);
  assert.deepEqual(plain(navigationCalls.pop()), ['DeviceDetail', { deviceId: id }]);
  navReact.useState = initial => [initial === null ? true : initial, () => {}];
  const { RootNavigator } = compile(read('client/src/navigation/RootNavigator.tsx'), navDependencies);
  const root = RootNavigator();
  const detailRoute = find(root, 'Screen').find(screen => screen.props.name === 'DeviceDetail');
  const detailElement = detailRoute.props.component({ route: { params: { deviceId: id } }, navigation });
  assert.equal(detailElement.props.deviceId, id);
  detailElement.props.onRent(id);
  assert.deepEqual(plain(navigationCalls.pop()), ['BookingCreate', { deviceId: id }]);
  const bookingRoute = find(root, 'Screen').find(screen => screen.props.name === 'BookingCreate');
  const bookingElement = bookingRoute.props.component({ route: { params: { deviceId: id } }, navigation });
  assert.equal(bookingElement.type, 'BookingCreateScreen');
  assert.equal(bookingElement.props.deviceId, id);
  console.log('PASS navigation callbacks: Home/Search shared list → DeviceDetail → existing BookingCreate with same ID.');
  render();
  assert.equal(find(tree, 'ActivityIndicator').length, 1);
  const first = requests.shift();
  assert.equal(first.id, id); assert.equal(first.options.throwOnError, true);
  first.resolve(data); await tick(); render();
  for (const text of ['Database camera', 'camera', '450,000 VND / day', 'CPU Model', 'RAM',
    'Video Resolution', 'M3', '32GB', '4K', '0', 'Database owner', 'Owner area']) assert.ok(texts().includes(text), text);
  for (const text of ['undefined', 'null', '[object Object]']) assert.ok(!texts().includes(text));
  assert.equal(find(tree, 'Image')[0].props.source.uri, 'http://localhost:5000/uploads/camera.jpg');
  find(tree, 'Image')[0].props.onError(); render();
  assert.ok(texts().includes('Image unavailable'));
  press('View photo 2'); render();
  assert.equal(find(tree, 'Image')[0].props.source.uri, 'https://example.com/second.jpg');
  press('Rent device'); assert.deepEqual(rented, [id]);
  press('Back'); assert.equal(backs, 1);
  render('507f1f77bcf86cd799439012');
  requests.shift().resolve({ _id: id, name: 'Missing fields', status: 'maintenance', specs: null, images: null, ownerId: null });
  await tick(); render();
  for (const text of ['No description available.', 'No specifications available.', 'Owner information unavailable.', 'Price unavailable']) {
    assert.ok(texts().includes(text), text);
  }
  assert.equal(find(tree, 'TouchableOpacity').find(node => node.props.accessibilityLabel === 'Rent device').props.disabled, true);
  render('507f1f77bcf86cd799439013');
  requests.shift().reject({ response: { status: 404 } }); await tick(); render();
  assert.ok(texts().includes('Device not found'));
  render('invalid'); render();
  assert.ok(texts().includes('Invalid device ID.'));
  assert.equal(requests.length, 0);
  render('507f1f77bcf86cd799439014');
  requests.shift().reject(new Error('Offline')); await tick(); render();
  assert.ok(texts().includes('Unable to load this device. Please try again.'));
  const retryButton = find(tree, 'TouchableOpacity').find(node =>
    find(node, 'Text').some(text => text.props.children.includes('Try Again')));
  retryButton.props.onPress(); render();
  requests.shift().resolve({ ...data, _id: id }); await tick(); render();
  assert.ok(texts().includes('Database camera'));
  render('507f1f77bcf86cd799439015'); const old = requests.shift();
  render('507f1f77bcf86cd799439016'); const current = requests.shift();
  old.resolve({ ...data, name: 'Old device' }); await tick(); render();
  assert.ok(!texts().includes('Old device'));
  current.resolve({ ...data, _id: id, name: 'Current device' }); await tick(); render();
  assert.ok(texts().includes('Current device'));
  render('507f1f77bcf86cd799439017');
  slots.forEach(slot => slot?.cleanup?.());
  const before = updates;
  requests.shift().resolve(data); await tick();
  assert.equal(updates, before, 'no updates after unmount');
  console.log('PASS Device Detail render/lifecycle: ID, DB fields, safe specs/labels, album/failed image, missing fields, loading/404/invalid/error/retry, race/unmount, Back and Rent ID. Native phone layout not exercised.');
})().catch(error => { console.error(error); process.exitCode = 1; });

