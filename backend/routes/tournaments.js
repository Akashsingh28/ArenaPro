const express    = require('express');
const router     = express.Router();
const Tournament = require('../models/Tournament');
const { protect, adminOnly } = require('../middleware/auth');

// ── GET /api/tournaments  (public, supports pagination, search, filters) ───────
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.game   && req.query.game   !== 'all') filter.game   = req.query.game;
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;
    if (req.query.search) {
      filter.name = { $regex: req.query.search, $options: 'i' };
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 12; // default 12 per page
    const skip = (page - 1) * limit;

    const tournaments = await Tournament.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
      
    const total = await Tournament.countDocuments(filter);

    res.json({
      success: true,
      data: tournaments,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── GET /api/tournaments/:id  (public) ───────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    // Populate teams to be able to show who is participating
    const tournament = await Tournament.findById(req.params.id).populate('teams', 'name logo captainUsername');
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }
    res.json({ success: true, data: tournament });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── POST /api/tournaments/:id/register (authenticated user) ───────────────────
router.post('/:id/register', protect, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ success: false, message: 'Tournament not found' });
    
    if (tournament.status !== 'open') {
      return res.status(400).json({ success: false, message: 'Tournament registration is not open' });
    }

    if (tournament.registeredTeams >= tournament.maxTeams) {
      return res.status(400).json({ success: false, message: 'Tournament is full' });
    }

    const User = require('../models/User'); // Import User
    const user = await User.findById(req.user.id).populate('team');
    
    if (!user.team) {
      return res.status(400).json({ success: false, message: 'You must be part of a team to register' });
    }

    // Checking if the team is already registered
    if (tournament.teams.includes(user.team._id)) {
      return res.status(400).json({ success: false, message: 'Team is already registered for this tournament' });
    }
    
    // We can also ensure only the captain can register (optional, but good practice).
    if (user.team.captain && user.team.captain.toString() !== req.user.id.toString()) {
        return res.status(403).json({ success: false, message: 'Only team captains can register for tournaments' });
    }

// Fix TOCTOU concurrency race condition by using atomic update
    const updatedTournament = await Tournament.findOneAndUpdate(
      { 
        _id: tournament._id, 
        status: 'open',
        $expr: { $lt: ["$registeredTeams", "$maxTeams"] }
      },
      { 
        $push: { teams: user.team._id },
        $inc: { registeredTeams: 1 } 
      },
      { new: true }
    );

    if (!updatedTournament) {
      return res.status(400).json({ success: false, message: 'Registration failed. Tournament may be full or closed.' });
    }

    res.json({ success: true, message: 'Successfully registered for tournament', data: updatedTournament });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── POST /api/tournaments  (admin only) ──────────────────────────────────────
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { name, game, prizePool, entryFee, maxTeams, date, description, rules } = req.body;

    if (!name || !game || prizePool === undefined || maxTeams === undefined || !date) {
      return res.status(400).json({ success: false, message: 'name, game, prizePool, maxTeams and date are required' });
    }

    const nPrizePool = Number(prizePool);
    const nEntryFee = Number(entryFee) || 0;
    const nMaxTeams = Number(maxTeams);

    if (isNaN(nPrizePool) || nPrizePool < 0 || isNaN(nMaxTeams) || nMaxTeams < 2 || isNaN(nEntryFee) || nEntryFee < 0) {
      return res.status(400).json({ success: false, message: 'Invalid numeric values provided for prizePool, entryFee, or maxTeams' });
    }

    const tournament = await Tournament.create({
      name, game,
      prizePool: nPrizePool,
      entryFee:  nEntryFee,
      maxTeams:  nMaxTeams,

    res.status(201).json({ success: true, data: tournament });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── PUT /api/tournaments/:id  (admin only) ───────────────────────────────────
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const tournament = await Tournament.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }
    res.json({ success: true, data: tournament });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── DELETE /api/tournaments/:id  (admin only) ────────────────────────────────
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const tournament = await Tournament.findByIdAndDelete(req.params.id);
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }
    res.json({ success: true, message: 'Tournament deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── POST /api/tournaments/:id/generate-bracket (admin only) ─────────────────
router.post('/:id/generate-bracket', protect, adminOnly, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id).populate('teams');
    if (!tournament) return res.status(404).json({ success: false, message: 'Tournament not found' });
    
    if (tournament.teams.length < 2) {
      return res.status(400).json({ success: false, message: 'Not enough teams to generate a bracket' });
    }

    const Match = require('../models/Match');
    
    // Clear existing matches for this tournament to avoid duplicates
    await Match.deleteMany({ tournament: tournament._id });

    // Shuffle teams
    const shuffled = tournament.teams.sort(() => 0.5 - Math.random());
    const matchesToCreate = [];
    
    for (let i = 0; i < shuffled.length; i += 2) {
      if (i + 1 < shuffled.length) {
        matchesToCreate.push({
          tournament: tournament._id,
          tournamentName: tournament.name,
          team1: shuffled[i]._id,
          team1Name: shuffled[i].name,
          team2: shuffled[i+1]._id,
          team2Name: shuffled[i+1].name,
          round: 'Round 1',
          status: 'scheduled'
        });
      } else {
        // Bye round (auto-advances later, but we just mark team1 for now)
        matchesToCreate.push({
          tournament: tournament._id,
          tournamentName: tournament.name,
          team1: shuffled[i]._id,
          team1Name: shuffled[i].name,
          team2: null,
          team2Name: 'BYE',
          round: 'Round 1',
          status: 'completed', // auto win
          winner: shuffled[i]._id,
          winnerName: shuffled[i].name
        });
      }
    }

    const created = await Match.insertMany(matchesToCreate);
    
    // Change tournament status automatically
    tournament.status = 'ongoing';
    await tournament.save();

    res.json({ success: true, message: 'Bracket generated', data: created });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── POST /api/tournaments/:id/progress-bracket (admin only) ──────────────────────
router.post('/:id/progress-bracket', protect, adminOnly, async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) return res.status(404).json({ success: false, message: 'Tournament not found' });

    const Match = require('../models/Match');
    const existingMatches = await Match.find({ tournament: tournament._id });
    
    if (existingMatches.length === 0) {
      return res.status(400).json({ success: false, message: 'No bracket generated yet.' });
    }

    // Determine current highest round
    const rounds = existingMatches.map(m => parseInt(m.round.split(' ')[1]) || 1);
    const currentRoundNum = Math.max(...rounds);
    
    const currentRoundMatches = existingMatches.filter(m => m.round === `Round ${currentRoundNum}`);

    // Check if tournament is completely over (only 1 match in the round and it is completed)
    if (currentRoundMatches.length === 1 && currentRoundMatches[0].status === 'completed') {
      tournament.status = 'completed';
      await tournament.save();
      return res.json({ success: true, message: 'Tournament completed! No further rounds to generate.' });
    }

    // Verify all current round matches are completed
    const incomplete = currentRoundMatches.filter(m => m.status !== 'completed' || !m.winner);
    if (incomplete.length > 0) {
      return res.status(400).json({ success: false, message: 'Not all matches in the current round are completed.' });
    }

    // Collect winners
    const winners = currentRoundMatches.map(m => ({
      _id: m.winner,
      name: m.winnerName || (m.winner.toString() === m.team1?.toString() ? m.team1Name : m.team2Name)
    }));

    if (winners.length < 2) {
      return res.status(400).json({ success: false, message: 'Not enough winners to progress to the next round.' });
    }

    const nextRoundNum = currentRoundNum + 1;
    const matchesToCreate = [];

    for (let i = 0; i < winners.length; i += 2) {
      if (i + 1 < winners.length) {
        matchesToCreate.push({
          tournament: tournament._id,
          tournamentName: tournament.name,
          team1: winners[i]._id,
          team1Name: winners[i].name,
          team2: winners[i+1]._id,
          team2Name: winners[i+1].name,
          round: `Round ${nextRoundNum}`,
          status: 'scheduled'
        });
      } else {
        // Bye
        matchesToCreate.push({
          tournament: tournament._id,
          tournamentName: tournament.name,
          team1: winners[i]._id,
          team1Name: winners[i].name,
          team2: null,
          team2Name: 'BYE',
          round: `Round ${nextRoundNum}`,
          status: 'completed',
          winner: winners[i]._id,
          winnerName: winners[i].name
        });
      }
    }

    const created = await Match.insertMany(matchesToCreate);
    res.json({ success: true, message: `Round ${nextRoundNum} generated!`, data: created });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

