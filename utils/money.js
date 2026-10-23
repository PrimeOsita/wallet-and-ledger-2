function toMinor(amount) {
  const s = String(amount).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error('Invalid amount');
  const [whole, frac = ''] = s.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

function toMajor(minor) {
  if (!Number.isInteger(minor)) throw new Error('Minor amount must be an integer');
  return (minor / 100).toFixed(2);
}

function isPositiveInteger(n) {
  return Number.isSafeInteger(n) && n > 0;
}

module.exports = { toMinor, toMajor, isPositiveInteger };