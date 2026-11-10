const express = require('express');
const {
  createBooking,
  getDeviceBusyDates,
  getMyBookings,
  cancelBooking,
  getBookingById,
  requestExtension,
  getExtensionRequests,
  getExtensionRequestById,
  respondToExtensionRequest,
  updateBeforeRentalPhotos,
  updateAfterRentalPhotos,
  getOwnerBookings,
  updateBookingStatus,
  handoverBooking,
  completeBooking,
} = require('../controllers/bookingController');
const { requireAuth, requireRole } = require('../middlewares/authMiddleware');

const router = express.Router();
const { issueToken, verifyQr, limitHandover } = require('../controllers/handoverController');
router.post('/verify-qr', requireAuth, limitHandover, verifyQr);
router.post('/:id/handover-token', requireAuth, limitHandover, issueToken);
const extensionAction = (action) => (req, res, next) => {
  req.params.action = action;
  return respondToExtensionRequest(req, res, next);
};

router.post('/', requireAuth, createBooking);
router.get('/busy-dates/:deviceId', getDeviceBusyDates);
router.get('/my-bookings', requireAuth, getMyBookings);
router.get('/owner-bookings', requireAuth, getOwnerBookings);
router.get('/extension-requests', requireAuth, requireRole('owner', 'admin'), getExtensionRequests);
router.get('/extension-requests/:id', requireAuth, requireRole('owner', 'admin'), getExtensionRequestById);
router.patch('/extension-requests/:id/approve', requireAuth, requireRole('owner', 'admin'), extensionAction('approve'));
router.patch('/extension-requests/:id/reject', requireAuth, requireRole('owner', 'admin'), extensionAction('reject'));
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
