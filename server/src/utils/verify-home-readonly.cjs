// Run from server: node src/utils/verify-home-readonly.cjs. No writes or index creation.
require('dotenv').config();
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
mongoose.set('autoIndex', false);
mongoose.set('autoCreate', false);
const Device = require('../models/Device');
const express = require('express');
const routes = require('../routes/deviceRoutes');
const { errorHandler } = require('../middlewares/errorHandler');

function validLocation(device) {
  const point = device.location;
  return point?.type === 'Point' && point.coordinates?.length === 2 &&
    point.coordinates.every(Number.isFinite) && Math.abs(point.coordinates[0]) <= 180 &&
    Math.abs(point.coordinates[1]) <= 90;
}

function distanceMeters(from, to) {
  const rad = value => value * Math.PI / 180;
  const [lng, lat] = from;
  const [otherLng, otherLat] = to;
  const a = Math.sin(rad(otherLat - lat) / 2) ** 2 + Math.cos(rad(lat)) *
    Math.cos(rad(otherLat)) * Math.sin(rad(otherLng - lng) / 2) ** 2;
  return 6378100 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}

let server;
(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 15000,
    });
    const raw = await Device.collection.find({}).toArray();
    const visible = raw.filter(d => d.status === 'available' && d.isDeleted === false &&
      (d.moderationStatus === 'approved' || d.moderationStatus == null));
    const categories = [...new Set(visible.map(d => d.category.trim().toLowerCase()))].sort();
    assert.ok((await Device.collection.indexes()).some(index => index.key.location === '2dsphere'));
    console.log(JSON.stringify({ total: raw.length, public: visible.length, categories,
      invalidLocations: raw.filter(d => !validLocation(d)).length,
      missingCanonicalFields: visible.filter(d => !d.name || !Number.isFinite(d.pricePerDay)).length,
    }));
    const app = express();
    app.use('/api/devices', routes);
    app.use(errorHandler);
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/devices`;
    const get = async (path = '', params = {}) => {
      const response = await fetch(`${base}${path}?${new URLSearchParams(params)}`);
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.success, true);
      return body;
    };
    assert.deepEqual((await get('/categories')).data, categories);
    async function readPages(path, params, expected) {
      const actual = [];
      for (let page = 1; page <= Math.max(1, Math.ceil(expected.length / 10)); page++) {
        const body = await get(path, { ...params, page, limit: 10 });
        assert.equal(body.pagination.totalItems, expected.length);
        assert.equal(body.pagination.hasNextPage, page < Math.ceil(expected.length / 10));
        actual.push(...body.data);
      }
      assert.equal(new Set(actual.map(d => d._id)).size, actual.length);
      assert.deepEqual(actual.map(d => d._id), expected.map(d => String(d._id)));
      for (const d of actual) {
        assert.equal(d.title, d.name);
        assert.equal(d.dailyRate, d.pricePerDay);
        assert.ok(d.location == null || typeof d.location === 'object');
      }
      return actual;
    }
    const newest = [...visible].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt) ||
      String(a._id).localeCompare(String(b._id)));
    for (const category of ['all', ...categories]) {
      const expected = newest.filter(d => category === 'all' || d.category.trim().toLowerCase() === category);
      await readPages('', { category: ` ${category.toUpperCase()} ` }, expected);
      console.log(`PASS Home/category=${category}: ${expected.length}`);
    }
    const sample = newest.find(d => validLocation(d) && d.name.length > 5);
    assert.ok(sample);
    for (const category of categories) {
      const original = visible.find(d => d.category === category);
      const detail = (await get(`/${original._id}`)).data;
      assert.equal(detail._id, String(original._id));
      assert.equal(detail.name, original.name);
      assert.equal(detail.pricePerDay, original.pricePerDay);
      assert.equal(detail.title, original.name);
      assert.equal(detail.dailyRate, original.pricePerDay);
      assert.deepEqual(detail.images, original.images);
      assert.deepEqual(detail.specs, original.specs);
      assert.equal(detail.description, original.description);
      assert.equal(detail.location.addressText, original.location.addressText);
      if (detail.ownerId) {
        assert.equal(detail.ownerId._id, String(original.ownerId));
        assert.equal(typeof detail.ownerId.name, 'string');
      }
      console.log(`PASS live Device Detail ${category}: ID, name, daily price, images, specs, description, address, populated owner`);
    }
    assert.equal((await fetch(`${base}/not-an-id`)).status, 400);
    const absentId = new mongoose.Types.ObjectId().toString();
    assert.equal((await fetch(`${base}/${absentId}`)).status, 404);
    const partialName = sample.name.slice(1, Math.min(12, sample.name.length));
    for (const keyword of [sample.name, partialName, partialName.toUpperCase(),
      partialName.toLowerCase(), `  ${partialName}  `, 'no-device-with-this-name-832749', '', '   ', '[']) {
      const expected = newest.filter(d => d.name.toLowerCase().includes(keyword.trim().toLowerCase()));
      await readPages('', { q: keyword }, expected);
      console.log(`PASS search full/partial/case/trim/empty/literal: ${expected.length} result(s)`);
    }
    const expectedCategorySearch = newest.filter(d => d.category === sample.category &&
      d.name.toLowerCase().includes(partialName.toLowerCase()));
    await readPages('', { q: partialName, category: sample.category }, expectedCategorySearch);
    const [sampleLng, sampleLat] = sample.location.coordinates;
    const expectedNearbySearch = visible.filter(d => validLocation(d) &&
      d.name.toLowerCase().includes(partialName.toLowerCase()) &&
      distanceMeters([sampleLng, sampleLat], d.location.coordinates) <= 10000)
      .sort((a, b) => distanceMeters([sampleLng, sampleLat], a.location.coordinates) -
        distanceMeters([sampleLng, sampleLat], b.location.coordinates) || String(a._id).localeCompare(String(b._id)));
    await readPages('/nearby', { lat: sampleLat, lng: sampleLng, radius: 10000, q: partialName }, expectedNearbySearch);
    console.log('PASS search combined with Category/Nearby using current DB names and coordinates');
    const centers = visible.filter(validLocation).filter((d, i, list) =>
      list.findIndex(other => distanceMeters(other.location.coordinates, d.location.coordinates) < 100000) === i);
    assert.ok(centers.length > 0);
    for (const center of centers.slice(0, 3)) {
      const [lng, lat] = center.location.coordinates;
      for (const radius of [1000, 10000]) {
        for (const category of ['all', ...categories]) {
          const expected = visible.filter(d => validLocation(d) &&
            (category === 'all' || d.category.trim().toLowerCase() === category) &&
            distanceMeters([lng, lat], d.location.coordinates) <= radius)
            .sort((a, b) => distanceMeters([lng, lat], a.location.coordinates) -
              distanceMeters([lng, lat], b.location.coordinates) || String(a._id).localeCompare(String(b._id)));
          const actual = await readPages('/nearby', { lat, lng, radius, category }, expected);
          actual.forEach((d, i) => {
            assert.ok(d.distanceMeters <= radius);
            assert.ok(Math.abs(d.distanceMeters - distanceMeters([lng, lat], d.location.coordinates)) < 1);
            if (i) assert.ok(d.distanceMeters >= actual[i - 1].distanceMeters);
          });
        }
      }
      const unpaged = await get('/nearby', { lat, lng, radius: 10000 });
      assert.ok(unpaged.data.every(d => Number.isFinite(d.distanceMeters) && d.distanceMeters <= 10000));
      console.log('PASS Nearby simulated center from DB:', center.location.coordinates,
        '1/10 km, all categories, pagination, Haversine distance/order, unpaged contract');
    }
    assert.equal((await get('/nearby', { lat: 0, lng: 0, radius: 1, page: 1, limit: 10 })).data.length, 0);
    assert.equal((await get('', { q: 'no-device-with-this-name-832749', page: 1, limit: 10 })).data.length, 0);
    assert.equal((await get('', { q: '[', page: 1, limit: 10 })).data.length,
      visible.filter(d => d.name?.includes('[')).length);
    console.log('PASS real MongoDB → controller → routes → HTTP; empty and literal search; no writes.');
  } catch (error) {
    console.error(error.name === 'AssertionError' ? error.message : `Verification failed: ${error.name}`);
    process.exitCode = 1;
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
  }
})();
