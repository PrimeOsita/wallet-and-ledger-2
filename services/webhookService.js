const Idempotency = require('../models/idempotency');
const ledger = require('./ledgerService');
const walletService = require('./walletService');
const payoutService = require('./payoutService');
const { AppError } = require('../middleware/errorhandler');

const DEDUPE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function markProcessed(event, session) {
  return Idempotency.create(
    [
      {
        key: `webhook:${event.id}`,
        requestHash: event.type,
        status: 'completed',
        expiresAt: new Date(Date.now() + DEDUPE_TTL_MS)
      }
    ],
    { session }
  );
}

async function handleDeposit(event) {
  const { walletId, amountMinor, currency, reference } = event.data || {};
  if (!walletId || !Number.isSafeInteger(amountMinor) || amountMinor <= 0 || !currency || !reference) {
    throw new AppError(400, 'Invalid deposit data');
  }

  try {
    await ledger.runInTransaction(async (session) => {
      await markProcessed(event, session);
      await walletService.deposit(
        {
          walletId,
          amountMinor,
          currency,
          reference: `dep_${reference}`,
          description: 'Deposit',
          metadata: { eventId: event.id }
        },
        session
      );
    });
    return { processed: true };
  } catch (err) {
    // Same event id, or same provider reference, already processed
    if (err.code === 11000) return { duplicate: true };
    throw err;
  }
}

async function handlePayoutSuccess(event) {
  const payout = await payoutService.findByProviderReference(event.data && event.data.reference);
  // 404 makes the provider retry later, e.g. if this arrived before we saved the reference
  if (!payout) throw new AppError(404, 'Payout not found');
  const settled = await payoutService.settlePayout(payout._id);
  return settled ? { processed: true } : { duplicate: true };
}

async function handlePayoutFailed(event) {
  const payout = await payoutService.findByProviderReference(event.data && event.data.reference);
  if (!payout) throw new AppError(404, 'Payout not found');
  const reason = (event.data && event.data.reason) || 'Provider reported failure';
  const refunded = await payoutService.failAndRefund(payout._id, reason);
  return refunded ? { processed: true } : { duplicate: true };
}

async function handleEvent(event) {
  if (!event || !event.id || !event.type) throw new AppError(400, 'Invalid webhook payload');

  switch (event.type) {
    case 'deposit.success':
      return handleDeposit(event);
    case 'payout.success':
      return handlePayoutSuccess(event);
    case 'payout.failed':
      return handlePayoutFailed(event);
    default:
      return { ignored: true };
  }
}

module.exports = { handleEvent };