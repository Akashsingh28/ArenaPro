const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tournament name is required'],
    trim: true
  },
  game: {
    type: String,
    required: [true, 'Game is required'],
    enum: ['Free Fire', 'BGMI', 'Valorant', 'COD Mobile', 'Clash of Clans']
  },
  prizePool: {
    type: Number,
    required: [true, 'Prize pool is required'],
    min: [0, 'Prize pool cannot be negative']
  },
  entryFee: {
    type: Number,
    default: 0,
    min: [0, 'Entry fee cannot be negative']
  },
  maxTeams: {
    type: Number,
    required: [true, 'Max teams is required'],
    min: [2, 'At least 2 teams required']
  },
  registeredTeams: {
    type: Number,
    default: 0,
    min: 0
  },
  date: {
    type: String,
    required: [true, 'Tournament date is required']
  },
  status: {
    type: String,
    enum: ['open', 'ongoing', 'completed', 'closed'],
    default: 'open'
  },
  teams: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team'
  }],
  description: { type: String, default: '' },
  rules:       { type: String, default: '' },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

module.exports = mongoose.model('Tournament', tournamentSchema);
