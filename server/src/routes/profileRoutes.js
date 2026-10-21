const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/authMiddleware');
const { getMyWishlist, toggleWishlist } = require('../controllers/profileController');

router.use(requireAuth);

// Wishlist endpoints
router.get('/wishlist', getMyWishlist);
router.post('/wishlist/toggle/:deviceId', toggleWishlist);

module.exports = router;
