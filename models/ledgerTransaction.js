const mongoose = require('mongoose');

const ledgerTransactionSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, unique: true },
    type: { type: String, enum: ['transfer', 'payout', 'deposit', 'reversal'], required: true },
    status: { type: String, enum: ['pending', 'posted', 'failed', 'reversed'], default: 'pending' },
    description: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed }
  },
  { timestamps: true }
);

module.exports = mongoose.model('LedgerTransaction', ledgerTransactionSchema);