const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema(
  {
    wallet: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', required: true },
    ledgerTransaction: { type: mongoose.Schema.Types.ObjectId, ref: 'LedgerTransaction', default: null },
    amountMinor: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 },
    destination: { type: mongoose.Schema.Types.Mixed, required: true },
    status: { type: String, enum: ['queued', 'processing', 'sent', 'failed', 'reconciled'], default: 'queued' },
    providerReference: { type: String, default: null },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: null }
  },
  { timestamps: true }
);

payoutSchema.index({ providerReference: 1 }, { unique: true, partialFilterExpression: { providerReference: { $type: 'string' } } });

module.exports = mongoose.model('Payout', payoutSchema);