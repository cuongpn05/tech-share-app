const { Router } = require('express');
const { getNearbyDevices } = require('../controllers/deviceController');
const router = Router();
router.get('/nearby', getNearbyDevices);
module.exports = router;
