const { Router } = require('express');
const { getNearbyDevices, getMyDevices } = require('../controllers/deviceController');
const { requireAuth } = require('../middlewares/authMiddleware');
const router = Router();
router.get('/nearby', getNearbyDevices);
router.get("/myDevices",requireAuth,getMyDevices);
module.exports = router;
