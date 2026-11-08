const express = require('express');
const {
  createBooking,
  getDeviceBusyDates,
  getMyBookings,
  cancelBooking,
  getBookingById,
  requestExtension,
  updateBeforeRentalPhotos,
  updateAfterRentalPhotos,
  getOwnerBookings,
  updateBookingStatus,
  handoverBooking,
  completeBooking,
} = require('../controllers/bookingController');
const { requireAuth } = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/', requireAuth, createBooking);
router.get('/busy-dates/:deviceId', getDeviceBusyDates);
router.get('/my-bookings', requireAuth, getMyBookings);
router.get('/owner-bookings', requireAuth, getOwnerBookings);
router.patch('/:id/status', requireAuth, updateBookingStatus);
router.patch('/:id/handover', requireAuth, handoverBooking);
router.patch('/:id/complete', requireAuth, completeBooking);
router.put('/:id/cancel', requireAuth, cancelBooking);
router.post('/:id/extend', requireAuth, requestExtension);
router.patch('/:id/handover-renter', requireAuth, updateBeforeRentalPhotos);
router.patch('/:id/handover-owner', requireAuth, updateAfterRentalPhotos);
router.post('/:id/handover-owner', requireAuth, updateAfterRentalPhotos);
router.get('/:id', requireAuth, getBookingById);

module.exports = router;

