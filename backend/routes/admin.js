const express    = require('express');
const router     = express.Router();
const User       = require('../models/User');
const Tournament = require('../models/Tournament');
const Team       = require('../models/Team');
const Match      = require('../models/Match');
const { protect, adminOnly } = require('../middleware/auth');

// All admin routes require auth + admin role
router.use(protect, adminOnly);

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [tournaments, teams, users, matches] = await Promise.all([
      Tournament.countDocuments(),
      Team.countDocuments(),
      User.countDocuments({ role: 'user' }),
      Match.countDocuments()
    ]);

    // Sum prize pools
    const prizeAgg = await Tournament.aggregate([
      { $group: { _id: null, total: { $sum: '$prizePool' } } }
    ]);
    const totalPrize = prizeAgg.length > 0 ? prizeAgg[0].total : 0;

    res.json({
      success: true,
      data: { tournaments, teams, users, matches, totalPrize }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── GET /api/admin/users ──────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const filter = { role: 'user' };
    if (req.query.search) {
      // search by username or email
      filter.$or = [
        { username: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const users = await User.find(filter)
      .populate({ path: 'team', select: 'name', strictPopulate: false })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
      
    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: users,
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

// ── PUT /api/admin/users/:id/ban ─────────────────────────────────────────────
router.put('/users/:id/ban', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Cannot ban an admin' });
    }
    
    // Toggle banned status
    user.isBanned = !user.isBanned;
    await user.save();

    res.json({ success: true, message: `User ${user.username} is now ${user.isBanned ? 'Banned' : 'Active'}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
