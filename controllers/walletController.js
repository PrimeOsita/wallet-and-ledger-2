const walletService = require('../services/walletService');
const { asyncHandler } = require('../middleware/errorhandler');

exports.createWallet = asyncHandler(async (req, res) => {
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

exports.getStatement = asyncHandler(async (req, res) => {
  const data = await walletService.getStatement(req.user.id, req.params.id, {
    limit: req.query.limit,
    before: req.query.before
  });
  res.json({ data });
});