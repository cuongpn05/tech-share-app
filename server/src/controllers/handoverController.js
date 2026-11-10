const crypto = require('node:crypto');
const Booking = require('../models/Booking');
const Device = require('../models/Device');
const { createAndSendNotification } = require('../services/notificationService');
const { getIO } = require('../socket');
const hash = token => crypto.createHash('sha256').update(token).digest('hex');
const attempts = new Map();
function limitHandover(req, res, next) {
  const now = Date.now();
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
  const key = req.auth.id;
  const entry = attempts.get(key) || { count: 0, until: now + 60000 };
  attempts.set(key, entry);
  if (++entry.count > 20) return res.status(429).json({ message: 'Too many attempts. Please wait one minute.' });
  next();
}
async function issueToken(req, res) {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ message: 'Invalid booking ID.' });
  try {
    const token = crypto.randomBytes(32).toString('hex');
    const seconds = Number(process.env.HANDOVER_TOKEN_TTL_SECONDS || 300);
    const expiresAt = new Date(Date.now() + (Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 900) : 300) * 1000);
    const booking = await Booking.findOneAndUpdate({ _id: req.params.id, renterId: req.auth.id, status: 'approved' }, {
      $set: { 'handover.tokenHash': hash(token), 'handover.expiresAt': expiresAt },
      $unset: { 'handover.qrToken': 1 },
    }, { new: true });
    if (!booking) return res.status(409).json({ message: 'Only the renter of an approved booking can generate a QR code.' });
    res.json({ success: true, data: { payload: JSON.stringify({ type: 'TECHSHARE_HANDOVER', bookingId: String(booking._id), qrToken: token }), expiresAt } });
  } catch {
    res.status(500).json({ message: 'Unable to generate handover QR. Please retry.' });
  }
}
async function verifyQr(req, res) {
  const { bookingId, qrToken } = req.body || {};
  if (typeof bookingId !== 'string' || !/^[a-f\d]{24}$/i.test(bookingId) || typeof qrToken !== 'string' || !/^[a-f\d]{64}$/.test(qrToken)) return res.status(400).json({ message: 'Invalid handover QR payload.' });
  try {
    const existing = await Booking.findById(bookingId).select('ownerId');
    if (!existing) return res.status(404).json({ message: 'Booking not found.' });
    if (String(existing.ownerId) !== req.auth.id) return res.status(403).json({ message: 'Only the booking owner can verify handover.' });
    const now = new Date();
    const booking = await Booking.findOneAndUpdate({ _id: bookingId, ownerId: req.auth.id, status: 'approved', 'handover.tokenHash': hash(qrToken), 'handover.expiresAt': { $gt: now } }, {
      $inc: { __v: 1 },
      $set: { status: 'active', 'handover.handoverAt': now },
      $unset: { 'handover.tokenHash': 1, 'handover.expiresAt': 1, 'handover.qrToken': 1 },
      $push: { timeline: { status: 'active', timestamp: now, note: 'Handover verified via QR code scan.' } },
    }, { new: true });
    if (!booking) return res.status(409).json({ message: 'QR expired, replaced or already used, or booking is no longer approved. Refresh the booking and request a new QR.' });
    await Device.findByIdAndUpdate(booking.deviceId, { status: 'rented' }).catch(() => console.warn('Handover device status update failed'));
    const data = { bookingId, status: 'active', handoverAt: now, message: 'Your rental is now active.' };
    const io = getIO();
    if (io) for (const id of [booking.ownerId, booking.renterId]) io.to(`user_${id}`).emit('booking_status_updated', data);
    await createAndSendNotification({ userId: booking.renterId, title: 'Handover confirmed', body: data.message, type: 'order', relatedId: booking._id, data }).catch(() => {});
    res.json({ success: true, message: 'Handover verified successfully.', data: booking });
  } catch {
    res.status(500).json({ message: 'Unable to verify handover. Refresh the booking before retrying.' });
  }
}
module.exports = { issueToken, verifyQr, limitHandover };
