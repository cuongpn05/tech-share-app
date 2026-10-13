const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const axios = require('axios');

const apiClient = axios.create({ baseURL: 'http://localhost/api' });
let received;
let offline = false;
let failureStatus;
const devices = [{ _id: 'test-device', name: 'Sony', title: 'Sony' }];
apiClient.get = async (url, config) => {
  received = { url, ...config };
  if (failureStatus) throw { response: { status: failureStatus } };
  if (offline) throw new Error('Offline test');
  if (url.startsWith('/devices/') && url !== '/devices/nearby') {
    return { status: 200, data: { success: true, data: { _id: url.split('/').pop(), title: 'Backend detail', images: ['https://example.com/device.jpg'] } } };
  }
  return { status: 200, data: { success: true, count: 1, data: devices, pagination: { page: 2, limit: 10, totalItems: 16, totalPages: 2, hasNextPage: false } } };
};
const source = fs.readFileSync(`${__dirname}/src/services/deviceService.ts`, 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
const exportsObject = {};
vm.runInNewContext(compiled.outputText, {
  exports: exportsObject,
  require: id => { assert.equal(id, '../config/api'); return { apiClient }; },
  console: { log() {}, error() {} },
});

(async () => {
  const { deviceService, FALLBACK_DEVICES } = exportsObject;
  const homePage = await deviceService.getNearbyDevicesPage({ latitude: 21, longitude: 105,
    category: 'camera', search: ' sony ', page: 2, limit: 10 });
  assert.equal(homePage.data, devices);
  assert.equal(homePage.pagination.page, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(received.params)), {
    lat: 21, lng: 105, radius: 10000, category: 'camera', q: 'sony', page: 2, limit: 10,
  });
  offline = true;
  await assert.rejects(deviceService.getNearbyDevicesPage({ latitude: 21, longitude: 105 }), /Offline test/);
  offline = false;
  await assert.rejects(deviceService.getNearbyDevicesPage({}), /require your location/);
  const originalGet = apiClient.get;
  for (const body of [{ success: true, data: [] }, { success: false, data: [], pagination: {} },
    { success: true, data: [{ _id: 'broken' }], pagination: { page: 1, limit: 10, totalItems: 1, totalPages: 1, hasNextPage: false } }]) {
    apiClient.get = async () => ({ status: 200, data: body });
    await assert.rejects(deviceService.getNearbyDevicesPage({ latitude: 21, longitude: 105 }), /Invalid nearby/);
  }
  apiClient.get = originalGet;
  console.log('PASS Home service: coordinates, filters, page metadata and no fake fallback on network failure');

})().catch(error => { console.error(error); process.exitCode = 1; });
