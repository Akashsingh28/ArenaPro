const express = require('express');
const router  = express.Router();
const Team    = require('../models/Team');

// ── GET /api/leaderboard  (public) ───────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const teams = await Team.find().sort({ points: -1, wins: -1 }).limit(50);

    const leaderboard = teams.map((team, index) => {
      const totalGames = team.wins + team.losses;
      const winRate = totalGames > 0
        ? ((team.wins / totalGames) * 100).toFixed(1) + '%'
        : '0%';

      return {
        rank:   index + 1,
        team:   team.name,
        teamId: team._id,
        logo:   team.logo,
        game:   team.game,
        points: team.points,
        wins:   team.wins,
        losses: team.losses,
        winRate
      };
    });

    res.json({ success: true, data: leaderboard });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
