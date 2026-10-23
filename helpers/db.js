const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const MODELS = ['user', 'wallet', 'ledgerAccount', 'ledgerEntry', 'ledgerTransaction', 'payout', 'idempotency'];
let replSet;

async function connect() {
  MODELS.forEach((m) => require(`../../models/${m}`));
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  // Build indexes up front so the unique constraints are active
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
}

async function clear() {
  for (const c of Object.values(mongoose.connection.collections)) {
    await c.deleteMany({});
  }
}

async function disconnect() {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
}

module.exports = { connect, clear, disconnect };