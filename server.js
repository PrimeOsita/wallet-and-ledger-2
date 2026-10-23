require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./test/unit/test/integration/app');
const connectDB = require('./.github/workflows/config/db');
const { startPayoutWorker } = require('./queues/payoutWorker');

async function start() {
  await connectDB();

  const port = process.env.PORT || 3000;
  const server = app.listen(port, () => console.log(`Server listening on port ${port}`));

  const worker = process.env.RUN_WORKER !== 'false' ? startPayoutWorker() : null;

  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close();
    if (worker) await worker.close();
    await mongoose.connection.close();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});