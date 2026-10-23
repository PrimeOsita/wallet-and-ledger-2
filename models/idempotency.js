const mongoose = require('mongoose');

const idempotencySchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    requestHash: { type: String, required: true },
    status: { type: String, enum: ['in_progress', 'completed'], default: 'in_progress' },
    responseBody: { type: mongoose.Schema.Types.Mixed, default: null },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

idempotencySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Idempotency', idempotencySchema);