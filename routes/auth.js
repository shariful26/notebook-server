const express = require('express');
const { register, login, getMe, getUsers, forgotPassword, resetPassword, updateProfileImage } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/profile-image', protect, updateProfileImage);
router.get('/users', protect, getUsers);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);

module.exports = router;
