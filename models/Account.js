const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ['plus', 'minus'],
      required: true,
    },
    note: {
      type: String,
      default: '',
      trim: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    proofImage: {
      type: String,
      default: '',
    },
  }
);

const accountSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },
    sharedWith: [{
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    }],
    name: {
      type: String,
      required: [true, 'Please add an account name'],
      trim: true,
    },
    baseAmount: {
      type: Number,
      default: 0,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    email: {
      type: String,
      default: '',
      trim: true,
    },
    baseNote: {
      type: String,
      default: '',
      trim: true,
    },
    transactions: [transactionSchema],
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Calculate current balance dynamically
accountSchema.virtual('currentBalance').get(function () {
  let balance = this.baseAmount;
  if (this.transactions && this.transactions.length > 0) {
    for (const trx of this.transactions) {
      if (trx.type === 'plus') {
        balance += trx.amount;
      } else if (trx.type === 'minus') {
        balance -= trx.amount;
      }
    }
  }
  return balance;
});

module.exports = mongoose.model('Account', accountSchema);
