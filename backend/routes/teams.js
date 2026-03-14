const express = require('express');
const router  = express.Router();
const Team    = require('../models/Team');
const User    = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');

// ── GET /api/teams  (public, supports pagination & search) ────────────────────
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.search) {
      filter.name = { $regex: req.query.search, $options: 'i' };
    }
    
    // To compute accurate global ranks, ideally we either do an aggregation or keep a rank field.
    // For now we'll do a simple paginated fetch. If `page` is not provided, we return all (backward compat), or default to pagination.
    const isPaginated = req.query.page !== undefined;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || (isPaginated ? 12 : 1000); 
    const skip = (page - 1) * limit;

    const teams = await Team.find(filter)
      .sort({ points: -1, wins: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Team.countDocuments(filter);

    // Attach computed rank based on skip offset
    const ranked = teams.map((t, i) => ({ ...t.toObject(), rank: skip + i + 1 }));

    res.json({
      success: true,
      data: ranked,
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

// ── GET /api/teams/:id  (public) ─────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }
    res.json({ success: true, data: team });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── POST /api/teams  (auth required) ─────────────────────────────────────────
router.post('/', protect, async (req, res) => {
  try {
    const { name, logo, game, tag, description, memberUsernames, openRecruitment } = req.body;

    if (!name || !game) {
      return res.status(400).json({ success: false, message: 'Team name and game are required' });
    }

    if (req.user.team) {
      return res.status(400).json({ success: false, message: 'You already belong to a team' });
    }

    const exists = await Team.findOne({ name: name.trim() });
    if (exists) {
      return res.status(400).json({ success: false, message: 'A team with this name already exists' });
    }

    let extraMembersUsernames = [];
    let extraMembersIds = [];
    
    if (Array.isArray(memberUsernames) && memberUsernames.length > 0) {
      // Find valid users who exist and don't have a team yet
      const foundUsers = await User.find({
        username: { $in: memberUsernames },
        team: { $exists: false }
      });
      
      extraMembersUsernames = foundUsers.map(u => u.username);
      extraMembersIds = foundUsers.map(u => u._id);
    }

    const team = await Team.create({
      name:            name.trim(),
      logo:            logo  || '🎮',
      game,
      tag:             tag   || '',
      description:     description || '',
      captain:         req.user._id,
      captainUsername: req.user.username,
      members:         [req.user._id, ...extraMembersIds],
      memberUsernames: [req.user.username, ...extraMembersUsernames],
      openRecruitment: !!openRecruitment
    });

    // Link team to the captain's user record, and any added members
    await User.findByIdAndUpdate(req.user._id, { team: team._id });
    if (extraMembersIds.length > 0) {
      await User.updateMany({ _id: { $in: extraMembersIds } }, { team: team._id });
    }

    res.status(201).json({ success: true, data: team });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── PUT /api/teams/:id  (captain or admin) ───────────────────────────────────
router.put('/:id', protect, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    const isCaptain = team.captain.toString() === req.user._id.toString();
    if (!isCaptain && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only the team captain or admin can update this team' });
    }

    const updated = await Team.findByIdAndUpdate(req.params.id, req.body, {
      new: true, runValidators: true
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── DELETE /api/teams/:id  (captain or admin) ────────────────────────────────
router.delete('/:id', protect, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    const isCaptain = team.captain.toString() === req.user._id.toString();
    if (!isCaptain && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only the team captain or admin can delete this team' });
    }

    await Team.findByIdAndDelete(req.params.id);
    // Remove team reference from all members
    await User.updateMany({ team: req.params.id }, { team: null });

    res.json({ success: true, message: 'Team deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
