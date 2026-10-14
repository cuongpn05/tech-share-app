import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { startServer } from '../index.js';
import Device from '../models/Device.js';
import User from '../models/User.js';
import Account from '../models/Account.js';
import Booking from '../models/Booking.js';
import Dispute from '../models/Dispute.js';
import EkycRequest from '../models/EkycRequest.js';

process.env.NODE_ENV = 'test';

// Isolated HTTP integration. No MongoDB connection, seed, inserts, updates, or deletes.
let pipeline;
let databaseCalls = 0;
let failQuery = false;
let emptyQuery = false;
const deviceId = new mongoose.Types.ObjectId();
Device.aggregate = async stages => {
  databaseCalls++; pipeline = stages;
  if (!stages[0]?.$geoNear) return [{ _id: 'camera', count: 1 }];
  if (failQuery) throw new Error('Simulated database failure');
  return [{ data: emptyQuery ? [] : [{ _id: deviceId, name: 'Test camera', brand: 'Test', category: 'camera',
    pricePerDay: 100, ratingAvg: 4.5, ratingCount: 3, images: [], status: 'available', isDeleted: false,
    location: { type: 'Point', coordinates: [105, 21], address: 'Test area' }, distanceMeters: 12 }],
    total: emptyQuery ? [] : [{ count: 21 }] }];
};
Device.populate = async docs => docs;
Device.find = () => { databaseCalls++; return { lean: async () => [], then: resolve => Promise.resolve([]).then(resolve) }; };
for (const model of [Account, User, Device, Booking, Dispute, EkycRequest]) model.countDocuments = async () => 0;
Booking.aggregate = async () => [];
Booking.find = () => ({ lean: async () => [] });
User.findOne = () => ({ lean: async () => ({ _id: new mongoose.Types.ObjectId(), name: 'test-owner' }) });
process.env.PORT = '0';
process.env.MONGODB_URI = 'mongodb://isolated.invalid/iteration1';
let connectionAttempted = false;
mongoose.connect = async uri => { assert.equal(uri, process.env.MONGODB_URI); connectionAttempted = true; return mongoose; };
const server = await startServer();
assert.equal(connectionAttempted, true);
if (!server.listening) await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const get = async query => { const response = await fetch(`${base}/api/devices/nearby?${query}`); return { response, body: await response.json() }; };
try {
  assert.equal((await fetch(`${base}/api/health`)).status, 503);
  const invalid = ['', 'lat=abc&lng=105', 'lat=91&lng=105', 'lat=21&lng=181', 'lat=21&lng=105&radius=0',
    'lat=21&lng=105&radius=-1', 'lat=21&lat=22&lng=105', 'lat=21&lng=105&radius=100&maxDistance=200',
    'lat=21&lng=105&category[]=camera'];
  for (const query of invalid) assert.equal((await get(query)).response.status, 400, query);
  assert.equal(databaseCalls, 0);
  let result = await get('lat=21&lng=105&radius=10000&category=camera&page=2&limit=10');
  assert.equal(result.response.status, 200);
  assert.equal(result.body.success, true);
  assert.deepEqual(pipeline[0].$geoNear.near, { type: 'Point', coordinates: [105, 21] });
  assert.equal(pipeline[0].$geoNear.maxDistance, 10000);
  assert.deepEqual(pipeline[0].$geoNear.query, { status: 'available', isDeleted: false, category: 'camera' });
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
  emptyQuery = true;
  result = await get('lat=21&lng=105&radius=10000&page=1&limit=10');
  assert.deepEqual(result.body.data, []); assert.equal(result.body.pagination.hasNextPage, false);
  emptyQuery = false; failQuery = true;
  assert.equal((await get('lat=21&lng=105&page=1&limit=10')).response.status, 500);
  failQuery = false;
  for (const route of ['/api/devices/123', '/api/devices', '/api/profile/wishlist', '/api/bookings']) {
    assert.equal((await fetch(base + route)).status, 404);
  }
  assert.equal((await fetch(`${base}/api/auth/login`, { method: 'POST' })).status, 404);
  for (const route of ['/api/admin/dashboard','/api/admin/analytics','/api/owner/dashboard']) {
    const response = await fetch(base + route); assert.equal(response.status, 200, route);
    const body = await response.json(); assert.equal(body.success, true); assert.ok(body.data.kpis);
  }
  console.log('PASS isolated HTTP: public health, remote Admin/Owner routes, Nearby contract, category/all, pagination, GeoJSON, schema index, invalid input, empty/error, future routes 404.');
  console.log('NOT TESTED: live MongoDB execution/index, device GPS/UI.');
} finally { await new Promise(resolve => server.close(resolve)); }
