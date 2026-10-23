const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 },
    balanceMinor: { type: Number, required: true, default: 0 },
    status: { type: String, enum: ['active', 'frozen', 'closed'], default: 'active' },
    version: { type: Number, required: true, default: 0 }
  },
  { timestamps: true }
);

walletSchema.index({ user: 1, currency: 1 }, { unique: true });

module.exports = mongoose.model('Wallet', walletSchema);