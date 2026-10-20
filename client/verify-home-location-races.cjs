const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const file = 'client/src/hooks/useHomeLocation.ts';
const tick = async () => { for (let index = 0; index < 15; index++) await new Promise(resolve => setImmediate(resolve)); };
const coordinate = (latitude = 21, age = 0) => ({ coords: { latitude, longitude: 105 }, timestamp: Date.now() - age });

function createModule(source) {
  const exported = {};
  let environment;
  const awaitStage = (stage, value) => {
    if (environment.pausedStage !== stage) return Promise.resolve(value);
    return new Promise(resolve => { environment.resumeStage = () => resolve(value); });
  };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports: exported, __DEV__: false, Error, console,
    setTimeout: (callback, delay) => { assert.equal(delay, 15000); environment.timeout = callback; return 1; },
    clearTimeout: () => { environment.timeout = null; },
    require: name => {
      if (name === 'react') return {
        useRef: initial => { const index = environment.cursor++; return environment.slots[index] ||= { current: initial }; },
        useState: initial => { const index = environment.cursor++;
          if (!(index in environment.slots)) environment.slots[index] = initial;
          const target = environment;
          return [target.slots[index], value => { target.slots[index] = value; target.updates++; }]; },
        useCallback: callback => callback,
        useEffect: callback => environment.effects.push(callback),
      };
      if (name === 'react-native') return { AppState: { addEventListener: (_, callback) => {
        environment.onAppState = callback; return { remove: () => environment.removals++ };
      } } };
      if (name === '@react-navigation/native') return { useFocusEffect: callback => { environment.onFocus = callback; } };
      if (name === 'expo-location') return {
        Accuracy: { High: 4 }, getForegroundPermissionsAsync: () => awaitStage('permission', { granted: true }),
        hasServicesEnabledAsync: () => awaitStage('services', true),
        getLastKnownPositionAsync: () => awaitStage('cache', environment.lastKnown),
        watchPositionAsync: async (_, callback) => {
          environment.watch = callback; return { remove: () => environment.removals++ };
        },
        getCurrentPositionAsync: () => new Promise((resolve, reject) => environment.requests.push({ resolve, reject })),
      };
      throw new Error(name);
    },
  });
  return {
    mount(lastKnown = null, pausedStage = null) {
      environment = { cursor: 0, slots: [], effects: [], requests: [], callbacks: [], removals: 0, updates: 0, lastKnown, pausedStage };
      const target = environment;
      target.render = () => { environment = target; target.cursor = 0;
        return exported.useHomeLocation((position, force) => target.callbacks.push({ position, force })); };
      target.render();
      target.cleanup = target.effects[0]();
      return target;
    },
  };
}

async function verify(source) {
  for (const pausedStage of ['permission', 'services', 'cache']) {
    const paused = createModule(source).mount(coordinate(), pausedStage);
    await tick();
    assert.equal(typeof paused.resumeStage, 'function');
    paused.cleanup();
    const updatesAfterCleanup = paused.updates;
    paused.resumeStage();
    await tick();
    assert.equal(paused.updates, updatesAfterCleanup, `No state update after delayed ${pausedStage}`);
    assert.equal(paused.requests.length, 0, `No current GPS request after stale ${pausedStage}`);
    assert.equal(paused.callbacks.length, 0, `No Home callback after stale ${pausedStage}`);
  }
  const module = createModule(source);
  const screen = module.mount();
  await tick();
  screen.watch(coordinate(22));
  screen.requests[0].resolve(coordinate(21));
  await tick();
  assert.equal(screen.render().position.latitude, 22, 'watch must beat slow current position');
  assert.equal(screen.timeout, null, 'successful GPS must clear timeout');

  const firstRefresh = screen.render().refresh(true);
  await tick();
  const secondRefresh = screen.render().refresh(true);
  await tick();
  screen.requests.at(-1).resolve(coordinate(23));
  await secondRefresh;
  screen.requests.at(-2).resolve(coordinate(24));
  await firstRefresh;
  assert.equal(screen.render().position.latitude, 23, 'old refresh must be ignored');

  const forcedRefresh = screen.render().refresh(true);
  await tick();
  screen.watch(coordinate(25));
  screen.requests.at(-1).resolve(coordinate(24));
  await forcedRefresh;
  assert.equal(screen.callbacks.at(-1).position.latitude, 25);
  assert.equal(screen.callbacks.at(-1).force, true);

  const updatesBeforeUnmount = screen.updates;
  const lastRefresh = screen.render().refresh();
  await tick();
  screen.cleanup();
  const updatesAfterCleanup = screen.updates;
  screen.requests.at(-1).resolve(coordinate(26));
  screen.watch(coordinate(27));
  await lastRefresh;
  assert.equal(screen.updates, updatesAfterCleanup, 'unmounted hook must not update state');
  assert.ok(updatesAfterCleanup >= updatesBeforeUnmount);
  assert.equal(screen.removals, 2);

  // A second mount shares the module cache; choose the newer valid cache.
  const cached = module.mount(coordinate(20, 1000));
  await tick();
  assert.equal(cached.render().position.latitude, 25);
  assert.equal(cached.render().source, 'CACHE');
  cached.requests[0].reject(new Error('GPS unavailable'));
  await tick();
  assert.match(cached.render().warning, /GPS unavailable/);
  cached.cleanup();

  for (const age of [1000, 25 * 60 * 60 * 1000, -10000]) {
    const freshModule = createModule(source);
    const cachedScreen = freshModule.mount(coordinate(21, age));
    await tick();
    assert.equal(!!cachedScreen.render().position, age === 1000, 'cache age policy');
    cachedScreen.timeout();
    await tick();
    const result = cachedScreen.render();
    assert.match(result.warning || result.error, /Unable to determine your location/);
    assert.equal(cachedScreen.timeout, null);
    cachedScreen.cleanup();
  }

  const lifecycle = createModule(source).mount();
  await tick();
  lifecycle.requests[0].resolve(coordinate());
  await tick();
  lifecycle.onFocus();
  await tick();
  assert.equal(lifecycle.requests.length, 1, 'first focus skips duplicate refresh');
  lifecycle.onFocus();
  await tick();
  lifecycle.requests.at(-1).resolve(coordinate());
  await tick();
  lifecycle.onAppState('background');
  assert.equal(lifecycle.requests.length, 2);
  lifecycle.onAppState('active');
  await tick();
  assert.equal(lifecycle.requests.length, 3);
  lifecycle.requests.at(-1).resolve(coordinate());
  await tick();
  lifecycle.cleanup();
}

(async () => {
  const before = execFileSync('git', ['show', `HEAD:${file}`], { cwd: __dirname, encoding: 'utf8' });
  await verify(before);
  await verify(fs.readFileSync(`${__dirname}/src/hooks/useHomeLocation.ts`, 'utf8'));
  const cachedFix = createModule(fs.readFileSync(`${__dirname}/src/hooks/useHomeLocation.ts`, 'utf8')).mount(coordinate(21, 1000));
  await tick();
  assert.equal(cachedFix.callbacks.length, 1);
  cachedFix.requests[0].resolve(coordinate(21.0001));
  await tick();
  assert.equal(cachedFix.callbacks.length, 2, 'current GPS must replace cached query even below 150m');
  assert.equal(cachedFix.callbacks.at(-1).position.latitude, 21.0001);
  cachedFix.cleanup();
  console.log('PASS GPS before/after: delayed permission/services/cache after unmount, watch precedence, overlapping refresh, forced refresh, unmount, cache selection/expiry/future timestamp, 15s timeout/cleanup, focus and AppState lifecycle.');
})().catch(error => { console.error(error); process.exitCode = 1; });
