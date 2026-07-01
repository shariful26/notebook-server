const express = require('express');
const {
  getAccounts,
  createAccount,
  addTransaction,
  deleteAccount,
  shareAccount,
  shareAllAccounts,
  getDeletedAccounts,
  restoreAccount,
  hardDeleteAccount,
  getAllAccountsAdmin,
  emailStatement
} = require('../controllers/accountsController');

const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.route('/email-statement')
  .post(emailStatement);

router.route('/admin/all')
  .get(getAllAccountsAdmin);

router.route('/deleted')
  .get(getDeletedAccounts);

router.route('/restore/:id')
  .put(restoreAccount);

router.route('/hard-delete/:id')
  .delete(hardDeleteAccount);

router.use(protect);

router.route('/')
  .get(getAccounts)
  .post(createAccount);

router.route('/share-all')
  .post(shareAllAccounts);

router.route('/:id/transaction')
  .post(addTransaction);

router.route('/:id/share')
  .post(shareAccount);

router.route('/:id')
  .delete(deleteAccount);

module.exports = router;
