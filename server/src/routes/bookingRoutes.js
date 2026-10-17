const express = require('express');
const {
  createBooking,
  getDeviceBusyDates,
  getMyBookings,
  cancelBooking,
  getBookingById,
  requestExtension,
  updateBeforeRentalPhotos,
} = require('../controllers/bookingController');
const { requireAuth } = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/', requireAuth, createBooking);
router.get('/busy-dates/:deviceId', getDeviceBusyDates);
router.get('/my-bookings', requireAuth, getMyBookings);
router.put('/:id/cancel', requireAuth, cancelBooking);
router.post('/:id/extend', requireAuth, requestExtension);
router.patch('/:id/handover-renter', requireAuth, updateBeforeRentalPhotos);
router.get('/:id', requireAuth, getBookingById);

module.exports = router;

