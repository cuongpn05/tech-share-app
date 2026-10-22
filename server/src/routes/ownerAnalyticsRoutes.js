const express = require('express');
const { getOwnerAnalytics } = require('../controllers/ownerAnalyticsController');
const { requireAuth, requireRole } = require('../middlewares/authMiddleware');

const router = express.Router();

router.get('/analytics', requireAuth, requireRole('owner'), getOwnerAnalytics);

module.exports = router;
