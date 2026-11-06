const Account = require('../models/Account');
const nodemailer = require('nodemailer');

// @desc    Get all accounts (with virtual currentBalance)
// @route   GET /api/accounts
// @access  Private
exports.getAccounts = async (req, res, next) => {
  try {
    const accounts = await Account.find({
      $or: [{ userId: req.user.id }, { sharedWith: req.user.id }],
      isDeleted: { $ne: true }
    }).populate('userId', 'name email').sort('name');

    // Calculate grand total including baseAmounts and all transactions
    let grandTotal = 0;
    accounts.forEach(acc => {
      grandTotal += acc.currentBalance;
    });

    res.status(200).json({
      success: true,
      count: accounts.length,
      grandTotal,
      data: accounts,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new account
// @route   POST /api/accounts
// @access  Private
exports.createAccount = async (req, res, next) => {
  try {
    req.body.userId = req.user.id;

    const baseVal = Number(req.body.baseAmount) || 0;
    if (baseVal !== 0) {
      req.body.transactions = [{
        amount: Math.abs(baseVal),
        type: baseVal > 0 ? 'plus' : 'minus',
        note: req.body.baseNote || '',
        date: Date.now()
      }];
    }
    req.body.baseAmount = 0;

    const account = await Account.create(req.body);

    res.status(201).json({
      success: true,
      data: account,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update account (name, phone, email, baseNote)
// @route   PUT /api/accounts/:id
// @access  Private
exports.updateAccount = async (req, res, next) => {
  try {
    const { name, phone, email, baseNote } = req.body;
    let account = await Account.findOne({ _id: req.params.id, userId: req.user.id, isDeleted: { $ne: true } });

    if (!account) {
      return res.status(404).json({ success: false, error: 'Account not found or you are not the owner' });
    }

    if (name) account.name = name;
    if (phone !== undefined) account.phone = phone;
    if (email !== undefined) account.email = email;
    if (baseNote !== undefined) account.baseNote = baseNote;

    await account.save();

    res.status(200).json({
      success: true,
      data: account,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add a transaction (+ or -) to an account
// @route   POST /api/accounts/:id/transaction
// @access  Private
exports.addTransaction = async (req, res, next) => {
  try {
    const { amount, type, note, proofImage } = req.body;

    if (!amount || !type) {
      return res.status(400).json({ success: false, error: 'Please provide amount and type (plus/minus)' });
    }

    const account = await Account.findOne({ _id: req.params.id, userId: req.user.id, isDeleted: { $ne: true } });

    if (!account) {
      return res.status(404).json({ success: false, error: 'Account not found or you are not the owner' });
    }

    account.transactions.push({
      amount: Number(amount),
      type,
      note,
      proofImage,
      date: Date.now()
    });

    await account.save();

    res.status(200).json({
      success: true,
      data: account,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a transaction from an account
// @route   DELETE /api/accounts/:id/transaction/:transactionId
// @access  Private
exports.deleteTransaction = async (req, res, next) => {
  try {
    const account = await Account.findOne({ _id: req.params.id, userId: req.user.id, isDeleted: { $ne: true } });

    if (!account) {
      return res.status(404).json({ success: false, error: 'Account not found or you are not the owner' });
    }

    const trxIndex = account.transactions.findIndex(
      (t) => t._id.toString() === req.params.transactionId
    );

    if (trxIndex === -1) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    account.transactions.splice(trxIndex, 1);

    await account.save();

    res.status(200).json({
      success: true,
      data: account,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Soft Delete account
// @route   DELETE /api/accounts/:id
// @access  Private
exports.deleteAccount = async (req, res, next) => {
  try {
    const account = await Account.findOne({ _id: req.params.id, userId: req.user.id, isDeleted: { $ne: true } });

    if (!account) {
      return res.status(404).json({ success: false, error: 'Account not found or you are not the owner' });
    }

    account.isDeleted = true;
    account.deletedAt = Date.now();
    await account.save();

    res.status(200).json({
      success: true,
      data: account,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all soft deleted accounts
// @route   GET /api/accounts/deleted
// @access  Private
exports.getDeletedAccounts = async (req, res, next) => {
  try {
    const accounts = await Account.find({
      userId: req.user.id,
      isDeleted: true
    }).populate('userId', 'name email').sort('-deletedAt');

    res.status(200).json({
      success: true,
      count: accounts.length,
      data: accounts,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Restore a soft deleted account
// @route   PUT /api/accounts/:id/restore
// @access  Private
exports.restoreAccount = async (req, res, next) => {
  try {
    const account = await Account.findOne({ _id: req.params.id, userId: req.user.id, isDeleted: true });

    if (!account) {
      return res.status(404).json({ success: false, error: 'Deleted account not found' });
    }

    account.isDeleted = false;
    account.deletedAt = null;
    await account.save();

    res.status(200).json({
      success: true,
      data: account,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Permanently delete account
// @route   DELETE /api/accounts/:id/hard
// @access  Private
exports.hardDeleteAccount = async (req, res, next) => {
  try {
    const account = await Account.findOne({ _id: req.params.id, userId: req.user.id, isDeleted: true });

    if (!account) {
      return res.status(404).json({ success: false, error: 'Deleted account not found' });
    }

    await account.deleteOne();

    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Share an account with another user (Read-only)
// @route   POST /api/accounts/:id/share
// @access  Private
exports.shareAccount = async (req, res, next) => {
  try {
    const { targetUserId } = req.body;
    
    if (!targetUserId) {
      return res.status(400).json({ success: false, error: 'Please provide target User ID' });
    }

    const account = await Account.findOne({ _id: req.params.id, userId: req.user.id, isDeleted: { $ne: true } });

    if (!account) {
      return res.status(404).json({ success: false, error: 'Account not found or you are not the owner' });
    }

    if (targetUserId === req.user.id) {
       return res.status(400).json({ success: false, error: 'Cannot share with yourself' });
    }

    if (!account.sharedWith.includes(targetUserId)) {
      account.sharedWith.push(targetUserId);
      await account.save();
    }

    res.status(200).json({ success: true, data: account });
  } catch (error) {
    next(error);
  }
};

// @desc    Share all personal accounts with another user
// @route   POST /api/accounts/share-all
// @access  Private
exports.shareAllAccounts = async (req, res, next) => {
  try {
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ success: false, error: 'Please provide target User ID' });
    }

    if (targetUserId === req.user.id) {
      return res.status(400).json({ success: false, error: 'Cannot share with yourself' });
    }

    await Account.updateMany(
      { userId: req.user.id },
      { $addToSet: { sharedWith: targetUserId } }
    );

    res.status(200).json({ success: true, message: 'All accounts shared successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all accounts for all users (Admin only)
// @route   GET /api/accounts/admin/all
// @access  Private/Admin
exports.getAllAccountsAdmin = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Access denied: Admin only' });
    }

    const accounts = await Account.find({ isDeleted: { $ne: true } })
      .select('-transactions.proofImage')
      .populate('userId', 'name email')
      .sort('name');

    res.status(200).json({
      success: true,
      count: accounts.length,
      data: accounts,
    });
  } catch (error) {
    next(error);
  }
};

exports.emailStatement = async (req, res, next) => {
  let email;
  let filename;
  let pdfData;
  let subject;
  let message;
  try {
    ({ email, filename, pdfData, subject, message } = req.body);
    if (!email || !pdfData) {
      return res.status(400).json({ success: false, error: 'Please provide email and pdfData' });
    }

    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailSubject = subject || `📊 Smart Notebook - Statement: ${filename.replace('.pdf', '')}`;
    const mailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #f8fafc; padding: 32px; border-radius: 12px; border: 1px solid rgba(99, 102, 241, 0.15);">
        <h2 style="color: #6366f1; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px;">📊 Account Statement / হিসাব বিবরণী</h2>
        <div style="color: #cbd5e1; font-size: 1rem; line-height: 1.6; margin-bottom: 24px; white-space: pre-wrap;">
          ${message || 'Please find attached the requested account statement PDF file.'}
        </div>
        <p style="color: #94a3b8; font-size: 0.9rem; font-style: italic; background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 6px; display: inline-block;">
          Attached PDF: <strong>${filename}</strong>
        </p>
        <p style="color: #64748b; font-size: 0.85rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 16px; margin-top: 24px;">
          Sent automatically by Smart Notebook. Please do not reply to this email.
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: `"Smart Notebook" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: mailSubject,
      html: mailHtml,
      attachments: [
        {
          filename: filename,
          content: pdfData,
          encoding: 'base64'
        }
      ]
    });

    res.status(200).json({ success: true, message: 'Statement emailed successfully' });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('\n--- 📊 DEVELOPMENT EMAIL STATEMENT BYPASS 📊 ---');
      console.log(`To: ${email}`);
      console.log(`Filename: ${filename}`);
      console.log(`PDF Size: ~${pdfData ? Math.round(pdfData.length * 0.75 / 1024) : 0} KB`);
      console.log('------------------------------------------------\n');
      
      return res.status(200).json({
        success: true,
        message: 'Statement generated and simulated (Development Mode)'
      });
    }
    next(error);
  }
};
