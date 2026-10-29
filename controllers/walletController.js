const walletService = require('../services/walletService');
const { SUPPORTED_CURRENCIES } = require('../utils/currencies');
const { asyncHandler } = require('../middleware/errorhandler');

exports.createWallet = asyncHandler(async (req, res) => {
  if (!SUPPORTED_CURRENCIES.includes(req.body.currency)) {
    return res.status(400).json({ error: 'Unsupported currency' });
  }
  const wallet = await walletService.createWallet(req.user.id, req.body.currency);
  res.status(201).json({ data: wallet });
});

exports.getWallet = asyncHandler(async (req, res) => {
  const wallet = await walletService.getWallet(req.user.id, req.params.id);
  res.json({ data: wallet });
});

exports.transfer = asyncHandler(async (req, res) => {
  const result = await walletService.transfer({ userId: req.user.id, ...req.body });
  res.status(201).json({ data: result });
});
exports.getWallets = asyncHandler(async (req, res) => {
  const wallets = await walletService.listWallets(req.user.id, {
    includeClosed: req.query.includeClosed === 'true'
  });
  res.json({ data: wallets });
});

exports.updateWallet = asyncHandler(async (req, res) => {
  const wallet = await walletService.updateWallet(req.user.id, req.params.id, req.body);
  res.json({ data: wallet });
});

exports.closeWallet = asyncHandler(async (req, res) => {
  const wallet = await walletService.closeWallet(req.user.id, req.params.id);
  res.json({ data: wallet });
});
exports.getStatement = asyncHandler(async (req, res) => {
  const data = await walletService.getStatement(req.user.id, req.params.id, {
    limit: req.query.limit,
    before: req.query.before
  });
  res.json({ data });
});
exports.fund = asyncHandler(async (req, res) => {
  const data = await walletService.devFund({
    userId: req.user.id,
    walletId: req.params.id,
    amountMinor: req.body.amountMinor
  });
  res.status(201).json({ data });
});