const crypto = require('crypto');

function sign(rawBody, secret) {
  return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

function verify(rawBody, signature, secret) {
  if (!signature || !secret) return false;
  const expected = Buffer.from(sign(rawBody, secret));
  const given = Buffer.from(String(signature));
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

module.exports = { sign, verify };