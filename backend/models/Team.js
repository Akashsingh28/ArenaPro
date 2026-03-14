const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Team name is required'],
    unique: true,
    trim: true,
    minlength: [2, 'Team name must be at least 2 characters'],
    maxlength: [40, 'Team name cannot exceed 40 characters']
  },
  logo: {
    type: String,
    default: '🎮'
  },
  game: {
    type: String,
    required: [true, 'Game is required'],
    enum: ['Free Fire', 'BGMI', 'Valorant', 'COD Mobile', 'Clash of Clans']
  },
  tag: {
    type: String,
    maxlength: [5, 'Tag cannot exceed 5 characters'],
    default: ''
  },
  description: { type: String, default: '' },

  // captain is a User reference
  captain: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  captainUsername: { type: String },

  // members array of User references
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  memberUsernames: [{ type: String }],

  points: { type: Number, default: 0 },
  wins:   { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  rank:   { type: Number, default: 0 },

  openRecruitment: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Team', teamSchema);
