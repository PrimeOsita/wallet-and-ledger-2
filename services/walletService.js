const Wallet = require('../models/wallet');
const LedgerAccount = require('../models/ledgerAccount');
const LedgerEntry = require('../models/ledgerEntry');
const ledger = require('./ledgerService');
const generateReference = require('../utils/generateReference');
const { AppError } = require('../middleware/errorhandler');

async function createWallet(userId, currency) {
  try {
    return await ledger.runInTransaction(async (session) => {
      const [wallet] = await Wallet.create([{ user: userId, currency }], { session });
      await LedgerAccount.create(
        [{ name: `wallet:${wallet._id}`, type: 'liability', wallet: wallet._id, currency }],
        { session }
      );
      return wallet;
    });
  } catch (err) {
    if (err.code === 11000) {
      throw new AppError(409, 'You already have a wallet in this currency');
    }
    throw err;
  }
}

async function getWallet(userId, walletId) {
  const wallet = await Wallet.findOne({ _id: walletId, user: userId });
  if (!wallet) throw new AppError(404, 'Wallet not found');
  return wallet;
}

// The only function that changes a balance. delta > 0 credits, delta < 0 debits.
async function changeBalance(walletId, delta, session, { allowInactive = false } = {}) {
  const filter = { _id: walletId };
  if (!allowInactive) filter.status = 'active';
  if (delta < 0) filter.balanceMinor = { $gte: -delta };

  const updated = await Wallet.findOneAndUpdate(
    filter,
    { $inc: { balanceMinor: delta, version: 1 } },
    { new: true, session }
  );

  if (!updated) {
    const existing = await Wallet.findById(walletId).session(session);
    if (!existing) throw new AppError(404, 'Wallet not found');
    if (existing.status !== 'active' && !allowInactive) {
      throw new AppError(422, 'Wallet is not active');
    }
    throw new AppError(422, 'Insufficient funds', 'INSUFFICIENT_FUNDS');
  }
  return updated;
}

// Money arriving from outside (called from the webhook service, inside its transaction)
async function deposit({ walletId, amountMinor, currency, reference, description, metadata }, session) {
  const wallet = await changeBalance(walletId, amountMinor, session);
  if (wallet.currency !== currency) throw new AppError(422, 'Currency mismatch');

  const walletAccount = await ledger.getWalletAccount(walletId, session);
  const cash = await ledger.getSystemAccount('platform_cash', 'asset', currency, session);

  return ledger.postTransaction(
    {
      reference,
      type: 'deposit',
      description,
      metadata,
      entries: [
        { account: cash._id, direction: 'debit', amountMinor, currency },
        { account: walletAccount._id, direction: 'credit', amountMinor, currency }
      ]
    },
    session
  );
}

async function transfer({ userId, fromWalletId, toWalletId, amountMinor, description }) {
  if (String(fromWalletId) === String(toWalletId)) {
    throw new AppError(400, 'Cannot transfer to the same wallet');
  }
  const reference = generateReference('txn');

  return ledger.runInTransaction(async (session) => {
    const from = await Wallet.findOne({ _id: fromWalletId, user: userId }).session(session);
    if (!from) throw new AppError(404, 'Source wallet not found');
    const to = await Wallet.findById(toWalletId).session(session);
    if (!to) throw new AppError(404, 'Destination wallet not found');
    if (from.currency !== to.currency) throw new AppError(422, 'Wallets must share a currency');

    await changeBalance(from._id, -amountMinor, session);
    await changeBalance(to._id, amountMinor, session);

    const fromAccount = await ledger.getWalletAccount(from._id, session);
    const toAccount = await ledger.getWalletAccount(to._id, session);
    const currency = from.currency;

    const txn = await ledger.postTransaction(
      {
        reference,
        type: 'transfer',
        description,
        metadata: { fromWalletId: from._id, toWalletId: to._id },
        entries: [
          { account: fromAccount._id, direction: 'debit', amountMinor, currency },
          { account: toAccount._id, direction: 'credit', amountMinor, currency }
        ]
      },
      session
    );

    return {
      id: txn._id,
      reference,
      status: txn.status,
      amountMinor,
      currency,
      fromWalletId: from._id,
      toWalletId: to._id
    };
  });
}

async function getStatement(userId, walletId, { limit = 20, before } = {}) {
  const wallet = await getWallet(userId, walletId);
  const account = await ledger.getWalletAccount(wallet._id);
  const pageSize = Math.min(Math.max(Number(limit) || 20, 1), 100);

  const filter = { account: account._id };
  if (before) filter._id = { $lt: before };

  const entries = await LedgerEntry.find(filter).sort({ _id: -1 }).limit(pageSize).lean();
  return {
    balanceMinor: wallet.balanceMinor,
    currency: wallet.currency,
    entries,
    nextCursor: entries.length === pageSize ? entries[entries.length - 1]._id : null
  };
}

module.exports = { createWallet, getWallet, changeBalance, deposit, transfer, getStatement };