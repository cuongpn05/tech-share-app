const Booking = require('../models/Booking');

const periods = new Map([['7d', 7], ['30d', 30], ['90d', 90], ['year', null]]);
const timeZone = 'Asia/Ho_Chi_Minh';
const vietnamOffset = 7 * 60 * 60 * 1000;
const grossAmount = {
  $ifNull: ['$pricing.totalAmount', { $ifNull: ['$pricing.rentalFee', '$rentalFee'] }],
};

function getDashboardWindow(period, now = new Date()) {
  if (!periods.has(period)) return null;
  const localNow = new Date(now.getTime() + vietnamOffset);
  const monthly = period === 'year';
  const start = new Date(Date.UTC(
    localNow.getUTCFullYear(),
    monthly ? 0 : localNow.getUTCMonth(),
    monthly ? 1 : localNow.getUTCDate() - periods.get(period) + 1
  ));
  const format = monthly ? '%Y-%m' : '%Y-%m-%d';
  const keys = [];
  for (const day = new Date(start); day <= localNow;) {
    keys.push(day.toISOString().slice(0, monthly ? 7 : 10));
    if (monthly) day.setUTCMonth(day.getUTCMonth() + 1);
    else day.setUTCDate(day.getUTCDate() + 1);
  }
  return { from: new Date(start.getTime() - vietnamOffset), to: now, format, keys };
}

async function getPeriodAnalytics(period, { from, to, format, keys }) {
  const range = { $gte: from, $lte: to };
  const [statuses, volume] = await Promise.all([
    Booking.aggregate([
      { $match: { createdAt: range } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Booking.aggregate([
      { $match: { status: 'completed', timeline: { $elemMatch: { status: 'completed', timestamp: range } } } },
      { $addFields: { completedAt: { $reduce: {
        input: '$timeline',
        initialValue: null,
        in: { $cond: [
          { $and: [
            { $eq: ['$$this.status', 'completed'] },
            { $gt: ['$$this.timestamp', '$$value'] },
          ] },
          '$$this.timestamp',
          '$$value',
        ] },
      } } } },
      { $match: { completedAt: range } },
      { $group: {
        _id: { $dateToString: { date: '$completedAt', format, timezone: timeZone } },
        amount: { $sum: grossAmount },
        count: { $sum: 1 },
      } },
    ]),
  ]);

  const byDate = new Map(volume.map(point => [point._id, point.amount]));
  return {
    period,
    grossRentalVolume: volume.reduce((total, point) => total + point.amount, 0),
    volumeBookingCount: volume.reduce((total, point) => total + point.count, 0),
    rentalVolumeTrend: keys.map(date => ({ date, amount: byDate.get(date) ?? 0 })),
    bookingStatuses: statuses.map(row => ({ status: row._id || 'unknown', count: row.count })),
  };
}

module.exports = { getDashboardWindow, getPeriodAnalytics, grossAmount };
