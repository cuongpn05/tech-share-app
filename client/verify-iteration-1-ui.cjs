const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const sourceRoot = path.resolve(root, '..', '..', 'tech-share-app');
const react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  useEffect() {}, useMemo: fn => fn(), useState: value => [value, () => {}], useRef: value => ({ current: value }) };
const native = { Animated: { Value: class { constructor(value) { this.value = value; } }, View: 'AnimatedView' }, StyleSheet: { create: x => x }, Dimensions: { get: () => ({ width: 390 }) },
  Platform: { OS: 'android', select: x => x.android }, StatusBar: 'StatusBar' };
for (const name of ['View','Text','Image','TextInput','TouchableOpacity','FlatList','RefreshControl','ActivityIndicator','ScrollView']) native[name] = name;
const moduleCache = new Map();
function load(relative) {
  if (moduleCache.has(relative)) return moduleCache.get(relative);
  const exports = {};
  moduleCache.set(relative, exports);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, relative),'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true }
  }).outputText, { exports, console: { log() {} }, require: name => {
    if (name === 'react') return react;
    if (name === 'react-native') return native;
    if (name === './OwnerDrawerNavigator') return { __esModule: true, default: 'OwnerDrawerNavigator' };
    if (name === './AdminDrawerNavigator') return { __esModule: true, default: 'AdminDrawerNavigator' };
    if (name === './HomeRoute') return load('client/src/navigation/HomeRoute.tsx');
    if (name === '@react-navigation/native-stack') return { createNativeStackNavigator: () => ({ Navigator: 'StackNavigator', Screen: 'StackScreen' }) };
    if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ bottom: 0 }) };
    if (name === '../screens/home/HomeScreen') return { HomeScreen: 'HomeScreen' };
    if (name === '../components/navigation/BottomTabNavigator') return { BottomTabNavigator: 'BottomTabNavigator' };
    if (name === '@expo/vector-icons') return { Ionicons: 'Ionicons' };
    if (name.includes('constants/theme')) return requireTheme();
    if (name.includes('theme/colors')) return { colors: { light: {} } };
    if (name.includes('constants/strings')) return { STRINGS: { BOTTOM_NAV: { HOME:'Home', BOOKINGS:'Bookings', NEARBY:'Nearby', COMPARE:'Compare', PROFILE:'Profile' }, DEVICE_CARD: { PRICE_SUFFIX:' VND', STATUS_LABELS:{available:'Available'} } } };
    if (name.includes('config/api')) return { API_BASE_URL:'http://localhost:5000/api' };
    throw new Error(`Unexpected runtime dependency: ${name}`);
  }});
  return exports;
}
function requireTheme() {return { theme: { spacing:{sm:8}, radii:{full:9999}, colors:{slate:{50:'',900:''},danger:{500:''}}, shadows:{card:{elevation:3},subtle:{shadowOpacity:.04,shadowRadius:4}},typography:{badge:{}} }};}
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(x => nodes(x,predicate));
  if (typeof tree.type === 'function') tree = tree.type(tree.props);
  return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children,predicate)];
}
const header = load('client/src/components/navigation/HeaderActions.tsx').HeaderActions({});
const actions = nodes(header, x => x.type === 'TouchableOpacity');
assert.equal(actions.length, 3); assert.ok(actions.every(x => x.props.disabled));
const card = load('client/src/components/device/DeviceCard.tsx').DeviceCard({ device:{ _id:'test',title:'Camera',brand:'Test',status:'available',images:[],dailyRate:100,rating:4,reviewCount:1 } });
assert.equal(nodes(card,x=>x.type==='TouchableOpacity').length,2);
assert.ok(nodes(card,x=>x.type==='TouchableOpacity').every(x=>x.props.disabled));
const tabs = load('client/src/components/navigation/BottomTabNavigator.tsx').BottomTabNavigator({ activeTab:'home', onTabPress:()=>{}, enabledTabs:['home'] });
const tabNodes = nodes(tabs,x=>x.props?.accessibilityRole==='tab');
assert.deepEqual(tabNodes.map(x=>x.props.accessibilityLabel),['Home','Bookings','Nearby','Compare','Profile']);
assert.equal(tabNodes[0].props.disabled,false); assert.ok(tabNodes.slice(1).every(x=>x.props.disabled));
for (const relative of ['client/src/screens/home/HomeScreen.tsx','client/src/components/home/CategoryBar.tsx','client/src/components/home/SectionHeader.tsx','client/src/components/device/DeviceCard.tsx','client/src/components/navigation/HeaderActions.tsx','client/src/components/navigation/BottomTabNavigator.tsx']) {
  const oldSource = fs.readFileSync(path.join(sourceRoot,relative),'utf8').replace(/\r/g,'');
  const newSource = fs.readFileSync(path.join(root,relative),'utf8').replace(/\r/g,'');
  assert.equal(newSource.slice(newSource.indexOf('const styles =')),oldSource.slice(oldSource.indexOf('const styles =')),`Styling changed: ${relative}`);
}
assert.equal(fs.readFileSync(path.join(root,'client/src/hooks/useHomeLocation.ts'),'utf8').replace(/\r/g,''),fs.readFileSync(path.join(sourceRoot,'client/src/hooks/useHomeLocation.ts'),'utf8').replace(/\r/g,''));
console.log('PASS UI component contract: three header icons, full card, five ordered tabs; future actions disabled; Home/component styles and GPS hook unchanged.');
console.log('NOT TESTED: rendered native screenshots, touch interactions, GPS permissions on a physical device.');

const navigation = load('client/src/navigation/RootNavigator.tsx');
const rootNavigation = navigation.RootNavigator();
assert.equal(rootNavigation.props.initialRouteName, 'Owner');
const screens = nodes(rootNavigation, node => node.type === 'StackScreen');
assert.deepEqual(screens.map(screen => screen.props.name), ['Owner','Admin','Home']);
assert.equal(screens[2].props.component, navigation.HomeRoute);
assert.equal(nodes(navigation.HomeRoute(), node => node.type === 'HomeScreen').length, 1);
console.log('PASS public navigation: Owner/Admin dashboards plus public Home registered; no fake auth session.');
