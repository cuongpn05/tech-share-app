import 'dotenv/config';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
// Disable Mongoose's implicit DDL before models are registered. Never start the production entry or call Login.
mongoose.set('autoIndex', false);
mongoose.set('autoCreate', false);
const { default: Device } = await import('../models/Device.js');
const { app } = await import('../app.js');
let server;
const watchdog = setTimeout(() => { console.error('Live read-only verification timed out after 30s; no writes performed.'); process.exit(1); }, 30000);
try {
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 15000 });
  assert.ok((await Device.collection.indexes()).some(index => index.key.location === '2dsphere'), 'Existing location 2dsphere index is missing; no index was created.');
  console.log('PASS live MongoDB connection and existing 2dsphere index (read-only).');
  const all = await Device.find({}).select('_id name category status isDeleted location').lean();
  const center = all.find(d => d.status === 'available' && d.isDeleted === false && d.location?.coordinates?.length === 2);
  assert.ok(center, 'No available device with coordinates; live Nearby data checks cannot run.');
  const [lng,lat] = center.location.coordinates;
  const radians = n => n * Math.PI / 180;
  const distance = d => {
    const [x,y] = d.location.coordinates;
    const a = Math.sin(radians(y-lat)/2)**2 + Math.cos(radians(lat))*Math.cos(radians(y))*Math.sin(radians(x-lng)/2)**2;
    return 6378100 * 2 * Math.asin(Math.sqrt(Math.min(1,a)));
  };
  const expected = all.filter(d => d.status === 'available' && d.isDeleted === false && d.location?.coordinates?.length === 2 && distance(d) <= 10000)
    .sort((a,b) => distance(a)-distance(b) || String(a._id).localeCompare(String(b._id)));
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${base}/api/health`)).status,200);
  for (const category of ['all','smartphone','laptop','camera','drone','audio','tablet','accessory']) {
    const expectedCategory = expected.filter(d => category === 'all' || d.category === category);
    const actual = [];
    const pageCount = Math.max(1,Math.ceil(expectedCategory.length/10));
    for (let page=1;page<=pageCount;page++) {
      const response = await fetch(`${base}/api/devices/nearby?${new URLSearchParams({lat,lng,radius:10000,category,page,limit:10})}`);
      assert.equal(response.status,200);
      const body = await response.json();
      assert.equal(body.success,true); assert.equal(body.pagination.page,page); assert.equal(body.pagination.limit,10);
      assert.equal(body.pagination.totalItems,expectedCategory.length);
      assert.equal(body.pagination.hasNextPage,page < Math.ceil(expectedCategory.length/10));
      assert.ok(body.data.length <= 10);
      for (const d of body.data) {
        assert.equal(d.status,'available'); assert.equal(d.isDeleted,false);
        assert.equal(d.location.type,'Point'); assert.ok(d.distanceMeters <= 10000);
        assert.equal(typeof d.title,'string'); assert.equal(typeof d.dailyRate,'number');
        if(category !== 'all') assert.equal(d.category,category);
      }
      actual.push(...body.data);
    }
    assert.equal(new Set(actual.map(d=>d._id)).size,actual.length);
    assert.deepEqual(actual.map(d=>d._id),expectedCategory.map(d=>String(d._id)));
    for(let i=1;i<actual.length;i++) assert.ok(actual[i].distanceMeters >= actual[i-1].distanceMeters);
    console.log(`PASS live category=${category}: ${actual.length} devices, ${pageCount} page(s), radius/order/contract.`);
  }
  const invalid = await fetch(`${base}/api/devices/nearby?lat=91&lng=105&page=1&limit=10`);
  assert.equal(invalid.status,400);
  const empty = await fetch(`${base}/api/devices/nearby?lat=0&lng=0&radius=1&page=1&limit=10`);
  assert.equal(empty.status,200);
  console.log('PASS live read-only Nearby, Categories and pagination; no Login, seed, writes or DDL executed.');
} catch(error) {
  console.error(error.name === 'AssertionError' ? error.message : `Read-only verification failed: ${error.name}; code=${/^[A-Z0-9_]+$/.test(String(error.code)) ? error.code : 'unavailable'} (connection details omitted).`);
  process.exitCode=1;
} finally {
  if(server) await new Promise(resolve=>server.close(resolve));
  await mongoose.disconnect();
  clearTimeout(watchdog);
}
