const mongoose = require('mongoose');
const LedgerAccount = require('../models/ledgerAccount');
const LedgerEntry = require('../models/ledgerEntry');
const LedgerTransaction = require('../models/ledgerTransaction');

async function runInTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

// Internal accounts like platform_cash or payout_clearing, created on first use
async function getSystemAccount(name, type, currency, session) {
  const code = `${name}:${currency}`;
  return LedgerAccount.findOneAndUpdate(
    { code },
    { $setOnInsert: { name, code, type, currency, wallet: null } },
    { upsert: true, new: true, session }
  );
}

async function getWalletAccount(walletId, session) {
  const account = await LedgerAccount.findOne({ wallet: walletId }).session(session || null);
  if (!account) throw new Error(`No ledger account for wallet ${walletId}`);
  return account;
}

async function postTransaction({ reference, type, description, metadata, entries }, session) {
  if (!session) throw new Error('postTransaction must run inside a session');
  if (!Array.isArray(entries) || entries.length < 2) {
    throw new Error('A ledger transaction needs at least two entries');
  }

  const currency = entries[0].currency;
  let debits = 0;
  let credits = 0;
  for (const e of entries) {
    if (!Number.isSafeInteger(e.amountMinor) || e.amountMinor <= 0) {
      throw new Error('Entry amounts must be positive integers in minor units');
    }
    if (e.currency !== currency) throw new Error('All entries must share one currency');
    if (e.direction === 'debit') debits += e.amountMinor;
    else if (e.direction === 'credit') credits += e.amountMinor;
    else throw new Error(`Invalid direction: ${e.direction}`);
  }
  if (debits !== credits) throw new Error('Ledger transaction is not balanced');

  const [txn] = await LedgerTransaction.create(
    [{ reference, type, status: 'posted', description, metadata }],
    { session }
  );
  await LedgerEntry.insertMany(
    entries.map((e) => ({ ...e, transaction: txn._id })),
    { session }
  );
  return txn;
}


async function getAccountBalance(accountId, session) {
  const account = await LedgerAccount.findById(accountId).session(session || null);
  if (!account) throw new Error('Ledger account not found');

  const rows = await LedgerEntry.aggregate([
    { $match: { account: account._id } },
    { $group: { _id: '$direction', total: { $sum: '$amountMinor' } } }
  ]).session(session || null);

  const total = (dir) => (rows.find((r) => r._id === dir) || { total: 0 }).total;
  const debits = total('debit');
  const credits = total('credit');

  // Assets and expenses grow with debits; liabilities, revenue and equity with credits
  return ['asset', 'expense'].includes(account.type) ? debits - credits : credits - debits;
}

module.exports = {
  runInTransaction,
  getSystemAccount,
  getWalletAccount,
  postTransaction,
  getAccountBalance
};