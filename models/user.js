const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true, trim: true },
    status: { type: String, enum: ['active', 'suspended', 'closed'], default: 'active' },
    kycStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);