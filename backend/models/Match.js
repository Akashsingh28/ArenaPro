const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  tournament:     { type: mongoose.Schema.Types.ObjectId, ref: 'Tournament' },
  tournamentName: { type: String, default: '' },

  team1:     { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  team1Name: { type: String },

  team2:     { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  team2Name: { type: String },

  winner:     { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  winnerName: { type: String, default: '' },

  score: { type: String, default: '' },

  status: {
    type: String,
    enum: ['scheduled', 'live', 'completed'],
    default: 'scheduled'
  },

  date:  { type: String },
  time:  { type: String },
  round: { type: String, default: 'Group Stage' }
}, { timestamps: true });

module.exports = mongoose.model('Match', matchSchema);
