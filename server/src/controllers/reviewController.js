const mongoose = require('mongoose');
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const Device = require('../models/Device');
const User = require('../models/User');
const { createAndSendNotification } = require('../services/notificationService');

/**
 * Calculate and update reputation metrics for owner from the 'reviews' collection
 */
const calculateAndUpdateOwnerReputation = async (ownerId) => {
  if (!ownerId) return null;
  const validOwnerId = mongoose.Types.ObjectId.isValid(ownerId)
    ? new mongoose.Types.ObjectId(ownerId)
    : null;
  if (!validOwnerId) return null;

  const ownerReviews = await Review.find({
    ownerId: validOwnerId,
    $or: [
      { comment: { $exists: true, $ne: '' } },
      { rating: { $exists: true, $gte: 1 } },
    ],
  });

  const totalReviews = ownerReviews.length;
  let rating = 5.0;
  let ownerRating = 5.0;
  let trustScore = 100;

  if (totalReviews > 0) {
    const sumRating = ownerReviews.reduce((sum, r) => sum + (Number(r.rating) || 5), 0);
    rating = Number((sumRating / totalReviews).toFixed(1));

    const sumOwnerRating = ownerReviews.reduce(
      (sum, r) => sum + (Number(r.ownerRating) || Number(r.rating) || 5),
      0
    );
    ownerRating = Number((sumOwnerRating / totalReviews).toFixed(1));

    const avgScore = (rating + ownerRating) / 2;
    trustScore = Math.max(0, Math.min(100, Math.round((avgScore / 5) * 100)));
  }

  await User.findByIdAndUpdate(validOwnerId, {
    rating: ownerRating,
    totalReviews,
    'trust.score': trustScore,
  });

  return { rating, ownerRating, trustScore, totalReviews };
};

// @desc    Create a review for a completed booking
// @route   POST /api/reviews
// @access  Private
const createReview = async (req, res) => {
  try {
    const renterId = (req.auth && (req.auth.id || req.auth._id)) || (req.user && req.user._id);
    const { bookingId, rating, comment, ownerRating, ownerFeedback, images } = req.body;

    if (!bookingId) {
      return res.status(400).json({ success: false, message: 'Booking ID is required.' });
    }

    const numRating = Number(rating);
    if (!numRating || isNaN(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ success: false, message: 'Device rating must be between 1 and 5 stars.' });
    }

    if (!comment || !comment.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide review comments for the device.' });
    }

    const numOwnerRating = ownerRating ? Number(ownerRating) : 5;
    if (isNaN(numOwnerRating) || numOwnerRating < 1 || numOwnerRating > 5) {
      return res.status(400).json({ success: false, message: 'Owner service rating must be between 1 and 5 stars.' });
    }

    // Validate booking
    const booking = await Booking.findOne({ _id: bookingId, renterId }).populate('deviceId');
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Valid rental booking not found for your account.' });
    }

    if (booking.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Reviews can only be submitted for completed bookings.',
      });
    }

    if (booking.isReviewed) {
      return res.status(400).json({
        success: false,
        message: 'This booking has already been reviewed.',
      });
    }

    let review;
    const existingReview = await Review.findOne({ bookingId: booking._id });
    if (existingReview) {
      if (existingReview.comment && existingReview.comment.trim()) {
        booking.isReviewed = true;
        booking.reviewId = existingReview._id;
        await booking.save();
        return res.status(400).json({
          success: false,
          message: 'A review already exists for this booking in the system.',
        });
      }
      existingReview.rating = numRating;
      existingReview.comment = comment.trim();
      existingReview.ownerRating = numOwnerRating;
      existingReview.ownerFeedback = ownerFeedback ? ownerFeedback.trim() : '';
      existingReview.images = Array.isArray(images) ? images : [];
      await existingReview.save();
      review = existingReview;
    } else {
      review = await Review.create({
        bookingId: booking._id,
        deviceId: booking.deviceId._id || booking.deviceId,
        renterId,
        ownerId: booking.ownerId,
        reviewerId: renterId,
        targetType: 'device',
        rating: numRating,
        comment: comment.trim(),
        ownerRating: numOwnerRating,
        ownerFeedback: ownerFeedback ? ownerFeedback.trim() : '',
        images: Array.isArray(images) ? images : [],
      });
    }

    // Update booking state
    booking.isReviewed = true;
    booking.reviewId = review._id;
    if (!booking.timeline) booking.timeline = [];
    booking.timeline.push({
      status: 'reviewed',
      timestamp: new Date(),
      note: `Customer submitted review (${numRating}★ device, ${numOwnerRating}★ service)`,
    });
    await booking.save();

    // Recalculate average rating for Device
    try {
      const devId = booking.deviceId._id || booking.deviceId;
      const deviceReviews = await Review.find({
        deviceId: devId,
        comment: { $exists: true, $ne: '' },
      });
      if (deviceReviews.length > 0) {
        const totalRating = deviceReviews.reduce((sum, r) => sum + r.rating, 0);
        const ratingAvg = Number((totalRating / deviceReviews.length).toFixed(1));
        await Device.findByIdAndUpdate(devId, {
          'stats.ratingAvg': ratingAvg,
          'stats.ratingCount': deviceReviews.length,
        });
      }
    } catch (err) {
      console.error('Error recalculating rating for Device:', err.message);
    }

    // Recalculate reputation score for Owner
    try {
      if (booking.ownerId) {
        await calculateAndUpdateOwnerReputation(booking.ownerId);
      }
    } catch (err) {
      console.error('Error recalculating owner reputation:', err.message);
    }

    // Send real-time notification to owner
    if (booking.ownerId) {
      createAndSendNotification({
        userId: booking.ownerId,
        title: 'You Received a New Review! ⭐',
        body: `A customer left a ${numRating}-star review for your device and service (Order #${booking.bookingCode}).`,
        type: 'order',
        relatedId: review._id,
        data: {
          bookingId: booking._id.toString(),
          reviewId: review._id.toString(),
        },
      }).catch((err) => console.error('Error sending review notification:', err.message));
    }

    res.status(201).json({
      success: true,
      message: 'Thank you for submitting your review and feedback!',
      data: review,
    });
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ success: false, message: 'Server error while submitting review.' });
  }
};

// @desc    Get reviews for a device
// @route   GET /api/reviews/device/:deviceId
// @access  Public
const getDeviceReviews = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const reviews = await Review.find({
      deviceId,
      comment: { $exists: true, $ne: '' },
    })
      .populate('renterId', 'name avatar')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: reviews });
  } catch (error) {
    console.error('Error getting device reviews:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching device reviews.' });
  }
};

// @desc    Get review for a specific booking
// @route   GET /api/reviews/booking/:bookingId
// @access  Private
const getBookingReview = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const review = await Review.findOne({ bookingId })
      .populate('renterId', 'name avatar')
      .populate('ownerId', 'name avatar');

    if (!review) {
      return res.status(404).json({ success: false, message: 'No review found for this booking.' });
    }

    res.status(200).json({ success: true, data: review });
  } catch (error) {
    console.error('Error getting booking review:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching booking review.' });
  }
};

// @desc    Owner rates renter trust score after completed booking
// @route   PATCH /api/reviews/:reviewId/owner-rate
// @access  Private (Owner only)
const ownerRateRenter = async (req, res) => {
  try {
    const ownerId = (req.auth && (req.auth.id || req.auth._id)) || (req.user && req.user._id);
    const { reviewId } = req.params;
    const { renterTrustRating, renterFeedback } = req.body;

    const numRating = Number(renterTrustRating);
    if (!numRating || isNaN(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ success: false, message: 'Renter trust rating must be between 1 and 5 stars.' });
    }

    let review = await Review.findOne({
      $or: [{ _id: reviewId }, { bookingId: reviewId }],
      ownerId,
    });

    if (!review) {
      const booking = await Booking.findOne({ _id: reviewId, ownerId });
      if (!booking) {
        return res.status(404).json({ success: false, message: 'Valid booking or review not found.' });
      }
      if (booking.status !== 'completed') {
        return res.status(400).json({ success: false, message: 'Trust score rating is only available for completed bookings.' });
      }

      review = await Review.create({
        bookingId: booking._id,
        deviceId: booking.deviceId,
        renterId: booking.renterId,
        ownerId: booking.ownerId,
        reviewerId: ownerId,
        targetType: 'renter',
        rating: 5,
        comment: '',
        ownerRating: 5,
        ownerFeedback: '',
        renterTrustRating: numRating,
        renterFeedback: renterFeedback ? renterFeedback.trim() : '',
      });

      booking.reviewId = review._id;
      await booking.save();
    } else {
      if (review.renterTrustRating) {
        return res.status(400).json({ success: false, message: 'You have already rated the renter for this booking.' });
      }

      review.renterTrustRating = numRating;
      review.renterFeedback = renterFeedback ? renterFeedback.trim() : '';
      await review.save();
    }

    const TRUST_DELTA = { 5: 2, 4: 1, 3: 0, 2: -5, 1: -10 };
    const delta = TRUST_DELTA[numRating] ?? 0;

    if (delta !== 0) {
      try {
        const renter = await User.findById(review.renterId);
        if (renter) {
          const currentScore = renter.trust?.score ?? renter.trustScore ?? 100;
          const newScore = Math.max(0, Math.min(100, currentScore + delta));
          await User.findByIdAndUpdate(review.renterId, {
            'trust.score': newScore,
          });
        }
      } catch (err) {
        console.error('Error updating renter trust score:', err.message);
      }
    }

    try {
      const booking = await Booking.findById(review.bookingId);
      if (booking && booking.renterId) {
        const starEmoji = numRating >= 4 ? '⭐' : numRating >= 3 ? '🙂' : '⚠️';
        const deltaText = delta > 0 ? `Trust score +${delta} 🏆` : delta < 0 ? `Trust score ${delta} ⚠️` : 'Trust score unchanged.';
        createAndSendNotification({
          userId: booking.renterId,
          title: `Owner Rated Your Rental Experience ${starEmoji}`,
          body: `Order #${booking.bookingCode}: ${numRating}-star rating. ${deltaText}`,
          type: 'order',
          relatedId: review._id,
          data: { bookingId: booking._id.toString(), reviewId: review._id.toString() },
        }).catch((err) => console.error('Error sending owner-rate notification:', err.message));
      }
    } catch (err) {
      console.error('Error sending notification:', err.message);
    }

    res.status(200).json({
      success: true,
      message: 'Renter trust rating has been recorded successfully.',
      data: { renterTrustRating: numRating, delta },
    });
  } catch (error) {
    console.error('Error in ownerRateRenter:', error);
    res.status(500).json({ success: false, message: 'Server error while rating renter.' });
  }
};

// @desc    Get all reviews where current user is the owner
// @route   GET /api/reviews/my-owner-reviews
// @access  Private
const getMyOwnerReviews = async (req, res) => {
  try {
    const ownerId = (req.auth && (req.auth.id || req.auth._id)) || (req.user && req.user._id);
    const reviews = await Review.find({ ownerId })
      .populate('renterId', 'name avatar trust')
      .populate('deviceId', 'name title images')
      .populate('bookingId', 'bookingCode startDate endDate')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: reviews });
  } catch (error) {
    console.error('Error in getMyOwnerReviews:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching owner reviews.' });
  }
};

// @desc    Recalculate reputation for owner
// @route   POST /api/reviews/recalculate-reputation/:ownerId?
// @access  Private
const recalculateOwnerReputationController = async (req, res) => {
  try {
    const ownerId = req.params.ownerId || req.body.ownerId || (req.auth && (req.auth.id || req.auth._id)) || (req.user && req.user._id);
    const result = await calculateAndUpdateOwnerReputation(ownerId);
    res.status(200).json({
      success: true,
      message: 'Owner reputation successfully recalculated from reviews collection.',
      data: result,
    });
  } catch (error) {
    console.error('Error recalculating owner reputation:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error while recalculating owner reputation.' });
  }
};

module.exports = {
  createReview,
  getDeviceReviews,
  getBookingReview,
  ownerRateRenter,
  getMyOwnerReviews,
  recalculateOwnerReputationController,
};
