const rateLimit = require('express-rate-limit');

const base = {
  windowMs: 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: { message: 'Too many requests, slow down' } }
};

const general = rateLimit({ ...base, limit: 100 });
// For money-moving endpoints
const strict = rateLimit({ ...base, limit: 10 });

module.exports = { general, strict };