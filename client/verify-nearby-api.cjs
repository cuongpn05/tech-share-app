// Isolated Nearby HTTP regression: no connection, seed, or database writes.
const assert = require('node:assert/strict');
const express = require('../server/node_modules/express');
const Device = require('../server/src/models/Device');
const { getNearbyDevices } = require('../server/src/controllers/deviceController');
const { errorHandler } = require('../server/src/middlewares/errorHandler');
let pipeline;
let calls = 0;
let empty = false;
let fail = false;
Device.aggregate = async stages => {
  pipeline = stages;
  calls++;
  if (fail) throw new Error('Simulated database error');
  return [{ data: empty ? [] : [{ _id: '507f1f77bcf86cd799439011', name: 'Test camera',
    brand: 'Sony', category: 'camera', pricePerDay: 100, status: 'available', isDeleted: false,
    location: { type: 'Point', coordinates: [105, 21] }, distanceMeters: 12 }],
  total: empty ? [] : [{ count: 21 }] }];
};
Device.populate = async documents => documents;
const app = express();
app.get('/api/devices/nearby', getNearbyDevices);
app.use(errorHandler);

(async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/devices/nearby`;
  const get = async query => { const response = await fetch(`${base}?${query}`);
    return { status: response.status, body: await response.json() }; };
  try {
    for (const query of ['', 'lat=abc&lng=105', 'lat=91&lng=105', 'lat=21&lng=181',
      'lat=21&lng=105&radius=0', 'lat=21&lng=105&radius=-1', 'lat=21&lat=22&lng=105',
      'lat=21&lng=105&radius=100&maxDistance=200', 'lat=21&lng=105&category[]=camera']) {
      assert.equal((await get(query)).status, 400);
    }
    assert.equal(calls, 0);
    const result = await get('lat=21&lng=105&radius=10000&category=camera&page=2&limit=10');
    assert.equal(result.status, 200);
    assert.equal(result.body.success, true);
    assert.deepEqual(pipeline[0].$geoNear.near, { type: 'Point', coordinates: [105, 21] });
    assert.equal(pipeline[0].$geoNear.maxDistance, 10000);
    assert.deepEqual(pipeline[0].$geoNear.query, {
      status: 'available', isDeleted: false,
      moderationStatus: { $in: ['approved', null] }, category: /^camera$/i,
    });
    assert.deepEqual(pipeline[1].$sort, { distanceMeters: 1, _id: 1 });
    assert.deepEqual(pipeline[2].$facet.data, [{ $skip: 10 }, { $limit: 10 }]);
    assert.deepEqual(result.body.pagination, { page: 2, limit: 10, totalItems: 21, totalPages: 3, hasNextPage: true });
    assert.equal(result.body.data[0].title, 'Test camera');
    assert.equal(result.body.data[0].dailyRate, 100);
    assert.equal(result.body.data[0].distanceMeters, 12);
    assert.ok(Device.schema.indexes().some(([key]) => key.location === '2dsphere'));
    await get('lat=21&lng=105&radius=10000&category=all&page=1&limit=100');
    assert.equal(pipeline[0].$geoNear.query.category, undefined);
    assert.equal(pipeline[2].$facet.data[1].$limit, 10);
    empty = true;
    const emptyResult = await get('lat=21&lng=105&radius=10000&page=1&limit=10');
    assert.deepEqual(emptyResult.body.data, []);
    assert.equal(emptyResult.body.pagination.hasNextPage, false);
    empty = false;
    fail = true;
    assert.equal((await get('lat=21&lng=105&page=1&limit=10')).status, 500);
    console.log('PASS isolated Nearby HTTP: validation, 10km, category/All, 10/page, distance order, pagination, response aliases, schema index, empty/error; no database connection or writes.');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
