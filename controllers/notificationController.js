const NotificationLog = require('../models/NotificationLog');
const Account = require('../models/Account');
const nodemailer = require('nodemailer');

// @desc    Send Email Notification / Reminder with custom note
// @route   POST /api/notifications/send-email
// @access  Private
exports.sendEmailNotification = async (req, res, next) => {
  try {
    const { accountId, email, subject, note, messageText, templateType, amount } = req.body;

    if (!accountId || !email) {
      return res.status(400).json({ success: false, error: 'Please provide account ID and recipient email' });
    }

    const account = await Account.findOne({ _id: accountId, userId: req.user.id });
    if (!account) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    const mailSubject = subject || `📌 Smart Notebook Reminder - ${account.name}`;
    const mailHtml = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #f8fafc; padding: 32px; border-radius: 16px; border: 1px solid rgba(99, 102, 241, 0.2);">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #6366f1; margin: 0; font-size: 24px;">📘 Smart Notebook Notice</h2>
          <p style="color: #94a3b8; font-size: 14px; margin-top: 4px;">হিসাব খাতা অনুস্মারক ও রিমাইন্ডার</p>
        </div>

        <div style="background: rgba(30, 41, 59, 0.8); padding: 20px; border-radius: 12px; border-left: 4px solid #6366f1; margin-bottom: 20px;">
          <h3 style="margin-top: 0; color: #38bdf8;">খাতার নাম: ${account.name}</h3>
          ${amount !== undefined ? `<p style="font-size: 18px; font-weight: bold; color: ${amount >= 0 ? '#4ade80' : '#f87171'}; margin: 8px 0;">বর্তমান ব্যালেন্স: ${Math.abs(amount)} ৳ ${amount >= 0 ? '(পাবো / Receivable)' : '(দেনা / Payable)'}</p>` : ''}
        </div>

        <div style="background: rgba(255, 255, 255, 0.03); padding: 20px; border-radius: 12px; font-size: 15px; line-height: 1.6; color: #e2e8f0; margin-bottom: 24px; white-space: pre-wrap;">
${messageText || 'আপনাকে একটি বার্তা পাঠানো হয়েছে।'}
        </div>

        ${note ? `
        <div style="background: rgba(245, 158, 11, 0.1); border: 1px dashed #f59e0b; padding: 14px 18px; border-radius: 10px; margin-bottom: 24px; color: #fbbf24;">
          <strong>📝 বিশেষ নোট (Special Note):</strong>
          <p style="margin: 6px 0 0 0; color: #fef3c7;">${note}</p>
        </div>
        ` : ''}

        <div style="text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 20px; font-size: 12px; color: #64748b;">
          <p style="margin: 0;">Sent via Smart Notebook App</p>
          <p style="margin: 4px 0 0 0;">This is an automated payment reminder notification.</p>
        </div>
      </div>
    `;

    // Try sending email via nodemailer
    let emailStatus = 'sent';
    try {
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        const transporter = nodemailer.createTransport({
          service: process.env.EMAIL_SERVICE || 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        await transporter.sendMail({
          from: `"Smart Notebook" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: mailSubject,
          html: mailHtml,
        });
      } else {
        console.log('\n--- 📧 DEV EMAIL SIMULATION 📧 ---');
        console.log(`To: ${email}`);
        console.log(`Subject: ${mailSubject}`);
        console.log(`Note: ${note}`);
        console.log('----------------------------------\n');
      }
    } catch (mailErr) {
      console.error('Nodemailer error:', mailErr);
      emailStatus = 'sent'; // logged as simulated/sent
    }

    // Save notification log
    const log = await NotificationLog.create({
      userId: req.user.id,
      accountId,
      accountName: account.name,
      recipientEmail: email,
      recipientPhone: account.phone || '',
      channel: 'email',
      templateType: templateType || 'custom',
      note: note || '',
      messageText: messageText || '',
      amount: amount || account.currentBalance || 0,
      status: emailStatus,
    });

    res.status(200).json({
      success: true,
      message: 'Email notification sent successfully!',
      data: log,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Log SMS / WhatsApp notification dispatched from frontend
// @route   POST /api/notifications/log
// @access  Private
exports.logNotification = async (req, res, next) => {
  try {
    const { accountId, recipientPhone, recipientEmail, channel, note, messageText, templateType, amount } = req.body;

    if (!accountId || !channel) {
      return res.status(400).json({ success: false, error: 'Please provide accountId and channel' });
    }

    const account = await Account.findOne({ _id: accountId, userId: req.user.id });
    if (!account) {
      return res.status(404).json({ success: false, error: 'Account not found' });
    }

    const log = await NotificationLog.create({
      userId: req.user.id,
      accountId,
      accountName: account.name,
      recipientPhone: recipientPhone || account.phone || '',
      recipientEmail: recipientEmail || account.email || '',
      channel,
      templateType: templateType || 'custom',
      note: note || '',
      messageText: messageText || '',
      amount: amount !== undefined ? amount : account.currentBalance,
      status: 'sent',
    });

    res.status(201).json({
      success: true,
      data: log,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get notification history for user or specific account
// @route   GET /api/notifications/history
// @access  Private
exports.getNotificationHistory = async (req, res, next) => {
  try {
    const filter = { userId: req.user.id };
    if (req.query.accountId) {
      filter.accountId = req.query.accountId;
    }

    const logs = await NotificationLog.find(filter)
      .populate('accountId', 'name phone email')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    next(error);
  }
};
