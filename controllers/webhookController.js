const { verify } = require('../utils/signature');
const webhookService = require('../services/webhookService');
const { AppError, asyncHandler } = require('../middleware/errorhandler');

exports.handle = asyncHandler(async (req, res) => {
  const signature = req.get('x-signature');
  if (!Buffer.isBuffer(req.body) || !verify(req.body, signature, process.env.WEBHOOK_SECRET)) {
    throw new AppError(401, 'Invalid signature');
  }

  let event;
  try {
    event = JSON.parse(req.body.toString('utf8'));
  } catch {
    throw new AppError(400, 'Invalid JSON');
  }

  const result = await webhookService.handleEvent(event);
  res.status(200).json({ received: true, ...result });
});