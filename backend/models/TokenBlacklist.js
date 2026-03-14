const mongoose = require('mongoose');

const tokenBlacklistSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: '7d' // Token expires in 7 days, so we can clean up the blacklist automatically
  }
});

module.exports = mongoose.model('TokenBlacklist', tokenBlacklistSchema);