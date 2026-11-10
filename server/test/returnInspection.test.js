const assert = require('node:assert/strict');
const { test } = require('node:test');
const Booking = require('../src/models/Booking');
const Device = require('../src/models/Device');
const User = require('../src/models/User');
const cloudinary = require('../src/utils/cloudinary');

cloudinary.uploadToCloudinary = async () => null;
const bookingController = require('../src/controllers/bookingController');
const ownerController = require('../src/controllers/ownerController');

const ownerId = 'a'.repeat(24);
const photos = ['front', 'back', 'edges', 'accessories'].map(angle => `/uploads/${angle}.jpg`);

function fixture(afterPhotos, status = 'active') {
  const saves = [];
  const deviceUpdates = [];
  const booking = {
    ownerId,
    deviceId: 'device',
    status,
    timeline: [],
    handover: { afterPhotos },
    async save() { saves.push(this.status); },
  };
  Booking.findById = () => ({ populate() { return this; }, then(resolve) { return resolve(booking); } });
  User.findById = () => ({ lean: async () => ({ _id: ownerId }) });
  User.findOne = () => ({ select() { return this; }, lean: async () => ({ _id: ownerId }) });
  Device.findByIdAndUpdate = async (id, update) => {
    deviceUpdates.push({ id, update, savedStatus: saves.at(-1) });
  };
  const req = { params: { id: 'booking' }, auth: { id: ownerId }, body: { status: 'completed' } };
  const res = { status(code) { this.code = code; return this; }, json() { return this; } };
  return { booking, req, res, saves, deviceUpdates };
}

for (const [name, complete] of [
  ['booking status', bookingController.updateBookingStatus],
  ['dedicated complete endpoint', bookingController.completeBooking],
  ['owner status', ownerController.updateBookingStatus],
]) {
  test(`${name} requires four distinct uploaded photos on an active booking`, async () => {
    for (const [savedPhotos, status] of [
      [[], 'active'],
      [[...photos.slice(0, 3), 'file:///camera.jpg'], 'active'],
      [[...photos.slice(0, 3), photos[0]], 'active'],
      [photos, 'approved'],
    ]) {
      const { booking, req, res, saves, deviceUpdates } = fixture(savedPhotos, status);
      await complete(req, res);
      assert.equal(res.code, 409);
      assert.equal(booking.status, status);
      assert.deepEqual(saves, []);
      assert.deepEqual(deviceUpdates, []);
    }

    const { req, res, saves, deviceUpdates } = fixture(photos);
    await complete(req, res);
    assert.equal(res.code, 200);
    assert.deepEqual(saves, ['completed']);
    assert.deepEqual(deviceUpdates, [{
      id: 'device',
      savedStatus: 'completed',
      update: { $set: { status: 'available' }, $inc: { 'stats.rentalCount': 1 } },
    }]);
  });
}

test('a failed return-photo upload preserves the saved inspection', async () => {
  const { booking, req, res, saves } = fixture(photos);
  req.body = { photos: [...photos.slice(0, 3), 'data:image/jpeg;base64,abc'] };
  await bookingController.updateAfterRentalPhotos(req, res);
  assert.equal(res.code, 422);
  assert.deepEqual(booking.handover.afterPhotos, photos);
  assert.deepEqual(saves, []);
});
