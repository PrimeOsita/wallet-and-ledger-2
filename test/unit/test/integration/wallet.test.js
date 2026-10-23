jest.mock('../../queues/payoutQueue', () => ({ add: jest.fn().mockResolvedValue({}) }));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const db = require('../helpers/db');
const app = require('../../app');
const payoutQueue = require('../../queues/payoutQueue');
const payoutService = require('../../services/payoutService');
const User = require('../../models/user');
const Wallet = require('../../models/wallet');
const LedgerEntry = require('../../models/ledgerEntry');
const { sign } = require('../../utils/signature');

beforeAll(db.connect, 120000);
afterEach(async () => {
  await db.clear();
  jest.clearAllMocks();
});
afterAll(db.disconnect);

let counter = 0;
async function makeUser() {
  counter += 1;
  const user = await User.create({
    email: `user${counter}@test.com`,
    passwordHash: 'x',
    fullName: `User ${counter}`
  });
  const token = jwt.sign({}, process.env.JWT_SECRET, { subject: String(user._id) });
  return { user, token };
}

async function createWallet(token) {
  const res = await request(app)
    .post('/api/wallets')
    .set('Authorization', `Bearer ${token}`)
    .send({ currency: 'NGN' });
  return res.body.data;
}

function fund(walletId, amountMinor, eventId) {
  const body = JSON.stringify({
    id: eventId,
    type: 'deposit.success',
    data: { walletId, amountMinor, currency: 'NGN', reference: `ref_${eventId}` }
  });
  return request(app)
    .post('/api/webhooks')
    .set('Content-Type', 'application/json')
    .set('x-signature', sign(body, process.env.WEBHOOK_SECRET))
    .send(body);
}

function transfer(token, payload, key) {
  const req = request(app).post('/api/wallets/transfer').set('Authorization', `Bearer ${token}`);
  if (key) req.set('Idempotency-Key', key);
  return req.send(payload);
}

async function setupPair(startingBalance = 1000) {
  const alice = await makeUser();
  const bob = await makeUser();
  const aliceWallet = await createWallet(alice.token);
  const bobWallet = await createWallet(bob.token);
  if (startingBalance) await fund(aliceWallet._id, startingBalance, `evt_seed_${counter}`);
  return { alice, bob, aliceWallet, bobWallet };
}

async function balanceOf(walletId) {
  return (await Wallet.findById(walletId)).balanceMinor;
}

describe('webhooks', () => {
  test('rejects a bad signature', async () => {
    const res = await request(app)
      .post('/api/webhooks')
      .set('Content-Type', 'application/json')
      .set('x-signature', 'nope')
      .send('{}');
    expect(res.status).toBe(401);
  });

  test('a deposit credits the wallet once, even if the event is resent', async () => {
    const { aliceWallet } = await setupPair(0);
    const first = await fund(aliceWallet._id, 5000, 'evt_dup');
    const second = await fund(aliceWallet._id, 5000, 'evt_dup');

    expect(first.body.processed).toBe(true);
    expect(second.body.duplicate).toBe(true);
    expect(await balanceOf(aliceWallet._id)).toBe(5000);
  });
});

describe('transfers', () => {
  test('moves money and keeps the ledger balanced', async () => {
    const { alice, aliceWallet, bobWallet } = await setupPair(1000);
    const res = await transfer(
      alice.token,
      { fromWalletId: aliceWallet._id, toWalletId: bobWallet._id, amountMinor: 300 },
      'key-1'
    );

    expect(res.status).toBe(201);
    expect(await balanceOf(aliceWallet._id)).toBe(700);
    expect(await balanceOf(bobWallet._id)).toBe(300);

    const totals = await LedgerEntry.aggregate([
      { $group: { _id: '$direction', total: { $sum: '$amountMinor' } } }
    ]);
    const sum = (d) => totals.find((t) => t._id === d).total;
    expect(sum('debit')).toBe(sum('credit'));
  });

  test('refuses an overdraft and leaves balances alone', async () => {
    const { alice, aliceWallet, bobWallet } = await setupPair(100);
    const res = await transfer(
      alice.token,
      { fromWalletId: aliceWallet._id, toWalletId: bobWallet._id, amountMinor: 500 },
      'key-2'
    );

    expect(res.status).toBe(422);
    expect(await balanceOf(aliceWallet._id)).toBe(100);
    expect(await balanceOf(bobWallet._id)).toBe(0);
  });

  test('cannot spend from someone else\'s wallet', async () => {
    const { bob, aliceWallet, bobWallet } = await setupPair(1000);
    const res = await transfer(
      bob.token,
      { fromWalletId: aliceWallet._id, toWalletId: bobWallet._id, amountMinor: 100 },
      'key-3'
    );
    expect(res.status).toBe(404);
    expect(await balanceOf(aliceWallet._id)).toBe(1000);
  });

  test('requires an Idempotency-Key', async () => {
    const { alice, aliceWallet, bobWallet } = await setupPair(1000);
    const res = await transfer(
      alice.token,
      { fromWalletId: aliceWallet._id, toWalletId: bobWallet._id, amountMinor: 100 }
    );
    expect(res.status).toBe(400);
  });

  test('replays the same key instead of transferring twice', async () => {
    const { alice, aliceWallet, bobWallet } = await setupPair(1000);
    const payload = { fromWalletId: aliceWallet._id, toWalletId: bobWallet._id, amountMinor: 200 };

    const first = await transfer(alice.token, payload, 'same-key');
    const second = await transfer(alice.token, payload, 'same-key');

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.headers['idempotent-replay']).toBe('true');
    expect(second.body.data.reference).toBe(first.body.data.reference);
    expect(await balanceOf(aliceWallet._id)).toBe(800);
  });

  test('rejects a reused key with a different body', async () => {
    const { alice, aliceWallet, bobWallet } = await setupPair(1000);
    const base = { fromWalletId: aliceWallet._id, toWalletId: bobWallet._id };

    await transfer(alice.token, { ...base, amountMinor: 100 }, 'reused');
    const res = await transfer(alice.token, { ...base, amountMinor: 200 }, 'reused');
    expect(res.status).toBe(422);
  });

  test('concurrent transfers can never overdraw a wallet', async () => {
    const { alice, aliceWallet, bobWallet } = await setupPair(100);
    const payload = { fromWalletId: aliceWallet._id, toWalletId: bobWallet._id, amountMinor: 30 };

    const results = await Promise.all(
      [1, 2, 3, 4, 5].map((i) => transfer(alice.token, payload, `race-${i}`))
    );

    const ok = results.filter((r) => r.status === 201).length;
    const rejected = results.filter((r) => r.status === 422).length;
    expect(ok).toBe(3);
    expect(rejected).toBe(2);
    expect(await balanceOf(aliceWallet._id)).toBe(10);
    expect(await balanceOf(bobWallet._id)).toBe(90);
  });
});

describe('statement', () => {
  test('lists ledger entries for the wallet', async () => {
    const { alice, aliceWallet } = await setupPair(1000);
    const res = await request(app)
      .get(`/api/wallets/${aliceWallet._id}/statement`)
      .set('Authorization', `Bearer ${alice.token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.balanceMinor).toBe(1000);
    expect(res.body.data.entries).toHaveLength(1);
  });
});

describe('payouts', () => {
  test('debits the wallet and queues the job', async () => {
    const { alice, aliceWallet } = await setupPair(1000);
    const res = await request(app)
      .post('/api/payouts')
      .set('Authorization', `Bearer ${alice.token}`)
      .set('Idempotency-Key', 'payout-1')
      .send({
        walletId: aliceWallet._id,
        amountMinor: 400,
        destination: { bankCode: '058', accountNumber: '0123456789', accountName: 'Alice' }
      });

    expect(res.status).toBe(202);
    expect(await balanceOf(aliceWallet._id)).toBe(600);
    expect(payoutQueue.add).toHaveBeenCalledTimes(1);
  });

  test('a failed payout is refunded exactly once', async () => {
    const { alice, aliceWallet } = await setupPair(1000);
    const created = await request(app)
      .post('/api/payouts')
      .set('Authorization', `Bearer ${alice.token}`)
      .set('Idempotency-Key', 'payout-2')
      .send({
        walletId: aliceWallet._id,
        amountMinor: 400,
        destination: { bankCode: '058', accountNumber: '0123456789', accountName: 'Alice' }
      });
    const payoutId = created.body.data._id;

    await payoutService.failAndRefund(payoutId, 'provider down');
    await payoutService.failAndRefund(payoutId, 'provider down');

    expect(await balanceOf(aliceWallet._id)).toBe(1000);
  });
});