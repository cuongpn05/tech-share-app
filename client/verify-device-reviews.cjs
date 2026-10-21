const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function compile(source, dependencies, globals = {}) {
  const exported = {};
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
    }).outputText,
    { exports: exported, __DEV__: false, console: { log() {}, warn() {} }, require: dependencies, ...globals }
  );
  return exported;
}

const native = {
  StyleSheet: { create: value => value },
  Dimensions: { get: () => ({ width: 390 }) },
  Platform: { OS: 'android' },
};
for (const name of [
  'View', 'Text', 'TextInput', 'TouchableOpacity', 'FlatList', 'RefreshControl',
  'StatusBar', 'ActivityIndicator', 'ScrollView', 'Image', 'Modal',
]) {
  native[name] = name;
}

function find(tree, type) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => find(child, type));
  return [...(tree.type === type ? [tree] : []), ...find(tree.props?.children, type)];
}

const deviceRequests = [];
const reviewRequests = [];
const slots = [];
let cursor = 0;
let effects = [];
let tree;

const react = {
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  useState(initial) {
    const index = cursor++;
    if (!(index in slots)) slots[index] = initial;
    return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
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
  if (name.endsWith('/colors')) return { colors: { light: { ratingStar: '#F59E0B' } } };
  if (name.endsWith('/api')) return { API_BASE_URL: 'http://localhost:5000/api' };
  if (name.endsWith('/deviceService')) return {
    deviceService: {
      getDeviceById: (id, options) => new Promise((resolve, reject) => deviceRequests.push({ id, options, resolve, reject })),
    },
  };
  if (name.endsWith('/reviewService')) return {
    reviewService: {
      getDeviceReviews: id => new Promise((resolve, reject) => reviewRequests.push({ id, resolve, reject })),
    },
  };
  throw new Error(name);
});

let currentId = '507f1f77bcf86cd799439011';
function render(nextId = currentId) {
  currentId = nextId;
  cursor = 0;
  effects = [];
  tree = DeviceDetailScreen({
    deviceId: currentId,
    onBack: () => {},
    onRent: () => {},
  });
  effects.forEach(effect => effect());
}

const tick = async () => {
  for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve));
};
const texts = () => find(tree, 'Text').flatMap(node => node.props.children);

(async () => {
  console.log('Testing DeviceDetailScreen review display...');

  // Test 1: Device with active reviews
  render('507f1f77bcf86cd799439011');
  const devReq = deviceRequests.shift();
  const revReq = reviewRequests.shift();
  assert.equal(devReq.id, '507f1f77bcf86cd799439011');
  assert.equal(revReq.id, '507f1f77bcf86cd799439011');

  devReq.resolve({
    _id: '507f1f77bcf86cd799439011',
    name: 'Sony Alpha A7 IV',
    category: 'camera',
    pricePerDay: 500000,
    status: 'available',
    description: 'Professional full-frame camera.',
    images: ['https://example.com/sony.jpg'],
  });

  const mockReviews = [
    {
      _id: 'rev_1',
      bookingId: 'b_1',
      deviceId: '507f1f77bcf86cd799439011',
      renterId: { name: 'Nguyễn Văn A', avatar: 'https://example.com/a.jpg', isVerified: true },
      rating: 5,
      comment: 'Máy rất mới, quay phim 4K 60fps cực mượt!',
      images: ['https://example.com/test1.jpg'],
      createdAt: '2026-10-10T12:00:00.000Z',
    },
    {
      _id: 'rev_2',
      bookingId: 'b_2',
      deviceId: '507f1f77bcf86cd799439011',
      renterId: { name: 'Trần Thị B', avatar: '' },
      rating: 4,
      comment: 'Chụp hình đẹp, pin dùng đủ cả ngày.',
      images: [],
      createdAt: '2026-10-12T14:30:00.000Z',
    },
  ];

  revReq.resolve(mockReviews);
  await tick();
  render();

  const allTexts = texts();
  assert.ok(allTexts.includes('Reviews & Ratings'), 'Header title displayed');
  assert.ok(allTexts.includes('4.5'), 'Average rating 4.5 calculated and displayed');
  assert.ok(allTexts.includes('Máy rất mới, quay phim 4K 60fps cực mượt!'), 'Review 1 comment displayed');
  assert.ok(allTexts.includes('Chụp hình đẹp, pin dùng đủ cả ngày.'), 'Review 2 comment displayed');
  assert.ok(allTexts.includes('Nguyễn Văn A'), 'Reviewer A name displayed');
  assert.ok(allTexts.includes('Trần Thị B'), 'Reviewer B name displayed');
  console.log('✓ PASS: Device with reviews renders rating summary, breakdown, reviewer info, and comments.');

  // Test 2: Device with NO reviews
  slots.length = 0;
  render('507f1f77bcf86cd799439022');
  const devReq2 = deviceRequests.shift();
  const revReq2 = reviewRequests.shift();

  devReq2.resolve({
    _id: '507f1f77bcf86cd799439022',
    name: 'MacBook Pro M3 Max',
    status: 'available',
    pricePerDay: 800000,
  });
  revReq2.resolve([]);
  await tick();
  render('507f1f77bcf86cd799439022');

  const emptyTexts = texts();
  assert.ok(emptyTexts.includes('No reviews yet'), 'Empty review title displayed');
  assert.ok(
    emptyTexts.some(t => typeof t === 'string' && t.includes('Be the first to rent')),
    'Empty review subtitle displayed'
  );
  console.log('✓ PASS: Device without reviews renders clean empty state.');

  // Test 3: Failed review request
  slots.length = 0;
  render('507f1f77bcf86cd799439033');
  const devReq3 = deviceRequests.shift();
  const revReq3 = reviewRequests.shift();

  devReq3.resolve({
    _id: '507f1f77bcf86cd799439033',
    name: 'DJI Mini 4 Pro',
    status: 'available',
    pricePerDay: 350000,
  });
  revReq3.reject(new Error('Network error'));
  await tick();
  render('507f1f77bcf86cd799439033');

  const errTexts = texts();
  assert.ok(
    errTexts.some(t => typeof t === 'string' && t.includes('Unable to load reviews')),
    'Error message displayed gracefully'
  );
  console.log('✓ PASS: Failed reviews fetch displays graceful error state without breaking screen.');

  console.log('\nALL DEVICE REVIEWS TESTS PASSED SUCCESSFULLY! 🎉');
})().catch(err => {
  console.error('Test failed:', err);
  process.exitCode = 1;
});
