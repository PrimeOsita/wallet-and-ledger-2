const payoutService = require('../services/payoutService');
const { asyncHandler } = require('../middleware/errorhandler');

exports.requestPayout = asyncHandler(async (req, res) => {
  const payout = await payoutService.requestPayout({ userId: req.user.id, ...req.body });
  res.status(202).json({ data: payout });
});

exports.getPayout = asyncHandler(async (req, res) => {
  const payout = await payoutService.getPayout(req.user.id, req.params.id);
  res.json({ data: payout });
});