const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const Booking = require('../src/models/Booking');
const Device = require('../src/models/Device');
const notifications = require('../src/services/notificationService');
const socket = require('../src/socket');
let notices = 0;
let events = [];
notifications.createAndSendNotification = async () => { notices++; };
socket.getIO = () => ({ to: room => ({ emit: (name, data) => events.push({ room, name, data }) }) });
Device.findByIdAndUpdate = async () => {};
const { issueToken, verifyQr } = require('../src/controllers/handoverController');
const id = 'a'.repeat(24);
const token = 'b'.repeat(64);
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
let booking;
Booking.findById = () => ({ select: async () => booking && { ownerId: booking.ownerId } });
Booking.findOneAndUpdate = async (query, update) => {
  if (!booking || query._id !== booking._id || query.status !== booking.status) return null;
  if (query.renterId && query.renterId !== booking.renterId) return null;
  if (query.ownerId && query.ownerId !== booking.ownerId) return null;
  if (query['handover.tokenHash'] && (query['handover.tokenHash'] !== booking.handover.tokenHash || booking.handover.expiresAt <= query['handover.expiresAt'].$gt)) return null;
  for (const [key, value] of Object.entries(update.$set || {})) {
    if (key.startsWith('handover.')) booking.handover[key.split('.')[1]] = value;
    else booking[key] = value;
  }
  for (const key of Object.keys(update.$unset || {})) delete booking.handover[key.split('.')[1]];
  if (update.$push) booking.timeline.push(update.$push.timeline);
  return booking;
};
function reset(status = 'approved') {
  notices = 0; events = [];
  booking = { _id: id, ownerId: 'owner', renterId: 'renter', deviceId: 'device', status, timeline: [], handover: { tokenHash: digest(token), expiresAt: new Date(Date.now() + 60000) } };
}
async function verify(user = 'owner', qrToken = token, bookingId = id) {
  const res = response();
  await verifyQr({ auth: { id: user }, body: { bookingId, qrToken } }, res);
  return res;
}
function response() { return { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } }; }
test('handover validation and single consumption', async t => {
  await t.test('valid scan records one timeline and private events', async () => {
    reset(); assert.equal((await verify()).code, 200); assert.equal(booking.status, 'active'); assert.equal(booking.timeline.length, 1); assert.equal(notices, 1); assert.equal(events.length, 2); assert.equal(booking.handover.tokenHash, undefined);
  });
  await t.test('unauthorized owner', async () => { reset(); assert.equal((await verify('other')).code, 403); assert.equal(booking.status, 'approved'); });
  await t.test('expired token', async () => { reset(); booking.handover.expiresAt = new Date(0); assert.equal((await verify()).code, 409); });
  await t.test('invalid token', async () => { reset(); assert.equal((await verify('owner', 'c'.repeat(64))).code, 409); });
  await t.test('wrong booking', async () => { reset(); assert.equal((await verify('owner', token, 'c'.repeat(24))).code, 409); });
  for (const status of ['pending', 'active', 'cancelled']) await t.test(`reject ${status}`, async () => { reset(status); assert.equal((await verify()).code, 409); assert.equal(booking.timeline.length, 0); });
  await t.test('concurrent scans and replay', async () => { reset(); const results = await Promise.all([verify(), verify()]); assert.deepEqual(results.map(r => r.code).sort(), [200, 409]); assert.equal((await verify()).code, 409); assert.equal(booking.timeline.length, 1); assert.equal(notices, 1); });
  await t.test('regeneration invalidates previous token', async () => { reset(); const res = response(); await issueToken({ auth: { id: 'renter' }, params: { id } }, res); assert.equal(res.code, 200); assert.equal((await verify()).code, 409); const fresh = JSON.parse(res.body.data.payload); assert.equal((await verify('owner', fresh.qrToken)).code, 200); });
  await t.test('other renter cannot issue', async () => { reset(); const res = response(); await issueToken({ auth: { id: 'other' }, params: { id } }, res); assert.equal(res.code, 409); });
  await t.test('malformed input', async () => { reset(); assert.equal((await verify('owner', '', 'bad')).code, 400); });
});
test('registered handover endpoints reject unauthenticated requests', async () => {
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use('/api/bookings', require('../src/routes/bookingRoutes'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    for (const path of ['/verify-qr', `/${id}/handover-token`]) {
      const res = await fetch(`http://127.0.0.1:${server.address().port}/api/bookings${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      assert.equal(res.status, 401);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test('verification attempts are limited', () => {
  const { limitHandover } = require('../src/controllers/handoverController');
  let allowed = 0;
  const res = response();
  for (let i = 0; i < 21; i++) limitHandover({ auth: { id: 'limited-user' } }, res, () => allowed++);
  assert.equal(allowed, 20);
  assert.equal(res.code, 429);
});
