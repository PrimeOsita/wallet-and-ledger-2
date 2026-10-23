const { Queue } = require('bullmq');
const connection = require('../.github/workflows/config/redis');

const payoutQueue = new Queue('payouts', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 1000,
    removeOnFail: 5000
  }
});

module.exports = payoutQueue;