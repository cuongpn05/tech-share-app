const express = require('express');
const {
  createReview,
  getDeviceReviews,
  getBookingReview,
  ownerRateRenter,
  getMyOwnerReviews,
  recalculateOwnerReputationController,
} = require('../controllers/reviewController');
const { requireAuth } = require('../middlewares/authMiddleware');

const router = express.Router();

router.post('/', requireAuth, createReview);
router.get('/device/:deviceId', getDeviceReviews);
router.get('/my-owner-reviews', requireAuth, getMyOwnerReviews);
router.get('/booking/:bookingId', requireAuth, getBookingReview);
router.patch('/:reviewId/owner-rate', requireAuth, ownerRateRenter);
router.post('/recalculate-reputation/:ownerId?', requireAuth, recalculateOwnerReputationController);

module.exports = router;
