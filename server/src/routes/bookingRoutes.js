const express = require('express');
const {
  createBooking,
  getDeviceBusyDates,
  getMyBookings,
  getBookingById,
} = require('../controllers/bookingController');
const { requireAuth } = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/', requireAuth, createBooking);
router.get('/busy-dates/:deviceId', getDeviceBusyDates);
router.get('/my-bookings', requireAuth, getMyBookings);
router.get('/:id', requireAuth, getBookingById);

module.exports = router;
