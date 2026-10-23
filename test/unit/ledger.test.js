const db = require('../helpers/db');
const ledger = require('../../services/ledgerService');
const LedgerEntry = require('../../models/ledgerEntry');

beforeAll(db.connect, 120000);
afterEach(db.clear);
afterAll(db.disconnect);

async function twoAccounts() {
  return ledger.runInTransaction(async (session) => {
    const cash = await ledger.getSystemAccount('platform_cash', 'asset', 'NGN', session);
    const wallet = await ledger.getSystemAccount('test_wallet', 'liability', 'NGN', session);
    return { cash, wallet };
  });
}

describe('ledgerService', () => {
  test('derives balances from posted entries', async () => {
    const { cash, wallet } = await twoAccounts();
    await ledger.runInTransaction((session) =>
      ledger.postTransaction(
        {
          reference: 'ref_1',
          type: 'deposit',
          entries: [
            { account: cash._id, direction: 'debit', amountMinor: 1000, currency: 'NGN' },
            { account: wallet._id, direction: 'credit', amountMinor: 1000, currency: 'NGN' }
          ]
        },
        session
      )
    );

    expect(await ledger.getAccountBalance(cash._id)).toBe(1000);
    expect(await ledger.getAccountBalance(wallet._id)).toBe(1000);
  });

  test('rejects an unbalanced transaction', async () => {
    const { cash, wallet } = await twoAccounts();
    await expect(
      ledger.runInTransaction((session) =>
        ledger.postTransaction(
          {
            reference: 'ref_2',
            type: 'deposit',
            entries: [
              { account: cash._id, direction: 'debit', amountMinor: 1000, currency: 'NGN' },
              { account: wallet._id, direction: 'credit', amountMinor: 900, currency: 'NGN' }
            ]
          },
          session
        )
      )
    ).rejects.toThrow('not balanced');
  });

  test('rejects non-integer amounts', async () => {
    const { cash, wallet } = await twoAccounts();
    await expect(
      ledger.runInTransaction((session) =>
        ledger.postTransaction(
          {
            reference: 'ref_3',
            type: 'deposit',
            entries: [
              { account: cash._id, direction: 'debit', amountMinor: 10.5, currency: 'NGN' },
              { account: wallet._id, direction: 'credit', amountMinor: 10.5, currency: 'NGN' }
            ]
          },
          session
        )
      )
    ).rejects.toThrow('positive integers');
  });

  test('rolls everything back when the transaction fails midway', async () => {
    const { cash, wallet } = await twoAccounts();
    await expect(
      ledger.runInTransaction(async (session) => {
        await ledger.postTransaction(
          {
            reference: 'ref_4',
            type: 'deposit',
            entries: [
              { account: cash._id, direction: 'debit', amountMinor: 500, currency: 'NGN' },
              { account: wallet._id, direction: 'credit', amountMinor: 500, currency: 'NGN' }
            ]
          },
          session
        );
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');

    expect(await LedgerEntry.countDocuments()).toBe(0);
  });
});