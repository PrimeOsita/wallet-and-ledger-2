const mongoose = require('mongoose');

const ledgerEntrySchema = new mongoose.Schema(
  {
    transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerTransaction', required: true },
    account: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerAccount', required: true },
    direction: { type: String, enum: ['debit', 'credit'], required: true },
    amountMinor: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 }
  },
  { timestamps: true }
);

ledgerEntrySchema.index({ account: 1, createdAt: -1 });
ledgerEntrySchema.index({ transaction: 1 });

module.exports = mongoose.model('LedgerEntry', ledgerEntrySchema);