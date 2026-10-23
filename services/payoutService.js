const Payout = require('../models/payout');
const Wallet = require('../models/wallet');
const ledger = require('./ledgerService');
const walletService = require('./walletService');
const payoutQueue = require('../queues/payoutQueue');
const generateReference = require('../utils/generateReference');
const { AppError } = require('../middleware/errorhandler');

function enqueue(payoutId) {
  return payoutQueue.add(
    'send-payout',
    { payoutId: String(payoutId) },
    { jobId: `payout-${payoutId}` }
  );
}

async function requestPayout({ userId, walletId, amountMinor, destination }) {
  const reference = generateReference('pay');

  const payout = await ledger.runInTransaction(async (session) => {
    const wallet = await Wallet.findOne({ _id: walletId, user: userId }).session(session);
    if (!wallet) throw new AppError(404, 'Wallet not found');

    await walletService.changeBalance(wallet._id, -amountMinor, session);

    const walletAccount = await ledger.getWalletAccount(wallet._id, session);
    const clearing = await ledger.getSystemAccount('payout_clearing', 'liability', wallet.currency, session);
    const currency = wallet.currency;

    const txn = await ledger.postTransaction(
      {
        reference,
        type: 'payout',
        description: 'Payout requested',
        entries: [
          { account: walletAccount._id, direction: 'debit', amountMinor, currency },
          { account: clearing._id, direction: 'credit', amountMinor, currency }
        ]
      },
      session
    );

    const [created] = await Payout.create(
      [{ wallet: wallet._id, ledgerTransaction: txn._id, amountMinor, currency, destination, status: 'queued' }],
      { session }
    );
    return created;
  });

  // Queue only after the database transaction has committed
  await enqueue(payout._id);
  return payout;
}

async function getPayout(userId, payoutId) {
  const payout = await Payout.findById(payoutId);
  if (!payout) throw new AppError(404, 'Payout not found');
  const owns = await Wallet.exists({ _id: payout.wallet, user: userId });
  if (!owns) throw new AppError(404, 'Payout not found');
  return payout;
}

async function sendToProvider(payout) {
  // TODO: call your payout provider here.
  // Send String(payout._id) as the provider's idempotency key or reference,
  // so a retried job can never pay out twice.
  return { reference: `prov_${payout._id}` };
}

// Called by the queue worker. Safe to retry.
async function processPayout(payoutId) {
  const payout = await Payout.findOneAndUpdate(
    { _id: payoutId, status: { $in: ['queued', 'processing'] } },
    { $set: { status: 'processing' }, $inc: { attempts: 1 } },
    { new: true }
  );
  if (!payout) return { skipped: true };

  try {
    const result = await sendToProvider(payout);
    await Payout.updateOne(
      { _id: payout._id, status: 'processing' },
      { $set: { status: 'sent', providerReference: result.reference, lastError: null } }
    );
    return { sent: true };
  } catch (err) {
    await Payout.updateOne({ _id: payout._id }, { $set: { lastError: err.message } });
    throw err; // lets the queue retry with backoff
  }
}

// Provider confirmed the money left: clearing -> cash
async function settlePayout(payoutId) {
  return ledger.runInTransaction(async (session) => {
    const payout = await Payout.findOneAndUpdate(
      { _id: payoutId, status: { $in: ['processing', 'sent'] } },
      { $set: { status: 'reconciled' } },
      { new: true, session }
    );
    if (!payout) return null;

    const clearing = await ledger.getSystemAccount('payout_clearing', 'liability', payout.currency, session);
    const cash = await ledger.getSystemAccount('platform_cash', 'asset', payout.currency, session);

    await ledger.postTransaction(
      {
        reference: generateReference('stl'),
        type: 'payout',
        description: `Payout ${payout._id} settled`,
        metadata: { payoutId: payout._id },
        entries: [
          { account: clearing._id, direction: 'debit', amountMinor: payout.amountMinor, currency: payout.currency },
          { account: cash._id, direction: 'credit', amountMinor: payout.amountMinor, currency: payout.currency }
        ]
      },
      session
    );
    return payout;
  });
}

// Retries exhausted or provider reported failure: give the money back
async function failAndRefund(payoutId, reason) {
  return ledger.runInTransaction(async (session) => {
    const payout = await Payout.findOneAndUpdate(
      { _id: payoutId, status: { $in: ['queued', 'processing', 'sent'] } },
      { $set: { status: 'failed', lastError: reason } },
      { new: true, session }
    );
    if (!payout) return null; // already failed or settled

    await walletService.changeBalance(payout.wallet, payout.amountMinor, session, { allowInactive: true });

    const walletAccount = await ledger.getWalletAccount(payout.wallet, session);
    const clearing = await ledger.getSystemAccount('payout_clearing', 'liability', payout.currency, session);

    await ledger.postTransaction(
      {
        reference: generateReference('rev'),
        type: 'reversal',
        description: `Payout ${payout._id} failed`,
        metadata: { payoutId: payout._id },
        entries: [
          { account: clearing._id, direction: 'debit', amountMinor: payout.amountMinor, currency: payout.currency },
          { account: walletAccount._id, direction: 'credit', amountMinor: payout.amountMinor, currency: payout.currency }
        ]
      },
      session
    );
    return payout;
  });
}

async function findByProviderReference(providerReference) {
  return Payout.findOne({ providerReference });
}

module.exports = {
  requestPayout,
  getPayout,
  processPayout,
  settlePayout,
  failAndRefund,
  findByProviderReference
};