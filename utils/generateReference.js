const crypto = require('crypto');

function generateReference(prefix = 'ref') {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(8).toString('hex')}`;
}

module.exports = generateReference;