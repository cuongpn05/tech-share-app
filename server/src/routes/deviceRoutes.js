const { Router } = require('express');
const {
  getAvailableDevices,
  getDeviceCategories,
  getNearbyDevices,
  getMyDevices,
  createDevice,
  uploadDeviceImage,
  getDeviceById,
  updateDeviceStatus,
  updateBlockedDates,
  deleteMyDevice,
} = require('../controllers/deviceController');
const { requireAuth } = require('../middlewares/authMiddleware');
const { uploadFlexibleImage } = require('../middlewares/uploadMiddleware');

const router = Router();

router.get('/', getAvailableDevices);
router.get('/categories', getDeviceCategories);
router.get('/nearby', getNearbyDevices);
router.get('/myDevices', requireAuth, getMyDevices);
router.patch('/:id/status', requireAuth, updateDeviceStatus);
router.patch('/:id/blocked-dates', requireAuth, updateBlockedDates);
router.delete('/:id', requireAuth, deleteMyDevice);
router.get('/:id', getDeviceById);
router.post('/upload-image', requireAuth, uploadFlexibleImage, uploadDeviceImage);
router.post('/', requireAuth, createDevice);

module.exports = router;
