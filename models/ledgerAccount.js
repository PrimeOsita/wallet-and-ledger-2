const mongoose = require('mongoose');

const ledgerAccountSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    // Only system accounts have a code, e.g. 'platform_cash:NGN'
    code: { type: String },
    type: { type: String, enum: ['asset', 'liability', 'revenue', 'expense'], required: true },
    wallet: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', default: null },
    currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 }
  },
  { timestamps: true }
);

// One ledger account per wallet
ledgerAccountSchema.index(
  { wallet: 1 },
  { unique: true, partialFilterExpression: { wallet: { $type: 'objectId' } } }
);
// One account per system code (sparse skips documents without a code)
ledgerAccountSchema.index({ code: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('LedgerAccount', ledgerAccountSchema);