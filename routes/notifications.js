const express = require('express');
const router = express.Router();
const {
  sendEmailNotification,
  logNotification,
  getNotificationHistory,
  deleteNotificationLog,
  deleteAllNotificationLogs
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/send-email', sendEmailNotification);
router.post('/log', logNotification);
router.get('/history', getNotificationHistory);
router.delete('/', deleteAllNotificationLogs);
router.delete('/:id', deleteNotificationLog);

module.exports = router;
