const express = require('express');
const router = express.Router();
const {
  sendEmailNotification,
  logNotification,
  getNotificationHistory
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/send-email', sendEmailNotification);
router.post('/log', logNotification);
router.get('/history', getNotificationHistory);

module.exports = router;
