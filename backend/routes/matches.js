const express = require('express');
const router  = express.Router();
const Match   = require('../models/Match');
const Team    = require('../models/Team');
const { protect, adminOnly } = require('../middleware/auth');

// ── GET /api/matches  (public, ?status=&tournament=) ─────────────────────────
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.status)     filter.status     = req.query.status;
    if (req.query.tournament) filter.tournament = req.query.tournament;

    const matches = await Match.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: matches });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── GET /api/matches/:id  (public) ───────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }
    res.json({ success: true, data: match });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── POST /api/matches  (admin only) ──────────────────────────────────────────
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { tournament, tournamentName, team1, team1Name, team2, team2Name, date, time, round } = req.body;

    if (!team1 || !team2) {
      return res.status(400).json({ success: false, message: 'Both team1 and team2 are required' });
    }
    if (team1 === team2) {
      return res.status(400).json({ success: false, message: 'A team cannot play against itself' });
    }

    if (tournament) {
      const Tournament = require('../models/Tournament');
      const trn = await Tournament.findById(tournament);
      if (!trn) return res.status(404).json({ success: false, message: 'Tournament not found' });
      
      if (!trn.teams.includes(team1) || !trn.teams.includes(team2)) {
         return res.status(400).json({ success: false, message: 'Both teams must be registered for the tournament' });
      }
    }

    const match = await Match.create({
      tournament, tournamentName,
      team1, team1Name,
      team2, team2Name,
      date, time,
      round: round || 'Group Stage'
    });

    res.status(201).json({ success: true, data: match });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── PUT /api/matches/:id  (admin only) ───────────────────────────────────────
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) {
      return res.status(404).json({ success: false, message: 'Match not found' });
    }

    // Prevent changing from completed back to something else
    if (match.status === 'completed' && req.body.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Cannot un-complete a match once it is completed' });
    }

    // Validate winner ID belongs to team1 or team2
    if (req.body.winner && req.body.winner !== match.team1?.toString() && req.body.winner !== match.team2?.toString()) {
      return res.status(400).json({ success: false, message: 'Winner must be either team1 or team2' });
    }

    // When a match is completed for the first time, update team records
    if (req.body.status === 'completed' && match.status !== 'completed' && req.body.winner) {
      const loserId = req.body.winner.toString() === match.team1?.toString()
        ? match.team2
        : match.team1;
      
      await Team.findByIdAndUpdate(req.body.winner, { $inc: { wins: 1, points: 100 } });
      if (loserId) {
        await Team.findByIdAndUpdate(loserId, { $inc: { losses: 1 } });
      }
    }

    const updated = await Match.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
