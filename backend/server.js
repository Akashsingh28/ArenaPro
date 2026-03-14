const express  = require("express");
const mongoose = require("mongoose");
const cors     = require("cors");
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
require("dotenv").config();
const morgan   = require("morgan");

const app = express();
const JWT_SECRET    = process.env.JWT_SECRET || "arenapro_secret_key_2026";
const ADMIN_SECRET  = process.env.ADMIN_SECRET || "ARENA@ADMIN2026";   // ← Admin secret key

app.use(express.json());
app.use(cors());
app.use(morgan("dev")); // Terminal logging

/* ---------------- MONGODB CONNECTION ---------------- */
const DB_URI = process.env.MONGO_URI || "mongodb+srv://akashsingh2882005:Akash%402005M@cluster0.u9hz4.mongodb.net/arenapro?retryWrites=true&w=majority";
mongoose.connect(DB_URI)
.then(()=>console.log("✅ MongoDB Atlas Connected"))
.catch(err=>{
    console.error("❌ MongoDB Error Details:", err.message);
    if(err.message.includes("ENOTFOUND")) {
        console.error("💡 TIP: Your computer is having trouble finding the MongoDB server to connect to.");
        console.error("💡 Try changing your PC DNS to 8.8.8.8, or check if your Wi-Fi/Antivirus is blocking MongoDB.");
    }
});

/* ---------------- MODELS ---------------- */

const UserSchema = new mongoose.Schema({
    username: String,
    email:    { type: String, unique: true },
    password: String,
    avatar:   { type: String, default: "" },
    role:     { type: String, default: "user" }
}, { timestamps: true });

const TeamSchema = new mongoose.Schema({
    name:            { type: String, unique: true },
    logo:            String,
    game:            String,
    captainUsername: String,
    memberUsernames: [String],
    points:          { type: Number, default: 0 },
    wins:            { type: Number, default: 0 },
    losses:          { type: Number, default: 0 },
    status:          { type: String, default: "active" },
    statusReason:    { type: String, default: "" }
}, { timestamps: true });

const TournamentSchema = new mongoose.Schema({
    name:            String,
    game:            String,
    prizePool:       Number,
    entryFee:        { type: Number, default: 0 },
    maxTeams:        Number,
    registeredTeams: { type: Number, default: 0 },
    date:            String,
    startTime:       { type: String, default: "18:00" },
    status:          { type: String, enum: ["open", "ongoing", "closed", "completed"], default: "open" },
    description:     String
}, { timestamps: true });

const NotificationSchema = new mongoose.Schema({
    title:   { type: String, required: true },
    message: { type: String, required: true },
    type:    { type: String, default: "info" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

const User       = mongoose.model("User",       UserSchema);
const Team       = mongoose.model("Team",       TeamSchema);
const Tournament = mongoose.model("Tournament", TournamentSchema);
const Notification = mongoose.model("Notification", NotificationSchema);

function requireAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

        if (!token) {
            return res.status(401).json({ message: "Authentication required" });
        }

        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
}

async function requireAdmin(req, res, next) {
    try {
        const user = await User.findById(req.user.id);
        if (!user || user.role !== "admin") {
            return res.status(403).json({ message: "Admin access required" });
        }
        next();
    } catch (err) {
        return res.status(500).json({ message: "Admin auth error: " + err.message });
    }
}

/* ---------------- HEALTH CHECK ---------------- */

app.get("/", (req, res) => {
    res.json({ status: "✅ ArenaPro API is running", version: "1.0", endpoints: ["/api/auth/register", "/api/auth/login", "/api/tournaments", "/api/teams", "/api/leaderboard"] });
});

/* ---------------- AUTH ROUTES ---------------- */

// Register
app.post("/api/auth/register", async(req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password)
            return res.status(400).json({ message: "All fields are required" });

        const existing = await User.findOne({ email });
        if (existing)
            return res.status(400).json({ message: "Email already registered" });

        const hashed = await bcrypt.hash(password, 10);
        const user   = await User.create({ username, email, password: hashed });
        const token  = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });

        res.json({ success: true, token, user: { _id: user._id, username: user.username, email: user.email, avatar: user.avatar, role: user.role } });
    } catch(err) {
        res.status(500).json({ message: "Register error: " + err.message });
    }
});

// Login
app.post("/api/auth/login", async(req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ message: "Email and password required" });

        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ message: "Invalid email or password" });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ message: "Invalid email or password" });

        const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
        res.json({ success: true, token, user: { _id: user._id, username: user.username, email: user.email, avatar: user.avatar, role: user.role } });
    } catch(err) {
        res.status(500).json({ message: "Login error: " + err.message });
    }
});

// Admin Login
app.post("/api/auth/admin/login", async(req, res) => {
    try {
        const { email, password, secretKey } = req.body;

        if (secretKey !== ADMIN_SECRET)
            return res.status(403).json({ message: "Invalid secret key" });

        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ message: "Invalid credentials" });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ message: "Invalid credentials" });

        if (user.role !== "admin") return res.status(403).json({ message: "Access denied. Not an admin." });

        const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
        res.json({ success: true, token, user: { _id: user._id, username: user.username, email: user.email, avatar: user.avatar, role: user.role } });
    } catch(err) {
        res.status(500).json({ message: "Admin login error: " + err.message });
    }
});

app.get("/api/users/me", requireAuth, async(req, res) => {
    try {
        const user = await User.findById(req.user.id).select("_id username email avatar role createdAt updatedAt");
        if (!user) return res.status(404).json({ message: "User not found" });

        res.json({ data: user });
    } catch (err) {
        res.status(500).json({ message: "Profile fetch error: " + err.message });
    }
});

app.put("/api/users/me", requireAuth, async(req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const nextUsername = typeof req.body.username === "string" ? req.body.username.trim() : user.username;
        const nextAvatar = typeof req.body.avatar === "string" ? req.body.avatar.trim() : user.avatar;

        if (!nextUsername) {
            return res.status(400).json({ message: "Username is required" });
        }

        if (nextUsername.length < 3 || nextUsername.length > 20) {
            return res.status(400).json({ message: "Username must be between 3 and 20 characters" });
        }

        if (!/^[a-zA-Z0-9_]+$/.test(nextUsername)) {
            return res.status(400).json({ message: "Username can only contain letters, numbers, and underscores" });
        }

        if (nextAvatar && nextAvatar.length > 2_000_000) {
            return res.status(400).json({ message: "Profile photo is too large" });
        }

        const existingUser = await User.findOne({ username: nextUsername, _id: { $ne: user._id } });
        if (existingUser) {
            return res.status(400).json({ message: "Username already taken" });
        }

        const previousUsername = user.username;
        user.username = nextUsername;
        user.avatar = nextAvatar;
        await user.save();

        if (previousUsername !== nextUsername) {
            await Team.updateMany(
                { captainUsername: previousUsername },
                { $set: { captainUsername: nextUsername } }
            );
        }

        res.json({
            success: true,
            data: {
                _id: user._id,
                username: user.username,
                email: user.email,
                avatar: user.avatar,
                role: user.role
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Profile update error: " + err.message });
    }
});

/* ---------------- TEAMS ---------------- */

app.get("/api/teams", async(req, res) => {
    try {
        const teams = await Team.find().sort({ points: -1, wins: -1 });
        const teamsWithRank = teams.map((team, index) => ({
            ...team.toObject(),
            rank: index + 1
        }));
        res.json({ data: teamsWithRank });
    } catch(err) {
        res.status(500).json({ message: err.message });
    }
});

app.get("/api/teams/:id", async(req, res) => {
    try {
        const team = await Team.findById(req.params.id);
        if (!team) return res.status(404).json({ message: "Team not found" });
        res.json({ data: team });
    } catch(err) {
        res.status(500).json({ message: err.message });
    }
});

app.post("/api/teams", async(req, res) => {
    try {
        const { name, logo, game, captainUsername, memberUsernames, tag, description, openRecruitment } = req.body;
        if (!name || !game) return res.status(400).json({ message: "Team name and game are required" });

        const existing = await Team.findOne({ name });
        if (existing) return res.status(400).json({ message: "A team with this name already exists" });

        const team = await Team.create({ name, logo, game, captainUsername, memberUsernames: memberUsernames || [] });
        res.json({ data: team });
    } catch(err) {
        res.status(500).json({ message: err.message });
    }
});

app.delete("/api/teams/:id", requireAuth, requireAdmin, async(req, res) => {
    try {
        await Team.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch(err) {
        res.status(500).json({ message: err.message });
    }
});

app.put("/api/teams/:id/status", requireAuth, requireAdmin, async(req, res) => {
    try {
        const { status, reason } = req.body;
        const allowedStatuses = ["active", "warning", "under_review", "disqualified"];
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ message: "Invalid team status" });
        }

        const team = await Team.findByIdAndUpdate(
            req.params.id,
            { status, statusReason: reason || "" },
            { new: true }
        );

        if (!team) return res.status(404).json({ message: "Team not found" });

        await Notification.create({
            title: "Team Status Updated",
            message: `${team.name} is now ${status}`,
            type: "team-status",
            createdBy: req.user.id
        });

        res.json({ success: true, data: team });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/* ---------------- TOURNAMENTS ---------------- */

app.get("/api/tournaments", async(req, res) => {
    try {
        const filter = {};
        if (req.query.game   && req.query.game   !== "all") filter.game   = req.query.game;
        if (req.query.status && req.query.status !== "all") filter.status = req.query.status;
        const tournaments = await Tournament.find(filter).sort({ createdAt: -1 });
        res.json({ data: tournaments });
    } catch(err) {
        res.status(500).json({ message: err.message });
    }
});

app.get("/api/tournaments/:id", async(req, res) => {
    try {
        const tournament = await Tournament.findById(req.params.id);
        if (!tournament) return res.status(404).json({ message: "Tournament not found" });
        res.json({ data: tournament });
    } catch(err) {
        res.status(500).json({ message: err.message });
    }
});

app.post("/api/tournaments/:id/register", requireAuth, async(req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        if (user.role === "admin") {
            return res.status(403).json({ message: "Admins cannot register teams" });
        }

        const tournament = await Tournament.findById(req.params.id);
        if (!tournament) return res.status(404).json({ message: "Tournament not found" });

        if (tournament.status !== "open") {
            return res.status(400).json({ message: "Registration is closed for this tournament" });
        }

        if (tournament.registeredTeams >= tournament.maxTeams) {
            return res.status(400).json({ message: "Tournament is already full" });
        }

        const myTeam = await Team.findOne({ captainUsername: user.username, game: tournament.game });
        if (!myTeam) {
            return res.status(400).json({
                code: "TEAM_REQUIRED",
                message: `Create a ${tournament.game} team first to register`
            });
        }

        tournament.registeredTeams += 1;
        await tournament.save();

        res.json({
            success: true,
            message: `${myTeam.name} registered successfully`,
            data: {
                tournamentId: tournament._id,
                teamId: myTeam._id,
                registeredTeams: tournament.registeredTeams,
                maxTeams: tournament.maxTeams
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Register team error: " + err.message });
    }
});

app.post("/api/tournaments", requireAuth, requireAdmin, async(req, res) => {
    try {
        const { name, game, prizePool, entryFee, maxTeams, date, startTime, description } = req.body;
        if (!name || !game || !prizePool || !maxTeams || !date)
            return res.status(400).json({ message: "Name, game, prize pool, max teams, and date are required" });

        const tournament = await Tournament.create({
            name,
            game,
            prizePool,
            entryFee: entryFee || 0,
            maxTeams,
            date,
            startTime: startTime || "18:00",
            description
        });
        res.json({ data: tournament });
    } catch(err) {
        res.status(500).json({ message: err.message });
    }
});

app.put("/api/tournaments/:id", requireAuth, requireAdmin, async(req, res) => {
    try {
        const previous = await Tournament.findById(req.params.id);
        if (!previous) return res.status(404).json({ message: "Tournament not found" });

        const tournament = await Tournament.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!tournament) return res.status(404).json({ message: "Tournament not found" });

        if (req.body.status && req.body.status !== previous.status) {
            await Notification.create({
                title: "Tournament Status Updated",
                message: `${tournament.name} is now ${req.body.status}`,
                type: "tournament-status",
                createdBy: req.user.id
            });
        }

        res.json({ data: tournament });
    } catch(err) {
        res.status(500).json({ message: err.message });
    }
});

app.delete("/api/tournaments/:id", requireAuth, requireAdmin, async(req, res) => {
    try {
        await Tournament.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch(err) {
        res.status(500).json({ message: err.message });
    }
});

/* ---------------- LEADERBOARD ---------------- */

app.get("/api/leaderboard", async(req, res) => {
    try {
        const teams = await Team.find().sort({ points: -1, wins: -1 });
        const leaderboard = teams.map((team, index) => {
            const total   = team.wins + team.losses;
            const winRate = total > 0 ? Math.round((team.wins / total) * 100) + "%" : "0%";
            return {
                rank:    index + 1,
                team:    team.name,
                logo:    team.logo,
                game:    team.game,
                points:  team.points,
                wins:    team.wins,
                losses:  team.losses,
                winRate
            };
        });
        res.json({ data: leaderboard });
    } catch(err) {
        res.status(500).json({ message: err.message });
    }
});

/* ---------------- ADMIN STATS ---------------- */

app.get("/api/admin/stats", requireAuth, requireAdmin, async(req, res) => {
    try {
        const [tournaments, teams, users] = await Promise.all([
            Tournament.countDocuments(),
            Team.countDocuments(),
            User.countDocuments()
        ]);
        const allTournaments = await Tournament.find({}, "prizePool");
        const totalPrize = allTournaments.reduce((sum, t) => sum + (t.prizePool || 0), 0);
        res.json({ data: { tournaments, teams, users, totalPrize } });
    } catch(err) {
        res.status(500).json({ message: err.message });
    }
});

app.post("/api/admin/notifications", requireAuth, requireAdmin, async (req, res) => {
    try {
        const { title, message, type } = req.body;
        if (!title || !message) {
            return res.status(400).json({ message: "title and message are required" });
        }

        const notification = await Notification.create({
            title,
            message,
            type: type || "admin",
            createdBy: req.user.id
        });

        res.json({ success: true, data: notification });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
        const notifications = await Notification.find().sort({ createdAt: -1 }).limit(50);
        res.json({ success: true, data: notifications });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

/* ---------------- SERVER ---------------- */

app.listen(5000, () => {
    console.log("🚀 Server running on http://localhost:5000");
});