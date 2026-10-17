const { Router } = require('express');
const {
  getAvailableDevices,
  getNearbyDevices,
  getMyDevices,
  createDevice,
  uploadDeviceImage,
  getDeviceById,
} = require('../controllers/deviceController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { uploadFlexibleImage } = require('../middlewares/uploadMiddleware');

const router = Router();

router.get('/', getAvailableDevices);
router.get('/nearby', getNearbyDevices);
router.get('/myDevices', requireAuth, getMyDevices);
router.get('/:id', getDeviceById);
router.post('/upload-image', requireAuth, uploadFlexibleImage, uploadDeviceImage);
router.post('/', requireAuth, createDevice);

module.exports = router;
