const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const toolkit = require('@reduxjs/toolkit');

const pending = [];
const deviceService = {
  getNearbyDevicesPage: params => new Promise((resolve, reject) => pending.push({ params, resolve, reject })),
};
const exported = {};
const source = fs.readFileSync(`${__dirname}/src/store/slices/deviceSlice.ts`, 'utf8');
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, {
  exports: exported,
  require: id => id === '@reduxjs/toolkit' ? toolkit : { deviceService },
});
const { default: reducer, fetchDevices, refreshDevices, resetDeviceDiscovery } = exported;
const result = (ids, page = 1, totalPages = 2) => ({
  data: ids.map(_id => ({ _id, title: _id })),
  pagination: { page, limit: 10, totalItems: 20, totalPages, hasNextPage: page < totalPages },
});

(async () => {
  for (const [oldThunk, newThunk] of [
    [refreshDevices, fetchDevices], [fetchDevices, refreshDevices],
    [refreshDevices, refreshDevices], [fetchDevices, fetchDevices],
  ]) {
    for (const oldFails of [false, true]) {
      const store = toolkit.configureStore({ reducer });
      const oldTask = store.dispatch(oldThunk({ category: 'all', search: 'iphone' }));
      const oldRequest = pending.shift();
      const newTask = store.dispatch(newThunk({ category: 'camera', search: 'sony' }));
      const newRequest = pending.shift();
      newRequest.resolve(result(['sony']));
      await newTask;
      if (oldFails) oldRequest.reject(new Error('Old request failed'));
      else oldRequest.resolve(result(['iphone']));
      await oldTask;
      const state = store.getState();
      assert.equal(state.searchQuery, 'sony');
      assert.equal(state.selectedCategory, 'camera');
      assert.equal(state.filteredDevices[0]._id, 'sony');
      assert.equal(state.error, null);
      assert.equal(state.isLoading, false);
      assert.equal(state.isRefreshing, false);
      assert.equal(state.isInitialLoading, false);
    }
  }
  for (const thunk of [fetchDevices, refreshDevices]) {
    const store = toolkit.configureStore({ reducer });
    const task = store.dispatch(thunk({ search: 'sony' }));
    pending.shift().reject(new Error('Current request failed'));
    await task;
    assert.equal(store.getState().error, 'Current request failed');
    assert.equal(store.getState().isLoading, false);
    assert.equal(store.getState().isRefreshing, false);
    assert.equal(store.getState().isInitialLoading, false);
  }
  {
    const store = toolkit.configureStore({ reducer });
    const params = { latitude: 21.028334, longitude: 105.854041, radius: 10000,
      category: 'camera', search: 'sony', page: 1, limit: 10 };
    const first = store.dispatch(fetchDevices(params));
    pending.shift().resolve(result(['first'])); await first;
    const second = store.dispatch(fetchDevices({ ...params, page: 2 }));
    const request = pending.shift();
    assert.equal(request.params.category, 'camera');
    assert.equal(request.params.search, 'sony');
    assert.equal(request.params.latitude, params.latitude);
    assert.equal(request.params.radius, 10000);
    request.resolve(result(['first', 'second'], 2)); await second;
    assert.deepEqual(Array.from(store.getState().devices, d => d._id), ['first', 'second']);
    // Typing invalidates the in-flight query before its debounce expires.
    const oldTask = store.dispatch(fetchDevices({ ...params, page: 2 }));
    const oldRequest = pending.shift();
    store.dispatch(exported.setSearchQuery('iphone'));
    store.dispatch(resetDeviceDiscovery());
    oldRequest.resolve(result(['old-sony'], 2)); await oldTask;
    assert.equal(store.getState().searchQuery, 'iphone');
    assert.equal(store.getState().devices.length, 0);
    assert.equal(store.getState().currentRequestId, null);
    console.log('PASS combined page 2 params and stale response during search debounce');
  }
  {
    const store = toolkit.configureStore({ reducer });
    const first = store.dispatch(fetchDevices({ latitude: 21, longitude: 105, page: 1 }));
    const firstRequest = pending.shift();
    assert.equal(firstRequest.params.limit, 10);
    assert.equal(firstRequest.params.latitude, 21);
    firstRequest.resolve(result(['a', 'b'])); await first;
    const second = store.dispatch(fetchDevices({ latitude: 21, longitude: 105, page: 2 }));
    pending.shift().resolve(result(['b', 'c'], 2)); await second;
    assert.deepEqual(Array.from(store.getState().devices, d => d._id), ['a', 'b', 'c']);
    assert.equal(store.getState().page, 2);
    const stale = store.dispatch(fetchDevices({ page: 2 }));
    const staleRequest = pending.shift();
    const filtered = store.dispatch(fetchDevices({ category: 'camera', page: 1 }));
    assert.equal(store.getState().devices.length, 0);
    pending.shift().resolve(result(['camera'], 1, 1)); await filtered;
    staleRequest.resolve(result(['old'], 2)); await stale;
    assert.deepEqual(Array.from(store.getState().devices, d => d._id), ['camera']);
    const refresh = store.dispatch(refreshDevices({ page: 2 }));
    assert.equal(pending[0].params.page, 1);
    pending.shift().resolve(result(['fresh'], 1, 1)); await refresh;
    assert.deepEqual(Array.from(store.getState().devices, d => d._id), ['fresh']);
    const inFlight = store.dispatch(fetchDevices({ page: 2 }));
    const inFlightRequest = pending.shift();
    store.dispatch(resetDeviceDiscovery());
    inFlightRequest.resolve(result(['previous-session'], 2)); await inFlight;
    assert.equal(store.getState().devices.length, 0);
    console.log('PASS pagination: append, deduplication, filter reset, stale page, refresh and session reset');
  }
  console.log('PASS 10 request cases: latest search/refresh wins; stale success/error ignored; loading flags and current failures handled.');
})().catch(error => { console.error(error); process.exitCode = 1; });
