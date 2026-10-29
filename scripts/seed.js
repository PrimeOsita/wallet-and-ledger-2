require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  for (const name of ['alice', 'bob']) {
    const email = `${name}@test.com`;
    const user = await User.findOneAndUpdate(
      { email },
      { $setOnInsert: { email, passwordHash: 'x', fullName: name } },
      { upsert: true, new: true }
    );
    const token = jwt.sign({}, process.env.JWT_SECRET, { subject: String(user._id), expiresIn: '7d' });
    console.log(`${name}\n  userId: ${user._id}\n  token:  ${token}\n`);
  }
  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });