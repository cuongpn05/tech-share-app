const assert = require('node:assert/strict');
const { test } = require('node:test');
const Booking = require('../src/models/Booking');
const Device = require('../src/models/Device');
const { getDashboardWindow, getPeriodAnalytics } = require('../src/services/adminDashboardAnalytics');

test('period windows use Vietnam calendar boundaries and year-to-date buckets', () => {
  const now = new Date('2026-12-31T18:00:00.000Z');
  const week = getDashboardWindow('7d', now);
  assert.equal(week.from.toISOString(), '2026-12-25T17:00:00.000Z');
  assert.equal(week.keys.length, 7);
  assert.equal(week.keys.at(-1), '2027-01-01');
  assert.equal(getDashboardWindow('30d', now).keys.length, 30);
  assert.equal(getDashboardWindow('90d', now).keys.length, 90);
  assert.deepEqual(getDashboardWindow('year', now).keys, ['2027-01']);
  assert.equal(getDashboardWindow(['7d'], now), null);
});

test('rental volume uses the completion date and booking statuses use the creation date', async t => {
  const window = getDashboardWindow('7d', new Date('2026-11-10T12:00:00.000Z'));
  const range = { $gte: window.from, $lte: window.to };
  t.mock.method(Booking, 'aggregate', async pipeline => {
    if (pipeline[0].$match.createdAt) {
      assert.deepEqual(pipeline[0].$match.createdAt, range);
      return [{ _id: 'pending', count: 3 }, { _id: 'completed', count: 2 }];
    }
    assert.deepEqual(pipeline[0].$match.timeline.$elemMatch, { status: 'completed', timestamp: range });
    assert.deepEqual(pipeline[2].$match.completedAt, range);
    assert.equal(pipeline[3].$group._id.$dateToString.timezone, 'Asia/Ho_Chi_Minh');
    return [{ _id: '2026-11-05', amount: 250000, count: 1 }, { _id: '2026-11-10', amount: 100000, count: 2 }];
  });

  const result = await getPeriodAnalytics('7d', window);
  assert.equal(result.grossRentalVolume, 350000);
  assert.equal(result.volumeBookingCount, 3);
  assert.equal(result.rentalVolumeTrend.length, 7);
  assert.deepEqual(result.rentalVolumeTrend[0], { date: '2026-11-04', amount: 0 });
  assert.deepEqual(result.rentalVolumeTrend[1], { date: '2026-11-05', amount: 250000 });
  assert.deepEqual(result.bookingStatuses, [{ status: 'pending', count: 3 }, { status: 'completed', count: 2 }]);
});

test('legacy overview aggregates real categories without duplicating aliases', async t => {
  const models = ['Account', 'User', 'Device', 'Booking', 'Dispute', 'EkycRequest', 'OwnerEkycRequest'];
  for (const name of models) t.mock.method(require(`../src/models/${name}`), 'countDocuments', async () => 0);
  t.mock.method(Booking, 'aggregate', async () => []);
  t.mock.method(Device, 'aggregate', async () => [
    { _id: ' Camera ', count: 3 }, { _id: 'cameras', count: 2 },
    { _id: 'drone', count: 1 }, { _id: 'gaming', count: 2 }, { _id: ' ', count: 9 },
  ]);
  const { getDashboardStats } = require('../src/controllers/adminController');
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
  await getDashboardStats({ query: {} }, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.data.analytics, undefined);
  assert.deepEqual(res.body.data.categoryBreakdown.map(({ id, count }) => [id, count]), [
    ['camera', 5], ['gaming', 2], ['drone', 1],
  ]);
  await getDashboardStats({ query: { period: 'today' } }, res);
  assert.equal(res.code, 400);
});

test('period dashboard requests require authentication', async () => {
  const express = require('express');
  const app = express();
  app.use('/admin', require('../src/routes/adminRoutes'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    for (const path of ['dashboard', 'analytics']) {
      const result = await fetch(`http://127.0.0.1:${server.address().port}/admin/${path}?period=7d`);
      assert.equal(result.status, 401);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
