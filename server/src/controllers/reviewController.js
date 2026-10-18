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
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5 stars.' });
    }

    if (!comment || !comment.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide review comments.' });
    }

    // Unified review: synchronize owner rating and feedback with overall rating & comment
    const numOwnerRating = ownerRating !== undefined && ownerRating !== null ? Number(ownerRating) : numRating;
    if (isNaN(numOwnerRating) || numOwnerRating < 1 || numOwnerRating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5 stars.' });
    }
    const finalOwnerFeedback = ownerFeedback !== undefined && ownerFeedback !== null && ownerFeedback.trim() !== ''
      ? ownerFeedback.trim()
      : comment.trim();

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
      existingReview.ownerFeedback = finalOwnerFeedback;
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
        ownerFeedback: finalOwnerFeedback,
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
      note: `Customer submitted review (${numRating}★)`,
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
  getMyOwnerReviews,
  recalculateOwnerReputationController,
};
