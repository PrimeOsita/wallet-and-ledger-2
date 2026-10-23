const { Worker } = require('bullmq');
const connection = require('../.github/workflows/config/redis');
const payoutService = require('../services/payoutService');

function startPayoutWorker() {
  const worker = new Worker(
    'payouts',
    async (job) => payoutService.processPayout(job.data.payoutId),
    { connection, concurrency: 5 }
  );

  worker.on('failed', async (job, err) => {
    if (!job) return;
    const maxAttempts = job.opts.attempts || 1;
    console.error(`Payout job ${job.id} failed (attempt ${job.attemptsMade}/${maxAttempts}): ${err.message}`);
    if (job.attemptsMade >= maxAttempts) {
      try {
        await payoutService.failAndRefund(job.data.payoutId, err.message);
      } catch (refundErr) {
        console.error('Refund failed, needs manual review:', refundErr.message);
      }
    }
  });

  worker.on('error', (err) => console.error('Worker error:', err.message));
  return worker;
}

module.exports = { startPayoutWorker };