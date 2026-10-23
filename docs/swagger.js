const idHeader = {
  name: 'Idempotency-Key',
  in: 'header',
  required: true,
  schema: { type: 'string' }
};
const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string' } };
const json = (properties, required) => ({
  required: true,
  content: { 'application/json': { schema: { type: 'object', required, properties } } }
});

module.exports = {
  openapi: '3.0.3',
  info: { title: 'Wallet Ledger Service API', version: '1.0.0' },
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } }
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/api/wallets': {
      post: {
        summary: 'Create a wallet',
        requestBody: json({ currency: { type: 'string', example: 'NGN' } }, ['currency']),
        responses: { 201: { description: 'Wallet created' } }
      }
    },
    '/api/wallets/{id}': {
      get: {
        summary: 'Get a wallet',
        parameters: [idParam],
        responses: { 200: { description: 'The wallet' } }
      }
    },
    '/api/wallets/{id}/statement': {
      get: {
        summary: 'Ledger entries for a wallet, newest first',
        parameters: [
          idParam,
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          { name: 'before', in: 'query', schema: { type: 'string' } }
        ],
        responses: { 200: { description: 'Statement page' } }
      }
    },
    '/api/wallets/transfer': {
      post: {
        summary: 'Transfer between wallets',
        parameters: [idHeader],
        requestBody: json(
          {
            fromWalletId: { type: 'string' },
            toWalletId: { type: 'string' },
            amountMinor: { type: 'integer', example: 50000 },
            description: { type: 'string' }
          },
          ['fromWalletId', 'toWalletId', 'amountMinor']
        ),
        responses: { 201: { description: 'Transfer posted' }, 422: { description: 'Insufficient funds' } }
      }
    },
    '/api/payouts': {
      post: {
        summary: 'Request a payout',
        parameters: [idHeader],
        requestBody: json(
          {
            walletId: { type: 'string' },
            amountMinor: { type: 'integer' },
            destination: { type: 'object' }
          },
          ['walletId', 'amountMinor', 'destination']
        ),
        responses: { 202: { description: 'Payout queued' } }
      }
    },
    '/api/payouts/{id}': {
      get: {
        summary: 'Get a payout',
        parameters: [idParam],
        responses: { 200: { description: 'The payout' } }
      }
    }
  }
};