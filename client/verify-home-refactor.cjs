const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const homePath = 'client/src/screens/home/HomeScreen.tsx';
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const baseline = file => execFileSync('git', ['show', `HEAD:${file}`], { cwd: root, encoding: 'utf8' });
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
  const location = { position: null, error: null, warning: null, isLocating: false,
    isRefreshingLocation: false, refresh: force => refreshCalls.push(force), ...locationChanges };
  const react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useEffect() {}, useMemo: fn => fn(), useRef: value => ({ current: value }) };
  const actions = Object.fromEntries(['fetchDevices', 'refreshDevices', 'setSelectedCategory', 'clearFilters', 'resetDeviceDiscovery']
    .map(type => [type, payload => ({ type, payload })]));
  const exported = compile(source, name => {
    if (name === 'react') return react;
    if (name === 'react-native') return native;
    if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 24, bottom: 0 }) };
    if (name === '@expo/vector-icons') return { Ionicons: 'Ionicons' };
    if (name.endsWith('/store')) return { useAppSelector: select => select({ devices: state }), useAppDispatch: () => action => {
      dispatched.push(action);
      return new Promise(resolve => completions.push(resolve));
    } };
    if (name.endsWith('/deviceSlice')) return actions;
    if (name.endsWith('/useHomeLocation')) return { useHomeLocation: callback => { locationCallback = callback; return location; },
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
  return { tree, list, dispatched, refreshCalls, searchChanges, completions,
    locate: (latitude = 21, force = false) => locationCallback({ latitude, longitude: 105 }, force) };
}

function uiSnapshot(screen) {
  const list = screen.list;
  return JSON.stringify({ tree: screen.tree,
    empty: list.ListEmptyComponent(), footer: list.ListFooterComponent,
    card: list.renderItem({ item: { _id: 'camera' } }),
  }, (key, value) => typeof value === 'function' ? '[callback]' : value);
}

(async () => {
  const oldSource = baseline(homePath);
  const newSource = read(homePath);
  for (const [state, location] of [
    [{}, {}], [{ isInitialLoading: true, hasLoaded: false }, {}],
    [{ error: 'Offline' }, {}], [{}, { error: 'Permission denied' }],
    [{ selectedCategory: 'camera' }, {}],
    [{ filteredDevices: [{ _id: 'camera' }] }, {}],
    [{ filteredDevices: [{ _id: 'camera' }], error: 'Offline', failedPage: 2 }, {}],
    [{ filteredDevices: [{ _id: 'camera' }], isLoadingMore: true }, {}],
    [{ filteredDevices: [{ _id: 'camera' }], hasNextPage: false }, {}],
    [{}, { position: { latitude: 21, longitude: 105 }, warning: 'GPS unavailable' }],
  ]) {
    assert.equal(uiSnapshot(harness(newSource, state, location)), uiSnapshot(harness(oldSource, state, location)));
  }

  // Exercise actual Home callbacks for both versions with the same inputs.
  for (const source of [oldSource, newSource]) {
    const screen = harness(source, { filteredDevices: [{ _id: 'camera' }] });
    screen.locate();
    assert.deepEqual(screen.dispatched.map(action => action.type), ['resetDeviceDiscovery', 'fetchDevices']);
    const categoryBar = find(screen.list.ListHeaderComponent, 'CategoryBar')[0];
    categoryBar.props.onSelectCategory('camera');
    assert.equal(screen.dispatched.at(-1).payload.page, 1);
    assert.equal(screen.dispatched.at(-1).payload.category, 'camera');
    categoryBar.props.onSelectCategory('all');
    assert.equal(screen.dispatched.at(-1).payload.category, 'all');
    screen.locate(21, true);
    assert.equal(screen.dispatched.at(-1).type, 'refreshDevices');
    screen.locate(22, true);
    assert.equal(screen.dispatched.at(-2).type, 'resetDeviceDiscovery');
    assert.equal(screen.dispatched.at(-1).type, 'fetchDevices');
    screen.list.refreshControl.props.onRefresh();
    assert.deepEqual(screen.refreshCalls, [true]);
    const before = screen.dispatched.length;
    const loadMore = find(screen.list.ListFooterComponent, 'TouchableOpacity')[0];
    loadMore.props.onPress();
    loadMore.props.onPress();
    assert.equal(screen.dispatched.length, before + 1);
    assert.deepEqual(plain(screen.dispatched.at(-1).payload), {
      latitude: 22, longitude: 105, category: 'all', search: '', radius: 10000, page: 2, limit: 10,
    });
    screen.completions.at(-1)();
    await Promise.resolve();
    loadMore.props.onPress();
    assert.equal(screen.dispatched.length, before + 2);

    const retry = harness(source, { filteredDevices: [{ _id: 'camera' }], error: 'Offline', failedPage: 3 });
    retry.locate();
    find(retry.list.ListFooterComponent, 'TouchableOpacity')[0].props.onPress();
    assert.equal(retry.dispatched.at(-1).payload.page, 3);

    const empty = harness(source, { selectedCategory: 'camera' });
    empty.locate();
    find(empty.list.ListEmptyComponent(), 'TouchableOpacity')[0].props.onPress();
    assert.equal(empty.dispatched.at(-2).type, 'clearFilters');
    assert.equal(empty.dispatched.at(-1).payload.category, 'all');
    assert.deepEqual(empty.searchChanges, ['']);

    const selected = harness(source, { selectedCategory: 'camera' });
    selected.locate();
    find(selected.list.ListHeaderComponent, 'SectionHeader')[0].props.onActionPress();
    assert.equal(selected.dispatched.at(-1).payload.category, 'all');

    for (const guard of [{ isLoading: true }, { isRefreshing: true }, { page: 0 }]) {
      const blocked = harness(source, { filteredDevices: [{ _id: 'camera' }], ...guard });
      blocked.locate();
      const beforeLoad = blocked.dispatched.length;
      find(blocked.list.ListFooterComponent, 'TouchableOpacity')[0]?.props.onPress();
      assert.equal(blocked.dispatched.length, beforeLoad, 'Load More guard must block request');
    }
  }

  for (const file of [homePath, 'client/src/components/home/CategoryBar.tsx', 'client/src/components/home/PromoBanner.tsx',
    'client/src/components/home/SectionHeader.tsx', 'client/src/components/device/DeviceCard.tsx']) {
    const styles = source => source.slice(source.indexOf('const styles =')).replace(/\r/g, '');
    assert.equal(styles(read(file)), styles(baseline(file)), `Styles changed: ${file}`);
  }

  const componentReact = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) };
  const componentNative = { ...native, ScrollView: 'ScrollView', Image: 'Image' };
  const dependencies = react => name => {
    if (name === 'react') return react;
    if (name === 'react-native') return componentNative;
    if (name === '@expo/vector-icons') return { Ionicons: 'Ionicons' };
    if (name.endsWith('/colors')) return { colors: { light: {} } };
    if (name.endsWith('/strings')) return { STRINGS: strings };
    if (name.endsWith('/api')) return { API_BASE_URL: 'http://localhost:5001/api' };
    throw new Error(name);
  };
  const cardFile = 'client/src/components/device/DeviceCard.tsx';
  for (const images of [[], ['https://example.com/photo.jpg'], ['/uploads/photo.jpg'], '', undefined]) {
    const device = { _id: 'camera', title: 'Camera', images, image: '/uploads/legacy.jpg',
      brand: 'Sony', status: 'available', rating: 4.5, dailyRate: 100, location: { address: 'A, B, C' } };
    const before = compile(baseline(cardFile), dependencies(componentReact)).DeviceCard({ device });
    const after = compile(read(cardFile), dependencies(componentReact)).DeviceCard({ device });
    const snapshot = tree => JSON.stringify(tree, (_, value) => typeof value === 'function' ? '[callback]' : value);
    assert.equal(snapshot(after), snapshot(before), 'Card image fallback/UI changed');
  }
  for (const source of [baseline(cardFile), read(cardFile)]) {
    const pressed = [];
    const favorite = [];
    const device = { _id: 'camera', images: [], dailyRate: 100 };
    const card = compile(source, dependencies(componentReact)).DeviceCard({ device,
      onPress: id => pressed.push(id), onToggleFavorite: value => favorite.push(value) });
    const buttons = find(card, 'TouchableOpacity');
    buttons[0].props.onPress();
    buttons[1].props.onPress();
    assert.deepEqual(pressed, ['camera']);
    assert.equal(favorite[0], device);
  }
  const categoryFile = 'client/src/components/home/CategoryBar.tsx';
  for (const source of [baseline(categoryFile), read(categoryFile)]) {
    const selected = [];
    const category = compile(source, dependencies(componentReact));
    const tree = category.CategoryBar({ selectedCategory: 'camera', onSelectCategory: value => selected.push(value) });
    const buttons = find(tree, 'TouchableOpacity');
    assert.equal(buttons.length, 8);
    assert.equal(buttons.filter(button => button.props.accessibilityState.selected).length, 1);
    buttons[0].props.onPress();
    buttons[3].props.onPress();
    assert.deepEqual(selected, ['all', 'camera']);
  }

  const bannerFile = 'client/src/components/home/PromoBanner.tsx';
  for (const source of [baseline(bannerFile), read(bannerFile)]) {
    let timer;
    let cleanup;
    let cursor = 0;
    const slots = [];
    const scrollCalls = [];
    const react = { ...componentReact,
      useState: initial => { const index = cursor++; if (!(index in slots)) slots[index] = initial;
        return [slots[index], value => { slots[index] = value; }]; },
      useRef: initial => { const index = cursor++; return slots[index] ||= { current: initial }; },
      useEffect: callback => { if (cleanup) cleanup(); cleanup = callback(); },
    };
    const banner = compile(source, dependencies(react), {
      setInterval: (callback, delay) => { assert.equal(delay, 4000); timer = callback; return 1; },
      clearInterval: () => { timer = null; },
    });
    const render = () => { cursor = 0; return banner.PromoBanner({}); };
    const first = render();
    const scrollView = find(first, 'ScrollView')[0];
    scrollView.props.ref.current = { scrollTo: value => scrollCalls.push(value) };
    timer();
    assert.equal(scrollCalls[0].x, 370);
    render();
    timer();
    assert.equal(scrollCalls[1].x, 740);
    render();
    timer();
    assert.equal(scrollCalls[2].x, 0);
    scrollView.props.onTouchStart();
    assert.equal(timer, null);
    scrollView.props.onTouchEnd();
    assert.equal(typeof timer, 'function');
    scrollView.props.onScroll({ nativeEvent: { contentOffset: { x: 740 } } });
    render();
    timer();
    assert.equal(scrollCalls.at(-1).x, 0);
    cleanup();
    assert.equal(timer, null);
  }
  console.log('PASS Home before/after: 10 UI states, category/All/reset, GPS refresh/movement, pull-to-refresh, duplicate Load More lock/release, failed-page Retry and unchanged styles.');
  console.log('PASS components before/after: image fallback/card UI/actions, 8 category buttons, banner 4s interval/wrap/touch/manual scroll/cleanup.');
})().catch(error => { console.error(error); process.exitCode = 1; });
