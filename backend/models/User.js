const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false   // never returned in queries by default
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  isBanned: {
    type: Boolean,
    default: false
  },
  avatar: { type: String, default: '🎮' },
  level: { type: Number, default: 1 },
  rank: { type: String, default: 'Bronze I' },
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  games: [{ type: String }],
  stats: {
    kills:         { type: Number, default: 0 },
    wins:          { type: Number, default: 0 },
    matchesPlayed: { type: Number, default: 0 },
    winRate:       { type: Number, default: 0 },
    kdRatio:       { type: Number, default: 0 },
    headshots:     { type: Number, default: 0 }
  },
  achievements: [{
    title:       String,
    description: String,
    icon:        String
  }]
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare entered password with stored hash
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
