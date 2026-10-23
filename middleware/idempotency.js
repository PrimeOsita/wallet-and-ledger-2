const crypto = require('crypto');
const Idempotency = require('../models/idempotency');
const { AppError } = require('./errorhandler');

const TTL_MS = 24 * 60 * 60 * 1000;

async function idempotency(req, res, next) {
  try {
    const headerKey = req.get('Idempotency-Key');
    if (!headerKey) throw new AppError(400, 'Idempotency-Key header is required');
    if (headerKey.length > 128) throw new AppError(400, 'Idempotency-Key is too long');

    const key = `${req.user.id}:${req.method}:${req.baseUrl}${req.path}:${headerKey}`;
    const requestHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(req.body || {}))
      .digest('hex');

    try {
      await Idempotency.create({
        key,
        requestHash,
        status: 'in_progress',
        expiresAt: new Date(Date.now() + TTL_MS)
      });
    } catch (err) {
      if (err.code !== 11000) throw err;

      const existing = await Idempotency.findOne({ key });
      if (!existing) throw new AppError(409, 'Please retry the request');
      if (existing.requestHash !== requestHash) {
        throw new AppError(422, 'Idempotency-Key was already used with a different request body');
      }
      if (existing.status === 'completed') {
        res.set('Idempotent-Replay', 'true');
        return res.status(existing.responseBody.statusCode).json(existing.responseBody.body);
      }
      throw new AppError(409, 'A request with this Idempotency-Key is still being processed');
    }

    // Store the outcome before the response is sent
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      res.json = originalJson;
      const statusCode = res.statusCode;
      (async () => {
        try {
          if (statusCode < 300) {
            await Idempotency.updateOne(
              { key },
              { status: 'completed', responseBody: { statusCode, body } }
            );
          } else {
            await Idempotency.deleteOne({ key });
          }
        } catch (e) {
          console.error('Failed to store idempotent response:', e.message);
        }
        originalJson(body);
      })();
      return res;
    };

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = idempotency;