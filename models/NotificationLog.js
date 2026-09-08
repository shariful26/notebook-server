const mongoose = require('mongoose');

const notificationLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },
    accountId: {
      type: mongoose.Schema.ObjectId,
      ref: 'Account',
      required: true,
    },
    accountName: {
      type: String,
      default: '',
    },
    recipientPhone: {
      type: String,
      default: '',
    },
    recipientEmail: {
      type: String,
      default: '',
    },
    channel: {
      type: String,
      enum: ['email', 'whatsapp', 'sms'],
      required: true,
    },
    templateType: {
      type: String,
      default: 'custom',
    },
    note: {
      type: String,
      default: '',
    },
    messageText: {
      type: String,
      default: '',
    },
    amount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['sent', 'opened', 'failed'],
      default: 'sent',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('NotificationLog', notificationLogSchema);
