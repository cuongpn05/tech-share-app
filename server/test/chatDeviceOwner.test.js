const assert = require('node:assert/strict');
const { test } = require('node:test');
const Booking = require('../src/models/Booking');
const Message = require('../src/models/Message');
const User = require('../src/models/User');
const notifications = require('../src/services/notificationService');

notifications.createAndSendNotification = async () => {};
const { getChatHistory, sendMessage, markChatMessagesAsRead } = require('../src/controllers/chatController');

const renter = { _id: 'a'.repeat(24), name: 'Renter' };
const seller = { _id: 'b'.repeat(24), name: renter.name };
const device = { _id: 'c'.repeat(24), ownerId: seller, name: 'Camera' };
const bookingId = 'd'.repeat(24);

test('chat opened for a booking resolves and messages the product owner', async () => {
  // The booking snapshot incorrectly points at the renter as owner.
  let bookingOwner = renter;
  Booking.findById = () => {
    const booking = { _id: bookingId, renterId: renter, ownerId: bookingOwner, deviceId: device._id };
    return {
      populate(path, select) {
        if (path.path === 'deviceId' && path.populate?.path === 'ownerId') booking.deviceId = device;
        if (path === 'deviceId' && select?.split(' ').includes('ownerId')) {
          booking.deviceId = { ...device, ownerId: seller._id };
        }
        return this;
      },
      then(resolve) { return resolve(booking); },
    };
  };
  User.findById = () => ({ select: async () => renter });
  Message.updateMany = async () => {};
  let historyFilter;
  Message.find = filter => {
    historyFilter = filter;
    return { sort() { return this; }, limit() { return this; }, lean: async () => [] };
  };
  Message.create = async data => ({ _id: 'e'.repeat(24), ...data });
  const req = { auth: { id: renter._id }, params: { bookingId }, body: { text: 'Hello' } };
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; } };

  await getChatHistory(req, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.data.otherUser._id, seller._id);
  assert.deepEqual(historyFilter.$or, [
    { senderId: renter._id, receiverId: seller._id },
    { senderId: seller._id, receiverId: renter._id },
  ]);

  await sendMessage(req, res);
  assert.equal(res.code, 201);
  assert.equal(res.body.data.receiverId, seller._id);

  req.auth.id = seller._id;
  await sendMessage(req, res);
  assert.equal(res.code, 201);
  assert.equal(res.body.data.receiverId, renter._id);

  bookingOwner = { _id: 'f'.repeat(24), name: 'Old seller' };
  req.auth.id = bookingOwner._id;
  for (const action of [getChatHistory, sendMessage, markChatMessagesAsRead]) {
    await action(req, res);
    assert.equal(res.code, 403);
  }
});
