const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Generate JWT tokens
// Generate JWT tokens
const generateTokens = (id) => {
  const jwtSecret = process.env.JWT_SECRET || 'smart_notebook_jwt_secret_fallback_key_2024';
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'smart_notebook_refresh_fallback_secret_key_2024';

  const accessToken = jwt.sign({ id }, jwtSecret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
  
  const refreshToken = jwt.sign({ id }, jwtRefreshSecret, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });

  return { accessToken, refreshToken };
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    const user = await User.create({ name, email, password, role });
    const tokens = generateTokens(user._id);

    res.status(201).json({
      success: true,
      ...tokens,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, profileImage: user.profileImage || '' },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Please provide an email and password' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const tokens = generateTokens(user._id);

    res.status(200).json({
      success: true,
      ...tokens,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, profileImage: user.profileImage || '' },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile image
// @route   PUT /api/auth/profile-image
// @access  Private
exports.updateProfileImage = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    user.profileImage = req.body.profileImage;
    await user.save();
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all users for sharing
// @route   GET /api/auth/users
// @access  Private
exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find({ _id: { $ne: req.user.id } }).select('name email');
    res.status(200).json({ success: true, count: users.length, data: users });
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot password - send reset email
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  let user;
  let resetToken;
  let resetUrl;
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Please provide an email address' });
    }

    user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, error: 'No account found with that email' });
    }

    // Generate reset token and save hashed version to DB
    resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    // Build reset URL pointing to frontend
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    resetUrl = `${clientUrl}/reset-password/${resetToken}`;

    // Styled email body
    const htmlMessage = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #f8fafc; padding: 32px; border-radius: 12px;">
        <h2 style="color: #6366f1; margin-bottom: 16px;">🔑 Reset Your Password</h2>
        <p style="color: #94a3b8; margin-bottom: 24px;">
          You requested a password reset for your Smart Notebook account.
          Click the button below to set a new password. This link expires in <strong>10 minutes</strong>.
        </p>
        <a href="${resetUrl}" style="
          display: inline-block;
          background: linear-gradient(135deg, #6366f1, #ec4899);
          color: white;
          text-decoration: none;
          padding: 14px 28px;
          border-radius: 8px;
          font-weight: 600;
          margin-bottom: 24px;
        ">Reset Password</a>
        <p style="color: #64748b; font-size: 0.85rem;">
          If you didn't request this, you can safely ignore this email.<br/>
          Or copy this link: <a href="${resetUrl}" style="color: #6366f1;">${resetUrl}</a>
        </p>
      </div>
    `;

    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Smart Notebook" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: '🔑 Smart Notebook - Password Reset Request',
      html: htmlMessage,
    });

    res.status(200).json({ success: true, message: 'Password reset email sent' });

  } catch (error) {
    // In local development, bypass SMTP failures to allow testing fake/test emails
    if (process.env.NODE_ENV !== 'production' && user && resetToken && resetUrl) {
      console.log('\n--- 🔑 DEVELOPMENT PASSWORD RESET LINK 🔑 ---');
      console.log(`User Email: ${user.email}`);
      console.log(`Reset URL:  ${resetUrl}`);
      console.log('---------------------------------------------\n');
      
      return res.status(200).json({ 
        success: true, 
        message: 'Password reset link generated (Development Mode)',
        resetUrl: resetUrl 
      });
    }

    // Always clear the token if anything failed
    if (user) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });
    }

    // Specific hint for Gmail auth errors
    if (error.code === 'EAUTH') {
      console.error('❌ Gmail SMTP Auth failed.');
      console.error('   EMAIL_PASS must be a Gmail App Password (not your normal password).');
      console.error('   Generate one at: https://myaccount.google.com/apppasswords');
      return res.status(500).json({
        success: false,
        error: 'Email service configuration error. Please contact support.',
      });
    }

    next(error);
  }
};

// @desc    Reset password using token
// @route   PUT /api/auth/reset-password/:token
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }

    // Hash the raw URL token to match what's stored in DB
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, error: 'Invalid or expired reset token' });
    }

    // Update password and clear reset fields
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    const tokens = generateTokens(user._id);

    res.status(200).json({
      success: true,
      message: 'Password reset successful',
      ...tokens,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (error) {
    next(error);
  }
};
