/**
 * Seed script — creates an admin user and sample data.
 * Run once: node seed.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  // Dynamic imports after connection
  const User       = require('./models/User');
  const Tournament = require('./models/Tournament');
  const Team       = require('./models/Team');

  // ── Admin user ──────────────────────────────────────────────────────────────
  const adminEmail = 'admin@arenapro.com';
  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    admin = await User.create({
      username: 'Admin',
      email:    adminEmail,
      password: 'admin123',   // will be hashed by the pre-save hook
      role:     'admin'
    });
    console.log('✅ Admin user created  →  admin@arenapro.com / admin123');
  } else {
    console.log('ℹ️  Admin user already exists, skipping.');
  }

  // ── Sample tournaments ───────────────────────────────────────────────────────
  const count = await Tournament.countDocuments();
  if (count === 0) {
    await Tournament.insertMany([
      { name: 'Free Fire Championship', game: 'Free Fire',       prizePool: 50000,  entryFee: 0,   maxTeams: 64, registeredTeams: 32, date: '2026-03-15', status: 'open',      createdBy: admin._id },
      { name: 'BGMI Pro League',         game: 'BGMI',            prizePool: 100000, entryFee: 500, maxTeams: 64, registeredTeams: 45, date: '2026-03-18', status: 'open',      createdBy: admin._id },
      { name: 'Valorant Masters',        game: 'Valorant',        prizePool: 75000,  entryFee: 300, maxTeams: 32, registeredTeams: 28, date: '2026-03-20', status: 'open',      createdBy: admin._id },
      { name: 'COD Mobile Showdown',     game: 'COD Mobile',      prizePool: 60000,  entryFee: 250, maxTeams: 48, registeredTeams: 20, date: '2026-03-22', status: 'ongoing',   createdBy: admin._id },
      { name: 'Clash of Clans War',      game: 'Clash of Clans',  prizePool: 40000,  entryFee: 0,   maxTeams: 32, registeredTeams: 15, date: '2026-02-25', status: 'completed', createdBy: admin._id }
    ]);
    console.log('✅ Sample tournaments created');
  } else {
    console.log('ℹ️  Tournaments already exist, skipping.');
  }

  // ── Sample teams ─────────────────────────────────────────────────────────────
  const teamCount = await Team.countDocuments();
  if (teamCount === 0) {
    await Team.insertMany([
      { name: 'Phoenix Squad',    logo: '🔥', game: 'Free Fire',  captain: admin._id, captainUsername: 'ProGamer123', members: [admin._id], memberUsernames: ['ProGamer123', 'SnipeKing', 'RushMaster', 'CoverPro'], points: 2450, wins: 45, losses: 12 },
      { name: 'Shadow Wolves',    logo: '🐺', game: 'BGMI',       captain: admin._id, captainUsername: 'AlphaWolf',   members: [admin._id], memberUsernames: ['AlphaWolf', 'SilentKill', 'GhostRecon', 'StealthOp'],  points: 2380, wins: 42, losses: 15 },
      { name: 'Titan Force',      logo: '⚡', game: 'Valorant',   captain: admin._id, captainUsername: 'TitanAce',    members: [admin._id], memberUsernames: ['TitanAce', 'FlashPeak', 'SpikeRush', 'VortexShot'],    points: 2310, wins: 40, losses: 17 },
      { name: 'Dragon Warriors',  logo: '🐉', game: 'COD Mobile', captain: admin._id, captainUsername: 'DragonFire',  members: [admin._id], memberUsernames: ['DragonFire', 'NukeMaster', 'QuickScope', 'TacticalOps'], points: 2250, wins: 38, losses: 18 },
      { name: 'Elite Gamers',     logo: '🌟', game: 'Free Fire',  captain: admin._id, captainUsername: 'EliteOne',    members: [admin._id], memberUsernames: ['EliteOne', 'SnipeX', 'RushBro'],                         points: 2180, wins: 36, losses: 20 }
    ]);
    console.log('✅ Sample teams created');
  } else {
    console.log('ℹ️  Teams already exist, skipping.');
  }

  await mongoose.disconnect();
  console.log('\n🎉 Seed complete! You can now start the server with: npm run dev');
}

seed().catch(err => {
  console.error('❌ Seed error:', err.message);
  process.exit(1);
});
