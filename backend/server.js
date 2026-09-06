const express = require("express");
const cors = require("cors");
const compression = require("compression");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const db = require("./db");
const engine = require("../src/utils/seasonEngine");

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === "production";
const isVercel = process.env.VERCEL === "1";

const debug = isProduction ? () => {} : console.log;

// CORS configuration
const corsOptions = {
  origin: isProduction
    ? process.env.FRONTEND_URL || true
    : // Dev also serves phones on the same wifi, so allow private-network origins.
      (origin, callback) => {
        if (!origin) return callback(null, true);
        const allowed =
          /^http:\/\/localhost:\d+$/.test(origin) ||
          /^http:\/\/127\.0\.0\.1:\d+$/.test(origin) ||
          /^http:\/\/192\.168\.\d+\.\d+:\d+$/.test(origin) ||
          /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/.test(origin);
        callback(allowed ? null : new Error("Origin not allowed"), allowed);
      },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-player-id", "x-admin-key"],
};

// Middleware
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from React build (standalone mode only, Vercel handles this itself)
if (isProduction && !isVercel) {
  const buildPath = path.join(__dirname, "..", "build");
  if (fs.existsSync(buildPath)) {
    app.use(express.static(buildPath));
    console.log("✅ Serving static files from:", buildPath);
  }
}

// ==================== DATABASE INITIALIZATION ====================

let initPromise = null;

async function runDatabaseInit() {
  console.log("🚀 Initializing database...");

  const { DDL, INDEXES } = require("./schema");
  const ddl = DDL;

  // libsql/client supports executeMultiple for batched multi-statement SQL
  if (typeof db.execMultiple === "function") {
    await db.execMultiple(ddl);
  } else {
    // Fallback: split and execute sequentially
    const statements = ddl
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of statements) {
      try {
        await db.exec(stmt);
      } catch (err) {
        console.error("DDL error:", err.message);
      }
    }
  }

  // CREATE TABLE IF NOT EXISTS won't add a column to a table that already exists.
  // CREATE TABLE IF NOT EXISTS won't add columns to a table that already exists.
  const addColumns = [
    // A database that predates FitBros 3.0 has the tables but not these columns,
    // and CREATE TABLE IF NOT EXISTS will not add them. Duplicates are ignored
    // below, so this is safe to run against a fresh database too.
    "ALTER TABLE users ADD COLUMN price_level INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE users ADD COLUMN standing TEXT NOT NULL DEFAULT 'active'",
    "ALTER TABLE users ADD COLUMN cutoff_hour INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN week_end_day INTEGER NOT NULL DEFAULT 7",
    "ALTER TABLE goals ADD COLUMN points INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE goals ADD COLUMN approved_at TEXT",
    "ALTER TABLE fines ADD COLUMN price_level INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE fines ADD COLUMN issued_at TEXT",
    "ALTER TABLE fines ADD COLUMN due_at TEXT",
    "ALTER TABLE fines ADD COLUMN settled_at TEXT",
    "ALTER TABLE fines ADD COLUMN waived_by_token_id TEXT",
    "ALTER TABLE weekly_plans ADD COLUMN swaps_used INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE goals ADD COLUMN baseline_value REAL",
    "ALTER TABLE goals ADD COLUMN target_value REAL",
    "ALTER TABLE goals ADD COLUMN unit TEXT",
    "ALTER TABLE fines ADD COLUMN voided_at TEXT",
    "ALTER TABLE fines ADD COLUMN voided_reason TEXT",
  ];
  for (const sql of addColumns) {
    try {
      await db.exec(sql);
    } catch (err) {
      if (!String(err.message).includes("duplicate column")) {
        console.error("Migration note:", err.message);
      }
    }
  }

  // Indexes last: some of them cover columns the ALTERs above just added.
  if (typeof db.execMultiple === "function") {
    await db.execMultiple(INDEXES);
  } else {
    for (const stmt of INDEXES.split(";").map((s) => s.trim()).filter(Boolean)) {
      await db.exec(stmt);
    }
  }

  console.log("✅ Database initialization complete");
}

function ensureInit() {
  if (!initPromise) {
    initPromise = runDatabaseInit().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

app.use(async (req, res, next) => {
  try {
    await ensureInit();
    next();
  } catch (err) {
    console.error("Database init error:", err);
    res.status(500).json({ error: "Server initialization failed" });
  }
});

// ==================== INPUT VALIDATION HELPERS ====================

const validateString = (value, fieldName, minLength = 1, maxLength = 255) => {
  if (typeof value !== "string") {
    return `${fieldName} must be a string`;
  }
  const trimmed = value.trim();
  if (trimmed.length < minLength) {
    return `${fieldName} must be at least ${minLength} character(s)`;
  }
  if (trimmed.length > maxLength) {
    return `${fieldName} must be at most ${maxLength} characters`;
  }
  return null;
};

const validateNumber = (value, fieldName, min = null, max = null) => {
  const num = Number(value);
  if (isNaN(num)) {
    return `${fieldName} must be a number`;
  }
  if (min !== null && num < min) {
    return `${fieldName} must be at least ${min}`;
  }
  if (max !== null && num > max) {
    return `${fieldName} must be at most ${max}`;
  }
  return null;
};

const validateBoolean = (value, fieldName) => {
  if (typeof value !== "boolean" && value !== 0 && value !== 1) {
    return `${fieldName} must be a boolean`;
  }
  return null;
};

const validatePriceLevel = (value) => {
  const level = Number(value);
  if (!Number.isInteger(level) || level < 1 || level > 3) {
    return "Price level must be 1, 2 or 3";
  }
  return null;
};

// Players name their own categories now (Rule 01), so this only checks it is usable text.
const validateGoalCategory = (value) => validateString(value, "Category", 1, 60);

const sanitizeString = (value) => {
  if (typeof value !== "string") return value;
  return value.trim().replace(/[<>]/g, "");
};

// ==================== IST DATE HELPERS ====================
// Challenge start (Monday, IST). MUST match frontend src/utils/dateUtils.ts.
const CHALLENGE_START_UTC_MS = Date.UTC(2026, 0, 19);
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const getCurrentWeekIST = () => {
  const istNow = new Date(Date.now() + IST_OFFSET_MS);
  const istMidnightUTC = Date.UTC(
    istNow.getUTCFullYear(),
    istNow.getUTCMonth(),
    istNow.getUTCDate()
  );
  const daysDiff = Math.floor(
    (istMidnightUTC - CHALLENGE_START_UTC_MS) / 86400000
  );
  if (daysDiff < 0) return 0;
  return Math.floor(daysDiff / 7) + 1;
};

const currentISTDayOfWeek = () => {
  const istNow = new Date(Date.now() + IST_OFFSET_MS);
  const jsDow = istNow.getUTCDay();
  return jsDow === 0 ? 7 : jsDow;
};

/**
 * The season's current week, from admin_settings — the same row the engine uses.
 * Date arithmetic used to answer this separately, which let the plan routes and
 * the fines disagree about what week it was.
 */
async function seasonCurrentWeek() {
  const row = await db.get("SELECT current_week FROM admin_settings WHERE id = 1");
  return row ? Number(row.current_week) : 1;
}

// ==================== OWNERSHIP ====================

/**
 * Who is making this request.
 *
 * This is an ownership check, not authentication: the client states who it is
 * and the server holds it to that. It stops one player writing to another's
 * record — the common accident in a shared app — but anyone who can call the API
 * directly can still claim to be someone else. Real auth is a separate job, and
 * this is the seam it slots into.
 */
const actorOf = (req) => req.header("x-player-id") || req.body?.actorId || null;

const isAdminRequest = (req) =>
  Boolean(process.env.ADMIN_KEY) && req.header("x-admin-key") === process.env.ADMIN_KEY;

/** Rejects the request unless the caller owns `ownerId` (or is an admin). */
function denyUnlessOwner(req, res, ownerId) {
  if (isAdminRequest(req)) return false;
  const actor = actorOf(req);
  if (!actor) {
    res.status(401).json({ error: "Say who you are: send an x-player-id header" });
    return true;
  }
  if (actor !== ownerId) {
    res.status(403).json({ error: "That record belongs to someone else" });
    return true;
  }
  return false;
}

/**
 * Rule 08: out is out for the season. Two fines while suspended ends it, and an
 * ended season can't be written to. The UI already hides these controls — this is
 * the server refusing to be told otherwise.
 */
async function denyIfOut(res, userId) {
  const row = await db.get("SELECT standing FROM users WHERE id = ?", [userId]);
  if (row?.standing !== "out") return false;
  res.status(403).json({
    error: "Out for the season — two fines while suspended. No buy-backs, and nothing more to log.",
  });
  return true;
}

// ==================== USER ROUTES ====================

app.get("/api/users", async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT
        id, name, avatar, start_date, price_level,
        clean_weeks, missed_weeks, standing,
        cutoff_hour, week_end_day, created_at, updated_at
      FROM users
      ORDER BY name COLLATE NOCASE ASC
    `);

    const users = rows.map((row) => ({
      id: row.id,
      name: row.name,
      avatar: row.avatar,
      startDate: row.start_date,
      priceLevel: Number(row.price_level),
      cleanWeeks: Number(row.clean_weeks),
      missedWeeks: Number(row.missed_weeks),
      standing: row.standing,
      cutoffHour: Number(row.cutoff_hour),
      weekEndDay: Number(row.week_end_day),
      // Only elimination makes a player inactive now.
      isActive: row.standing !== "out",
    }));

    debug(`Fetched ${users.length} users`);
    res.json(users);
  } catch (err) {
    console.error("Error fetching users:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/users/:id", async (req, res) => {
  try {
    const row = await db.get(
      `SELECT
        id, name, avatar, start_date, price_level,
        clean_weeks, missed_weeks, standing,
        cutoff_hour, week_end_day, created_at, updated_at
      FROM users WHERE id = ?`,
      [req.params.id]
    );

    if (!row) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const user = {
      id: row.id,
      name: row.name,
      avatar: row.avatar,
      startDate: row.start_date,
      priceLevel: Number(row.price_level),
      cleanWeeks: Number(row.clean_weeks),
      missedWeeks: Number(row.missed_weeks),
      standing: row.standing,
      cutoffHour: Number(row.cutoff_hour),
      weekEndDay: Number(row.week_end_day),
      // Only elimination makes a player inactive now.
      isActive: row.standing !== "out",
    };

    res.json(user);
  } catch (err) {
    console.error("Error fetching user:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/users", async (req, res) => {
  const { name, avatar, priceLevel, cleanWeeks, missedWeeks, cutoffHour, weekEndDay } = req.body;

  const nameError = validateString(name, "Name", 1, 100);
  if (nameError) {
    res.status(400).json({ error: nameError });
    return;
  }

  if (avatar) {
    const avatarError = validateString(avatar, "Avatar", 1, 10);
    if (avatarError) {
      res.status(400).json({ error: avatarError });
      return;
    }
  }

  if (priceLevel !== undefined) {
    const levelError = validatePriceLevel(priceLevel);
    if (levelError) {
      res.status(400).json({ error: levelError });
      return;
    }
  }

  if (cleanWeeks !== undefined) {
    const cleanWeeksError = validateNumber(cleanWeeks, "Clean weeks", 0, 52);
    if (cleanWeeksError) {
      res.status(400).json({ error: cleanWeeksError });
      return;
    }
  }

  if (missedWeeks !== undefined) {
    const missedWeeksError = validateNumber(missedWeeks, "Missed weeks", 0, 52);
    if (missedWeeksError) {
      res.status(400).json({ error: missedWeeksError });
      return;
    }
  }

  try {
    const id = uuidv4();
    const startDate = "2026-01-19";
    const sanitizedName = sanitizeString(name);
    const sanitizedAvatar = avatar
      ? sanitizeString(avatar)
      : sanitizedName.charAt(0).toUpperCase();

    await db.run(
      `INSERT INTO users (
        id, name, avatar, start_date, price_level,
        clean_weeks, missed_weeks, standing, cutoff_hour, week_end_day
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sanitizedName,
        sanitizedAvatar,
        startDate,
        priceLevel || 1,
        cleanWeeks || 0,
        missedWeeks || 0,
        "active",
        cutoffHour ?? 0,
        weekEndDay ?? 7,
      ]
    );

    debug(`Created user: ${sanitizedName} (ID: ${id})`);

    const user = {
      id,
      name: sanitizedName,
      avatar: sanitizedAvatar,
      startDate,
      priceLevel: priceLevel || 1,
      cleanWeeks: cleanWeeks || 0,
      missedWeeks: missedWeeks || 0,
      standing: "active",
      isActive: true,
    };

    res.status(201).json(user);
  } catch (err) {
    console.error("Error creating user:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/users/:id", async (req, res) => {
  const {
    name,
    avatar,
    priceLevel,
    cleanWeeks,
    missedWeeks,
    standing,
    cutoffHour,
    weekEndDay,
    isActive,
  } = req.body;

  const nameError = validateString(name, "Name", 1, 100);
  if (nameError) {
    res.status(400).json({ error: nameError });
    return;
  }

  if (avatar) {
    const avatarError = validateString(avatar, "Avatar", 1, 10);
    if (avatarError) {
      res.status(400).json({ error: avatarError });
      return;
    }
  }

  if (priceLevel !== undefined) {
    const levelError = validatePriceLevel(priceLevel);
    if (levelError) {
      res.status(400).json({ error: levelError });
      return;
    }
  }

  if (cleanWeeks !== undefined) {
    const cleanWeeksError = validateNumber(cleanWeeks, "Clean weeks", 0, 52);
    if (cleanWeeksError) {
      res.status(400).json({ error: cleanWeeksError });
      return;
    }
  }

  if (missedWeeks !== undefined) {
    const missedWeeksError = validateNumber(missedWeeks, "Missed weeks", 0, 52);
    if (missedWeeksError) {
      res.status(400).json({ error: missedWeeksError });
      return;
    }
  }

  try {
    const sanitizedName = sanitizeString(name);
    const sanitizedAvatar = avatar
      ? sanitizeString(avatar)
      : sanitizedName.charAt(0).toUpperCase();

    const result = await db.run(
      `UPDATE users SET
        name = ?,
        avatar = ?,
        price_level = ?,
        clean_weeks = ?,
        missed_weeks = ?,
        standing = ?,
        cutoff_hour = ?,
        week_end_day = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        sanitizedName,
        sanitizedAvatar,
        priceLevel || 1,
        cleanWeeks,
        missedWeeks,
        standing || (isActive === false ? "out" : "active"),
        cutoffHour ?? 0,
        weekEndDay ?? 7,
        req.params.id,
      ]
    );

    if (result.changes === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    debug(`Updated user: ${sanitizedName} (ID: ${req.params.id})`);

    const user = {
      id: req.params.id,
      name: sanitizedName,
      avatar: sanitizedAvatar,
      startDate: "2026-01-19",
      priceLevel,
      cleanWeeks,
      missedWeeks,
      standing,
      cutoffHour,
      weekEndDay,
      isActive: standing !== "out",
    };

    res.json(user);
  } catch (err) {
    console.error("Error updating user:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/users/:id", async (req, res) => {
  try {
    const result = await db.run("DELETE FROM users WHERE id = ?", [
      req.params.id,
    ]);

    if (result.changes === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    debug(`Deleted user ID: ${req.params.id}`);
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("Error deleting user:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== WORKOUT ROUTES ====================

app.get("/api/workouts", async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT wd.*, u.name as user_name
      FROM workout_days wd
      JOIN users u ON wd.user_id = u.id
      ORDER BY wd.week DESC, wd.day_of_week ASC
    `);

    const workouts = rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      week: row.week,
      dayOfWeek: row.day_of_week,
      date: row.date,
      isCompleted: Boolean(row.is_completed),
      workoutType: row.workout_type,
      notes: row.notes,
      markedBy: row.marked_by,
      timestamp: row.timestamp,
    }));

    debug(`Fetched ${workouts.length} workout records`);
    res.json(workouts);
  } catch (err) {
    console.error("Error fetching all workouts:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/workouts/user/:userId", async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT * FROM workout_days
      WHERE user_id = ?
      ORDER BY week DESC, day_of_week ASC`,
      [req.params.userId]
    );

    const workouts = rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      week: row.week,
      dayOfWeek: row.day_of_week,
      date: row.date,
      isCompleted: Boolean(row.is_completed),
      workoutType: row.workout_type,
      notes: row.notes,
      markedBy: row.marked_by,
      timestamp: row.timestamp,
    }));

    debug(
      `Fetched ${workouts.length} workouts for user ${req.params.userId}`
    );
    res.json(workouts);
  } catch (err) {
    console.error("Error fetching user workouts:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/workouts/:userId/:week", async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT * FROM workout_days
      WHERE user_id = ? AND week = ?
      ORDER BY day_of_week`,
      [req.params.userId, req.params.week]
    );

    const workouts = rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      week: row.week,
      dayOfWeek: row.day_of_week,
      date: row.date,
      isCompleted: Boolean(row.is_completed),
      workoutType: row.workout_type,
      notes: row.notes,
      markedBy: row.marked_by,
      timestamp: row.timestamp,
    }));

    res.json(workouts);
  } catch (err) {
    console.error("Error fetching workouts:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/workouts", async (req, res) => {
  const {
    userId,
    week,
    dayOfWeek,
    date,
    isCompleted,
    workoutType,
    notes,
    markedBy,
  } = req.body;

  if (denyUnlessOwner(req, res, userId)) return;

  if (!userId || week == null || dayOfWeek == null || !date) {
    res.status(400).json({
      error: "Missing required fields: userId, week, dayOfWeek, date",
    });
    return;
  }

  const validMarkedBy = ["user", "admin"].includes(markedBy)
    ? markedBy
    : "admin";

  const timestamp = new Date().toISOString();

  const weekNum = Number(week);
  const dayNum = Number(dayOfWeek);

  try {
    if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > 7) {
      res.status(400).json({ error: "dayOfWeek is 1-7, Monday to Sunday" });
      return;
    }
    if (!Number.isInteger(weekNum) || weekNum < 1 || weekNum > engine.SEASON_WEEKS) {
      res.status(400).json({ error: `Week is 1-${engine.SEASON_WEEKS}` });
      return;
    }
    // You cannot have trained in a week that has not happened.
    const currentWeek = await seasonCurrentWeek();
    if (weekNum > currentWeek) {
      res.status(400).json({
        error: `Week ${weekNum} hasn't started — the season is on week ${currentWeek}`,
      });
      return;
    }

    if (await denyIfOut(res, userId)) return;

    const existingRow = await db.get(
      `SELECT id FROM workout_days WHERE user_id = ? AND week = ? AND day_of_week = ?`,
      [userId, weekNum, dayNum]
    );

    const id = existingRow?.id || uuidv4();

    await db.run(
      `INSERT OR REPLACE INTO workout_days (
        id, user_id, week, day_of_week, date, is_completed,
        workout_type, notes, marked_by, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        weekNum,
        dayNum,
        date,
        isCompleted ? 1 : 0,
        workoutType || null,
        notes || null,
        validMarkedBy,
        timestamp,
      ]
    );

    debug(
      `Upserted workout for user ${userId}, week ${weekNum}, day ${dayNum}`
    );

    const workout = {
      id,
      userId,
      week: weekNum,
      dayOfWeek: dayNum,
      date,
      isCompleted,
      workoutType: workoutType || null,
      notes: notes || null,
      markedBy: validMarkedBy,
      timestamp,
    };

    res.json(workout);
  } catch (err) {
    console.error("Error upserting workout:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/workouts/:id", async (req, res) => {
  try {
    const result = await db.run("DELETE FROM workout_days WHERE id = ?", [
      req.params.id,
    ]);

    if (result.changes === 0) {
      res.status(404).json({ error: "Workout not found" });
      return;
    }

    debug(`Deleted workout ID: ${req.params.id}`);
    res.json({ message: "Workout deleted successfully" });
  } catch (err) {
    console.error("Error deleting workout:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/workouts/stats/:userId", async (req, res) => {
  try {
    const row = await db.get(
      `SELECT
        COUNT(*) as total_workouts,
        SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as completed_workouts,
        COUNT(DISTINCT week) as weeks_with_data,
        MAX(week) as latest_week
      FROM workout_days
      WHERE user_id = ?`,
      [req.params.userId]
    );

    const stats = {
      totalWorkouts: row.total_workouts || 0,
      completedWorkouts: row.completed_workouts || 0,
      weeksWithData: row.weeks_with_data || 0,
      latestWeek: row.latest_week || 0,
      completionRate:
        row.total_workouts > 0
          ? Math.round((row.completed_workouts / row.total_workouts) * 100)
          : 0,
    };

    res.json(stats);
  } catch (err) {
    console.error("Error fetching workout stats:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== GOALS ROUTES ====================

app.get("/api/goals", async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT g.*, u.name as user_name
      FROM goals g
      JOIN users u ON g.user_id = u.id
      ORDER BY g.created_date DESC
    `);

    const goals = rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      category: row.category,
      description: row.description,
      points: Number(row.points),
      baseline: row.baseline,
      target: row.target,
      baselineValue: row.baseline_value != null ? Number(row.baseline_value) : undefined,
      targetValue: row.target_value != null ? Number(row.target_value) : undefined,
      unit: row.unit,
      approvedAt: row.approved_at,
      isCompleted: Boolean(row.is_completed),
      completedDate: row.completed_date,
      createdDate: row.created_date,
      proofs: [],
    }));

    debug(`Fetched ${goals.length} goals`);
    res.json(goals);
  } catch (err) {
    console.error("Error fetching all goals:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/goals/user/:userId", async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT * FROM goals
      WHERE user_id = ?
      ORDER BY created_date DESC`,
      [req.params.userId]
    );

    const goals = rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      category: row.category,
      description: row.description,
      points: Number(row.points),
      baseline: row.baseline,
      target: row.target,
      baselineValue: row.baseline_value != null ? Number(row.baseline_value) : undefined,
      targetValue: row.target_value != null ? Number(row.target_value) : undefined,
      unit: row.unit,
      approvedAt: row.approved_at,
      isCompleted: Boolean(row.is_completed),
      completedDate: row.completed_date,
      createdDate: row.created_date,
      proofs: [],
    }));

    debug(
      `Fetched ${goals.length} goals for user ${req.params.userId}`
    );
    res.json(goals);
  } catch (err) {
    console.error("Error fetching user goals:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * The one shape a progress reading is reported in. Both the single-goal route
 * and the batch route map through it, so they cannot drift apart.
 */
const progressRow = (r) => ({
  id: r.id,
  value: Number(r.value),
  note: r.note,
  recordedAt: r.recorded_at,
});

// Every goal's readings in one shot, keyed by goal id. Same arrays as
// /api/goals/:id/progress, but one table read instead of one per goal — Turso
// charges a round trip each. Registered above /api/goals/:id so Express doesn't
// read "progress" as a goal id.
//
// ponytail: returns the whole table — a season of readings is a few hundred
// rows. Take a ?userId= filter if that ever stops being true.
app.get("/api/goals/progress", async (req, res) => {
  try {
    const rows = await db.all(
      "SELECT id, goal_id, value, note, recorded_at FROM goal_progress ORDER BY recorded_at ASC, id ASC"
    );
    const byGoal = {};
    for (const r of rows) {
      const list = byGoal[r.goal_id];
      if (list) list.push(progressRow(r));
      else byGoal[r.goal_id] = [progressRow(r)];
    }
    res.json(byGoal);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Rule 03: a goal is live once the group signs off.
 *
 * The inverse of denyUnlessOwner — signing off on your own goal is not a
 * sign-off, so the caller has to be a different player. Any of the nine will
 * do; this group is small enough that a quorum is a meeting, not a table.
 */
async function denyUnlessAnotherPlayer(req, res, ownerId) {
  const actor = actorOf(req);
  if (!actor) {
    res.status(401).json({ error: "Say who you are: send an x-player-id header" });
    return true;
  }
  if (actor === ownerId) {
    res.status(403).json({ error: "Sign-off comes from someone else. You can't approve your own goal." });
    return true;
  }
  const player = await db.get("SELECT id FROM users WHERE id = ?", [actor]);
  if (!player) {
    res.status(403).json({ error: "Only a player in this season can sign off a goal" });
    return true;
  }
  return false;
}

// Rule 03: another player signs the goal off and it goes live. Idempotent — the
// first signature is the one that counts, a second changes nothing.
app.post("/api/goals/:id/approve", async (req, res) => {
  try {
    const goal = await db.get("SELECT user_id, approved_at FROM goals WHERE id = ?", [req.params.id]);
    if (!goal) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }
    if (await denyUnlessAnotherPlayer(req, res, goal.user_id)) return;

    const approvedAt = goal.approved_at || new Date().toISOString();
    if (!goal.approved_at) {
      await db.run("UPDATE goals SET approved_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [
        approvedAt,
        req.params.id,
      ]);
    }
    res.json({ id: req.params.id, approvedAt, approvedBy: actorOf(req) });
  } catch (err) {
    console.error("Error approving goal:", err.message);
    res.status(500).json({ error: err.message });
  }
});

const petitionRow = (r) => ({
  id: r.id,
  goalId: r.goal_id,
  raisedBy: r.raised_by,
  raisedByName: r.raised_by_name,
  reason: r.reason,
  status: r.status,
  raisedAt: r.raised_at,
});

// Every open petition in the season, so the board shows the same thing to
// everyone. Registered above /api/goals/:id so Express doesn't read
// "petitions" as a goal id.
app.get("/api/goals/petitions", async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT p.*, u.name AS raised_by_name
       FROM petitions p JOIN users u ON p.raised_by = u.id
       ORDER BY p.raised_at DESC`
    );
    res.json(rows.map(petitionRow));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Rule 04: a completed goal may be replaced by petition.
 *
 * Raising it is the whole record kept here — who asked, against which goal,
 * when. The vote itself happens in the room: only people who attend get one,
 * the replacement must be worth the same points or more, and a tie keeps the
 * original.
 *
 * ponytail: no ballot table. Add one when the group actually votes in the app
 * rather than in person.
 */
app.post("/api/goals/:id/petitions", async (req, res) => {
  try {
    const goal = await db.get("SELECT user_id, is_completed FROM goals WHERE id = ?", [req.params.id]);
    if (!goal) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }
    if (denyUnlessOwner(req, res, goal.user_id)) return;
    if (!goal.is_completed) {
      res.status(400).json({ error: "Only a completed goal can be replaced. Finish this one first." });
      return;
    }

    const open = await db.get("SELECT id FROM petitions WHERE goal_id = ? AND status = 'open'", [
      req.params.id,
    ]);
    if (open) {
      res.status(409).json({ error: "A petition is already open on this goal" });
      return;
    }

    const id = uuidv4();
    const raisedAt = new Date().toISOString();
    const reason = req.body?.reason ? String(req.body.reason).slice(0, 200) : null;
    await db.run(
      "INSERT INTO petitions (id, goal_id, raised_by, reason, status, raised_at) VALUES (?, ?, ?, ?, 'open', ?)",
      [id, req.params.id, goal.user_id, reason, raisedAt]
    );

    const row = await db.get(
      `SELECT p.*, u.name AS raised_by_name
       FROM petitions p JOIN users u ON p.raised_by = u.id WHERE p.id = ?`,
      [id]
    );
    res.status(201).json(petitionRow(row));
  } catch (err) {
    console.error("Error raising petition:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/goals/:id", async (req, res) => {
  try {
    const row = await db.get(`SELECT * FROM goals WHERE id = ?`, [
      req.params.id,
    ]);

    if (!row) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }

    const goal = {
      id: row.id,
      userId: row.user_id,
      category: row.category,
      description: row.description,
      points: Number(row.points),
      baseline: row.baseline,
      target: row.target,
      baselineValue: row.baseline_value != null ? Number(row.baseline_value) : undefined,
      targetValue: row.target_value != null ? Number(row.target_value) : undefined,
      unit: row.unit,
      approvedAt: row.approved_at,
      isCompleted: Boolean(row.is_completed),
      completedDate: row.completed_date,
      createdDate: row.created_date,
      proofs: [],
    };

    res.json(goal);
  } catch (err) {
    console.error("Error fetching goal:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/goals", async (req, res) => {
  const { userId, category, description, points, baseline, target, baselineValue, targetValue, unit } = req.body;

  debug("Goal creation request:", { userId, category, description, points });

  if (!userId) {
    res.status(400).json({ error: "User ID is required" });
    return;
  }

  const categoryError = validateGoalCategory(category);
  if (categoryError) {
    res.status(400).json({ error: categoryError });
    return;
  }

  const descriptionError = validateString(description, "Description", 3, 500);
  if (descriptionError) {
    res.status(400).json({ error: descriptionError });
    return;
  }

  try {
    const userRow = await db.get("SELECT id FROM users WHERE id = ?", [userId]);

    if (!userRow) {
      console.error("User not found:", userId);
      res.status(404).json({ error: `User with ID ${userId} not found` });
      return;
    }

    if (denyUnlessOwner(req, res, userId)) return;

    // Rule 01 says a goal is measured by a number, and progress needs two of them:
    // where you start and what counts as done.
    const baseNum = Number(baselineValue);
    const targetNum = Number(targetValue);
    if (!Number.isFinite(baseNum) || !Number.isFinite(targetNum)) {
      res.status(400).json({
        error: "Give it a starting number and a target, so progress can be tracked.",
      });
      return;
    }
    if (baseNum === targetNum) {
      res.status(400).json({ error: "Start and target can't be the same — there'd be nothing to chase." });
      return;
    }

    // Rule 01: physical output, provable, measured by a number. The numbers above
    // satisfy the last test, so they are what the check reads.
    const eligibility = engine.goalEligibilityError(description, target ?? String(targetNum));
    if (eligibility) {
      res.status(400).json({ error: eligibility });
      return;
    }

    // Rule 02: 6 points across 2-6 goals. Reject anything that can't reach a legal split.
    const existingGoals = await db.all("SELECT points FROM goals WHERE user_id = ?", [userId]);
    const spent = existingGoals.reduce((sum, g) => sum + Number(g.points), 0);
    const wanted = Number(points) || 1;

    if (wanted < 1 || wanted > 3) {
      res.status(400).json({ error: "A goal is worth 1, 2 or 3 points" });
      return;
    }
    if (spent + wanted > 6) {
      res.status(400).json({
        error: `That would spend ${spent + wanted} of 6 points. ${6 - spent} left.`,
      });
      return;
    }
    if (existingGoals.length >= 6) {
      res.status(400).json({ error: "At most 6 goals" });
      return;
    }

    const id = uuidv4();
    const createdDate = new Date().toISOString().split("T")[0];
    const sanitizedDescription = sanitizeString(description);

    await db.run(
      `INSERT INTO goals (
        id, user_id, category, description, points, baseline, target,
        baseline_value, target_value, unit,
        is_completed, completed_date, created_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        category,
        sanitizedDescription,
        wanted,
        baseline || null,
        target || null,
        Number.isFinite(Number(baselineValue)) ? Number(baselineValue) : null,
        Number.isFinite(Number(targetValue)) ? Number(targetValue) : null,
        unit ? String(unit).slice(0, 20) : null,
        0,
        null,
        createdDate,
      ]
    );

    debug(`Created goal: ${sanitizedDescription} for user ${userId}`);

    const goal = {
      id,
      userId,
      category,
      description: sanitizedDescription,
      points: wanted,
      baseline: baseline || null,
      target: target || null,
      baselineValue: baseNum,
      targetValue: targetNum,
      unit: unit || null,
      isCompleted: false,
      completedDate: null,
      createdDate,
      proofs: [],
    };

    res.status(201).json(goal);
  } catch (err) {
    if (err.message.includes("FOREIGN KEY constraint failed")) {
      res.status(400).json({ error: `Invalid user ID: ${userId}` });
    } else {
      console.error("Error creating goal:", err.message);
      res.status(500).json({ error: err.message });
    }
  }
});

app.put("/api/goals/:id", async (req, res) => {
  const { description, points, baseline, target, isCompleted } = req.body;

  const descriptionError = validateString(description, "Description", 3, 500);
  if (descriptionError) {
    res.status(400).json({ error: descriptionError });
    return;
  }

  try {
    const owner = await db.get(
      "SELECT user_id, target_value, is_completed FROM goals WHERE id = ?",
      [req.params.id]
    );
    if (!owner) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }
    if (denyUnlessOwner(req, res, owner.user_id)) return;

    // Rule 11 gives the challenge title to the most goals completed AT TARGET.
    // A goal with numbers is completed by a reading that reaches the target —
    // POST /api/goals/:id/progress does that. This route is the only other way
    // is_completed could move, so it refuses to move it, in either direction:
    // hand-ticking would be a way to win by clicking, and hand-unticking would
    // be a way to bank a second completion off the same target.
    if (
      isCompleted !== undefined &&
      owner.target_value != null &&
      Boolean(isCompleted) !== Boolean(owner.is_completed)
    ) {
      res.status(400).json({
        error:
          "This goal is measured. Log a reading that reaches the target — completion follows the numbers, not a tap.",
      });
      return;
    }

    const eligibility = engine.goalEligibilityError(description, target);
    if (eligibility) {
      res.status(400).json({ error: eligibility });
      return;
    }

    // Changing a goal's points must still leave the player on a legal 6-point split.
    if (points !== undefined) {
      const currentGoal = await db.get("SELECT user_id, points FROM goals WHERE id = ?", [req.params.id]);
      if (currentGoal) {
        const others = await db.all(
          "SELECT points FROM goals WHERE user_id = ? AND id != ?",
          [currentGoal.user_id, req.params.id]
        );
        const spent = others.reduce((sum, g) => sum + Number(g.points), 0) + Number(points);
        if (Number(points) < 1 || Number(points) > 3) {
          res.status(400).json({ error: "A goal is worth 1, 2 or 3 points" });
          return;
        }
        if (spent > 6) {
          res.status(400).json({ error: `That would spend ${spent} of 6 points` });
          return;
        }
      }
    }

    const sanitizedDescription = sanitizeString(description);

    // null here means "leave completion alone". A measured goal always does —
    // its readings own those two columns. A legacy goal only moves when the
    // caller actually said so; leaving isCompleted out used to silently clear
    // it, which was the same bypass by omission.
    const nextCompleted =
      owner.target_value != null || isCompleted === undefined ? null : isCompleted ? 1 : 0;
    const completedDate = nextCompleted === 1 ? new Date().toISOString().split("T")[0] : null;

    const result = await db.run(
      `UPDATE goals SET
        description = ?,
        points = COALESCE(?, points),
        baseline = COALESCE(?, baseline),
        target = COALESCE(?, target),
        is_completed = COALESCE(?, is_completed),
        completed_date = CASE WHEN ? IS NULL THEN completed_date ELSE ? END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        sanitizedDescription,
        points ?? null,
        baseline ?? null,
        target ?? null,
        nextCompleted,
        nextCompleted,
        completedDate,
        req.params.id,
      ]
    );

    if (result.changes === 0) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }

    debug(`Updated goal: ${req.params.id}`);

    const row = await db.get(`SELECT * FROM goals WHERE id = ?`, [
      req.params.id,
    ]);

    const goal = {
      id: row.id,
      userId: row.user_id,
      category: row.category,
      description: row.description,
      points: Number(row.points),
      baseline: row.baseline,
      target: row.target,
      baselineValue: row.baseline_value != null ? Number(row.baseline_value) : undefined,
      targetValue: row.target_value != null ? Number(row.target_value) : undefined,
      unit: row.unit,
      approvedAt: row.approved_at,
      isCompleted: Boolean(row.is_completed),
      completedDate: row.completed_date,
      createdDate: row.created_date,
      proofs: [],
    };

    res.json(goal);
  } catch (err) {
    console.error("Error updating goal:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/goals/:id", async (req, res) => {
  try {
    const owner = await db.get("SELECT user_id FROM goals WHERE id = ?", [req.params.id]);
    if (!owner) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }
    if (denyUnlessOwner(req, res, owner.user_id)) return;

    const result = await db.run("DELETE FROM goals WHERE id = ?", [
      req.params.id,
    ]);

    if (result.changes === 0) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }

    debug(`Deleted goal ID: ${req.params.id}`);
    res.json({ message: "Goal deleted successfully" });
  } catch (err) {
    console.error("Error deleting goal:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/goals/stats/:userId", async (req, res) => {
  try {
    const row = await db.get(
      `SELECT
        COUNT(*) as total_goals,
        SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as completed_goals,
        SUM(points) as points_spent,
        COUNT(DISTINCT category) as categories_covered
      FROM goals
      WHERE user_id = ?`,
      [req.params.userId]
    );

    const stats = {
      totalGoals: row.total_goals || 0,
      completedGoals: row.completed_goals || 0,
      pointsSpent: row.points_spent || 0,
      categoriesCovered: row.categories_covered || 0,
      completionRate:
        row.total_goals > 0
          ? Math.round((row.completed_goals / row.total_goals) * 100)
          : 0,
    };

    res.json(stats);
  } catch (err) {
    console.error("Error fetching goal stats:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== WEEKLY PLANS ROUTES ====================

const serializeWeeklyPlan = (row) => {
  let committedDays = [];
  try {
    const parsed = JSON.parse(row.committed_days);
    if (Array.isArray(parsed)) committedDays = parsed.map((d) => Number(d));
  } catch (e) {
    committedDays = [];
  }
  return {
    id: row.id,
    userId: row.user_id,
    week: row.week,
    committedDays,
    committedAt: row.committed_at,
    createdBy: row.created_by,
    swapsUsed: Number(row.swaps_used || 0),
  };
};

app.get("/api/weekly-plans", async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT * FROM weekly_plans ORDER BY week DESC, user_id`
    );
    const plans = rows.map(serializeWeeklyPlan);
    debug(`Fetched ${plans.length} weekly plans`);
    res.json(plans);
  } catch (err) {
    console.error("Error fetching weekly plans:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/weekly-plans/:userId/:week", async (req, res) => {
  const userId = req.params.userId;
  const week = Number(req.params.week);
  if (!Number.isInteger(week) || week < 1) {
    res.status(400).json({ error: "week must be a positive integer" });
    return;
  }

  try {
    const row = await db.get(
      `SELECT * FROM weekly_plans WHERE user_id = ? AND week = ?`,
      [userId, week]
    );

    if (!row) {
      res.status(404).json({ error: "Weekly plan not found" });
      return;
    }

    res.json(serializeWeeklyPlan(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/weekly-plans", async (req, res) => {
  const { userId, week, committedDays, createdBy, override } = req.body;

  if (!userId || typeof userId !== "string") {
    res.status(400).json({ error: "userId is required" });
    return;
  }
  if (denyUnlessOwner(req, res, userId)) return;

  const weekNum = Number(week);
  if (!Number.isInteger(weekNum) || weekNum < 1) {
    res.status(400).json({ error: "week must be a positive integer" });
    return;
  }
  if (!Array.isArray(committedDays) || committedDays.length === 0) {
    res.status(400).json({ error: "committedDays must be a non-empty array" });
    return;
  }
  const daysAsNumbers = committedDays.map((d) => Number(d));
  for (const d of daysAsNumbers) {
    if (!Number.isInteger(d) || d < 1 || d > 7) {
      res
        .status(400)
        .json({ error: "committedDays must be integers in 1-7 (Mon-Sun)" });
      return;
    }
  }
  const uniqueDays = [...new Set(daysAsNumbers)];
  if (uniqueDays.length !== daysAsNumbers.length) {
    res.status(400).json({ error: "committedDays must be unique" });
    return;
  }
  uniqueDays.sort((a, b) => a - b);
  const validCreatedBy = ["user", "admin"].includes(createdBy)
    ? createdBy
    : "admin";
  const isAdminOverride = validCreatedBy === "admin" && override === true;

  try {
    const user = await db.get(
      `SELECT id, price_level, standing FROM users WHERE id = ?`,
      [userId]
    );

    if (!user) {
      res.status(404).json({ error: `User ${userId} not found` });
      return;
    }
    if (await denyIfOut(res, userId)) return;

    const required = engine.WORKOUTS_PER_WEEK;
    if (uniqueDays.length < required) {
      res.status(400).json({
        error: `A clean week is ${required} workouts, so commit to at least ${required} days`,
      });
      return;
    }

    const currentWeek = await seasonCurrentWeek();
    if (!isAdminOverride && currentWeek > 0 && weekNum < currentWeek) {
      res
        .status(400)
        .json({ error: "Cannot submit a plan for a past week" });
      return;
    }

    const existing = await db.get(
      `SELECT id, committed_at, swaps_used FROM weekly_plans WHERE user_id = ? AND week = ?`,
      [userId, weekNum]
    );

    // The week you are in can be planned, but only once: after that Rule 06 owns
    // the changes, so rewriting the plan cannot be used to dodge the one swap.
    if (!isAdminOverride && existing && weekNum === currentWeek) {
      res.status(403).json({
        error: "Your plan for this week is already set — move a day with your swap",
        lockReason: "already-committed",
      });
      return;
    }

    const id = existing?.id || uuidv4();
    const committedAt = existing?.committed_at || new Date().toISOString();
    const swapsUsed = Number(existing?.swaps_used || 0);

    // Upsert, not INSERT OR REPLACE: re-committing must not hand back a spent swap.
    await db.run(
      `INSERT INTO weekly_plans (
        id, user_id, week, committed_days, committed_at, created_by, swaps_used, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, week) DO UPDATE SET
        committed_days = excluded.committed_days,
        created_by = excluded.created_by,
        updated_at = CURRENT_TIMESTAMP`,
      [id, userId, weekNum, JSON.stringify(uniqueDays), committedAt, validCreatedBy]
    );

    debug(
      `Upserted weekly plan for user ${userId}, week ${weekNum}, days [${uniqueDays.join(",")}]`
    );

    res.json({
      id,
      userId,
      week: weekNum,
      committedDays: uniqueDays,
      committedAt,
      createdBy: validCreatedBy,
      swapsUsed,
    });
  } catch (err) {
    console.error("Error upserting weekly plan:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/weekly-plans/:userId/:week", async (req, res) => {
  const userId = req.params.userId;
  const week = Number(req.params.week);
  if (!Number.isInteger(week) || week < 1) {
    res.status(400).json({ error: "week must be a positive integer" });
    return;
  }
  if (denyUnlessOwner(req, res, userId)) return;

  try {
    // Rule 06 again: dropping a live plan and re-committing would hand back the
    // swap you already spent, so only weeks that have not started can be deleted.
    const currentWeek = await seasonCurrentWeek();
    if (!isAdminRequest(req) && week <= currentWeek) {
      res.status(403).json({
        error: "That week is under way — move a day with your swap instead of dropping the plan",
        lockReason: "already-committed",
      });
      return;
    }

    const result = await db.run(
      `DELETE FROM weekly_plans WHERE user_id = ? AND week = ?`,
      [userId, week]
    );

    if (result.changes === 0) {
      res.status(404).json({ error: "Weekly plan not found" });
      return;
    }

    debug(`Deleted weekly plan for user ${userId}, week ${week}`);
    res.json({ message: "Weekly plan deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rule 06: one swap a week, applied before the day starts.
app.post("/api/weekly-plans/:userId/:week/swap", async (req, res) => {
  try {
    const { userId, week } = req.params;
    const from = Number(req.body.from);
    const to = Number(req.body.to);

    if (![from, to].every((d) => Number.isInteger(d) && d >= 1 && d <= 7)) {
      res.status(400).json({ error: "from and to must be days 1-7" });
      return;
    }
    if (from === to) {
      res.status(400).json({ error: "Pick a different day to move it to" });
      return;
    }

    if (denyUnlessOwner(req, res, userId)) return;
    if (await denyIfOut(res, userId)) return;

    const plan = await db.get(
      "SELECT id, committed_days, swaps_used FROM weekly_plans WHERE user_id = ? AND week = ?",
      [userId, Number(week)]
    );
    if (!plan) {
      res.status(404).json({ error: "No plan for that week" });
      return;
    }
    if (Number(plan.swaps_used) >= 1) {
      res.status(400).json({ error: "One swap a week, and this week's is spent" });
      return;
    }

    const committed = JSON.parse(plan.committed_days);
    if (!committed.includes(from)) {
      res.status(400).json({ error: "That day isn't in your plan" });
      return;
    }
    if (committed.includes(to)) {
      res.status(400).json({ error: "You're already committed to that day" });
      return;
    }

    // Before the day starts, never after — for both the day being dropped and the one taking it.
    const currentWeek = await seasonCurrentWeek();
    if (Number(week) === currentWeek) {
      const today = currentISTDayOfWeek();
      if (from <= today || to <= today) {
        res.status(400).json({ error: "Swaps apply before the day starts, never after" });
        return;
      }
    } else if (Number(week) < currentWeek) {
      res.status(400).json({ error: "That week is already closed" });
      return;
    }

    const swapped = committed.filter((d) => d !== from).concat(to).sort((a, b) => a - b);
    await db.run(
      "UPDATE weekly_plans SET committed_days = ?, swaps_used = swaps_used + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [JSON.stringify(swapped), plan.id]
    );

    debug(`Swap for ${userId} week ${week}: day ${from} -> ${to}`);
    res.json({ userId, week: Number(week), committedDays: swapped, swapsUsed: Number(plan.swaps_used) + 1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/settings", async (req, res) => {
  try {
    const row = await db.get(
      "SELECT challenge_start_date, challenge_end_date, current_week, is_active FROM admin_settings WHERE id = 1"
    );
    if (!row) {
      res.status(404).json({ error: "Season not configured" });
      return;
    }
    res.json({
      challengeStartDate: row.challenge_start_date,
      challengeEndDate: row.challenge_end_date,
      currentWeek: Number(row.current_week),
      isActive: Boolean(row.is_active),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Move the season on.
 *
 * `current_week` is the season's clock: every fine, price level and standing is
 * replayed against it, and nothing was able to write it. Advancing closes the
 * week that just ended, so the fines it produced are posted here — by the same
 * `syncFines` the rest of the app uses, never by rule logic copied into a route.
 *
 * Going backwards is refused by default. Fines come from completed weeks, so a
 * rewind silently un-bills people; `{"force": true}` says you meant it.
 */
app.put("/api/settings", async (req, res) => {
  // Closing a week bills the whole group, so the caller has to say who they are.
  // Rule 12 leaves the admin seats unassigned, so any player may still do it —
  // this is the seam a real admin check slots into.
  if (!isAdminRequest(req) && !actorOf(req)) {
    res.status(401).json({ error: "Say who you are: send an x-player-id header" });
    return;
  }

  try {
    const current = await db.get(
      "SELECT challenge_start_date, challenge_end_date, current_week, is_active FROM admin_settings WHERE id = 1"
    );
    if (!current) {
      res.status(404).json({ error: "Season not configured" });
      return;
    }

    const { currentWeek, challengeStartDate, challengeEndDate, isActive, force } = req.body ?? {};
    const from = Number(current.current_week);
    const sets = [];
    const params = [];
    let to = from;

    if (currentWeek !== undefined) {
      to = Number(currentWeek);
      if (!Number.isInteger(to) || to < 1 || to > engine.SEASON_WEEKS) {
        res.status(400).json({ error: `currentWeek must be a whole number from 1 to ${engine.SEASON_WEEKS}` });
        return;
      }
      if (to < from && force !== true) {
        res.status(409).json({
          error:
            `Refusing to move the season back from week ${from} to week ${to}. Fines are derived from ` +
            `completed weeks, so rewinding un-bills people. Send {"force": true} to do it anyway.`,
        });
        return;
      }
      sets.push("current_week = ?");
      params.push(to);
    }

    for (const [value, column] of [
      [challengeStartDate, "challenge_start_date"],
      [challengeEndDate, "challenge_end_date"],
    ]) {
      if (value === undefined) continue;
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        res.status(400).json({ error: `${column} must be a YYYY-MM-DD date` });
        return;
      }
      sets.push(`${column} = ?`);
      params.push(value);
    }

    if (isActive !== undefined) {
      sets.push("is_active = ?");
      params.push(isActive ? 1 : 0);
    }

    if (sets.length === 0) {
      res.status(400).json({ error: "Nothing to update" });
      return;
    }

    await db.run(`UPDATE admin_settings SET ${sets.join(", ")} WHERE id = 1`, params);

    // The week that just closed is now scoreable, so bill it. syncFines also
    // voids anything the move stopped being a miss, which is what makes a forced
    // rewind honest rather than just cheap.
    const results = [];
    if (to !== from) {
      try {
        const players = await db.all("SELECT id, name FROM users WHERE standing != 'out'");
        for (const player of players) {
          const { issued, voided, state } = await syncFines(player.id);
          if (issued.length || voided.length) {
            results.push({ userId: player.id, name: player.name, issued, voided, standing: state.standing });
          }
        }
      } catch (err) {
        // The clock and the fines have to move together. There is no transaction
        // to lean on here, so put the week back rather than leave a season that
        // says week N but was never billed for week N-1.
        // ponytail: compensating write, not a transaction — good enough for one row.
        await db.run("UPDATE admin_settings SET current_week = ? WHERE id = 1", [from]);
        res.status(500).json({ error: `Fine sync failed, season left at week ${from}: ${err.message}` });
        return;
      }
    }

    const row = await db.get(
      "SELECT challenge_start_date, challenge_end_date, current_week, is_active FROM admin_settings WHERE id = 1"
    );
    const finesIssued = results.reduce((n, r) => n + r.issued.length, 0);
    const finesVoided = results.reduce((n, r) => n + r.voided.length, 0);
    debug(`Season week ${from} -> ${to}: issued ${finesIssued}, voided ${finesVoided} fine(s)`);

    res.json({
      challengeStartDate: row.challenge_start_date,
      challengeEndDate: row.challenge_end_date,
      currentWeek: Number(row.current_week),
      isActive: Boolean(row.is_active),
      movedFrom: from,
      movedTo: Number(row.current_week),
      finesIssued,
      finesVoided,
      results,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== GOAL PROGRESS ====================

/**
 * How far along a goal is, as a fraction of the distance from baseline to target.
 *
 * Direction is inferred: a target below the baseline means lower is better (a 5k
 * time), otherwise higher is better (a lift). Returns null when the goal has no
 * numbers to measure against.
 */
// The rules engine owns this — the UI draws its bar from the same function, so
// the server and the board cannot disagree about what "at target" means.
const progressFraction = engine.goalProgressFraction;

app.get("/api/goals/:id/progress", async (req, res) => {
  try {
    const rows = await db.all(
      "SELECT id, value, note, recorded_at FROM goal_progress WHERE goal_id = ? ORDER BY recorded_at ASC, id ASC",
      [req.params.id]
    );
    res.json(rows.map(progressRow));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Progress is appended, never overwritten — the history is the evidence Rule 01 asks for.
app.post("/api/goals/:id/progress", async (req, res) => {
  try {
    const { value, note } = req.body;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      res.status(400).json({ error: "Progress needs a number" });
      return;
    }
    if (numeric < 0) {
      res.status(400).json({ error: "Progress can't be negative" });
      return;
    }

    const goal = await db.get(
      "SELECT id, user_id, baseline_value, target_value, unit, is_completed FROM goals WHERE id = ?",
      [req.params.id]
    );
    if (!goal) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }

    if (denyUnlessOwner(req, res, goal.user_id)) return;

    const baseline = goal.baseline_value != null ? Number(goal.baseline_value) : null;
    const target = goal.target_value != null ? Number(goal.target_value) : null;

    // Ten goal-ranges away from the baseline is a typo, not a reading. Measured
    // as a fraction of baseline -> target, so it holds whichever way the goal
    // runs: a lift rises, a 5k time falls.
    if (baseline != null && target != null && target !== baseline) {
      if (Math.abs((numeric - baseline) / (target - baseline)) > 10) {
        res.status(400).json({
          error: `${numeric} ${goal.unit || ""}`.trim() + " is nowhere near this goal — check the number",
        });
        return;
      }
    }

    const recordedAt = new Date().toISOString();
    await db.run(
      "INSERT INTO goal_progress (id, goal_id, user_id, value, note, recorded_at) VALUES (?, ?, ?, ?, ?, ?)",
      [uuidv4(), req.params.id, goal.user_id, numeric, note ? String(note).slice(0, 200) : null, recordedAt]
    );

    // Hitting the target completes the goal; the group still has to approve any
    // replacement (Rule 04), so nothing else changes here.
    const fraction = progressFraction(baseline, target, numeric);
    const reached = fraction === 1;
    if (reached && !goal.is_completed) {
      await db.run("UPDATE goals SET is_completed = 1, completed_date = ? WHERE id = ?", [
        recordedAt.split("T")[0],
        req.params.id,
      ]);
    }

    res.status(201).json({ value: numeric, recordedAt, progress: fraction, completed: reached });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== GROUP FEED ====================

/**
 * What has happened in the season, newest first.
 *
 * Assembled from the records themselves rather than a written-to event log, so
 * the feed can never claim something the data doesn't support.
 */
app.get("/api/feed", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 40, 100);
    const [users, fines, tokens, goals, progress] = await Promise.all([
      db.all("SELECT id, name, avatar FROM users"),
      db.all("SELECT user_id, week, amount, price_level, issued_at, settled_at FROM fines WHERE voided_at IS NULL"),
      db.all("SELECT user_id, week, approved_at FROM skip_tokens WHERE approved_at IS NOT NULL"),
      db.all("SELECT id, user_id, description, points, completed_date FROM goals WHERE is_completed = 1"),
      db.all(
        `SELECT p.user_id, p.value, p.recorded_at, g.description, g.unit, g.baseline_value, g.target_value
         FROM goal_progress p JOIN goals g ON g.id = p.goal_id
         ORDER BY p.recorded_at DESC LIMIT 60`
      ),
    ]);

    const nameOf = new Map(users.map((u) => [u.id, u.name]));
    const events = [];

    for (const f of fines) {
      events.push({
        kind: "fine",
        userId: f.user_id,
        name: nameOf.get(f.user_id),
        at: f.issued_at,
        text: `missed week ${f.week} — ₹${Number(f.amount).toLocaleString("en-IN")}`,
        amount: Number(f.amount),
      });
      if (f.settled_at) {
        events.push({
          kind: "payment",
          userId: f.user_id,
          name: nameOf.get(f.user_id),
          at: f.settled_at,
          text: `paid ₹${Number(f.amount).toLocaleString("en-IN")} for week ${f.week}`,
          amount: Number(f.amount),
        });
      }
    }

    for (const t of tokens) {
      events.push({
        kind: "token",
        userId: t.user_id,
        name: nameOf.get(t.user_id),
        at: t.approved_at,
        text: `used a skip token for week ${t.week}`,
      });
    }

    for (const g of goals) {
      events.push({
        kind: "goal",
        userId: g.user_id,
        name: nameOf.get(g.user_id),
        at: g.completed_date ? `${g.completed_date}T12:00:00.000Z` : null,
        text: `completed "${g.description}" (${g.points} pt${g.points > 1 ? "s" : ""})`,
      });
    }

    for (const p of progress) {
      const fraction = progressFraction(
        p.baseline_value != null ? Number(p.baseline_value) : null,
        p.target_value != null ? Number(p.target_value) : null,
        Number(p.value)
      );
      events.push({
        kind: "progress",
        userId: p.user_id,
        name: nameOf.get(p.user_id),
        at: p.recorded_at,
        text: `logged ${p.value}${p.unit ? ` ${p.unit}` : ""} on "${p.description}"`,
        progress: fraction,
      });
    }

    const ordered = events
      .filter((e) => e.at && e.name)
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, limit);

    res.json(ordered);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== SEASON, FINES & SKIP TOKENS ====================

/**
 * Everything the season engine needs about one player, read from the raw record.
 * Fines are derived, never trusted from a stored column — the sheet is the truth.
 */
async function loadSeason(userId) {
  const [workoutRows, tokenRows, fineRows, settings] = await Promise.all([
    db.all(
      "SELECT user_id, week, day_of_week, is_completed FROM workout_days WHERE user_id = ?",
      [userId]
    ),
    db.all("SELECT week FROM skip_tokens WHERE user_id = ? AND approved_at IS NOT NULL", [userId]),
    db.all("SELECT week, settled_at FROM fines WHERE user_id = ? AND voided_at IS NULL", [userId]),
    db.get("SELECT current_week FROM admin_settings WHERE id = 1"),
  ]);

  const currentWeek = settings ? Number(settings.current_week) : 1;

  const workoutDays = workoutRows.map((r) => ({
    userId: r.user_id,
    week: Number(r.week),
    dayOfWeek: Number(r.day_of_week),
    isCompleted: Boolean(r.is_completed),
  }));

  const state = engine.runSeason({
    userId,
    workoutDays,
    skipWeeks: tokenRows.map((r) => Number(r.week)),
    settledWeeks: fineRows.filter((r) => r.settled_at).map((r) => Number(r.week)),
    completedWeeks: Math.max(0, currentWeek - 1),
  });

  return { state, currentWeek, workoutRows };
}

/**
 * Write the derived fines to the fines table so they can be settled and shown.
 * Idempotent: replaying the season never double-charges a week.
 */
async function syncFines(userId) {
  const { state } = await loadSeason(userId);
  const existing = await db.all(
    "SELECT id, week, amount, settled_at FROM fines WHERE user_id = ? AND voided_at IS NULL",
    [userId]
  );
  const known = new Set(existing.map((r) => Number(r.week)));

  // A week that is no longer a miss — logged late, or covered by a token — must
  // stop being billed. Otherwise the fines list demands money the season doesn't.
  const stillFined = new Map(state.weeks.filter((w) => w.fine > 0).map((w) => [w.week, w.fine]));
  const voided = [];
  for (const row of existing) {
    const week = Number(row.week);
    const owedNow = stillFined.get(week);

    if (owedNow == null) {
      await db.run(
        "UPDATE fines SET voided_at = ?, voided_reason = ? WHERE id = ?",
        [
          new Date().toISOString(),
          row.settled_at ? "week no longer fined — paid in credit" : "week no longer fined",
          row.id,
        ]
      );
      voided.push({ week, amount: Number(row.amount), wasSettled: Boolean(row.settled_at) });
      known.delete(week);
    } else if (Number(row.amount) !== owedNow && !row.settled_at) {
      // The price of that week can change when earlier weeks are edited.
      await db.run("UPDATE fines SET amount = ? WHERE id = ?", [owedNow, row.id]);
    }
  }

  const issued = [];
  for (const week of state.weeks) {
    if (week.fine <= 0 || known.has(week.week)) continue;
    const now = new Date();
    const due = new Date(now.getTime() + engine.PAYMENT_GRACE_HOURS * 60 * 60 * 1000);
    // One row per player-week, forever (UNIQUE(user_id, week)). A week that was
    // voided and then became a miss again — the season moved back and forward,
    // or a logged day was undone — has to revive that row, not insert a second.
    await db.run(
      `INSERT INTO fines (id, user_id, week, amount, price_level, issued_at, due_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, week) DO UPDATE SET
         amount = excluded.amount,
         price_level = excluded.price_level,
         issued_at = excluded.issued_at,
         due_at = excluded.due_at,
         voided_at = NULL,
         voided_reason = NULL`,
      [uuidv4(), userId, week.week, week.fine, week.priceLevel, now.toISOString(), due.toISOString()]
    );
    issued.push({ week: week.week, amount: week.fine });
  }

  // Keep the player row in step with what the replay says.
  await db.run(
    "UPDATE users SET price_level = ?, clean_weeks = ?, missed_weeks = ?, standing = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [state.priceLevel, state.cleanWeeks, state.missedWeeks, state.standing, userId]
  );

  return { issued, voided, state };
}

/**
 * The one shape a season is reported in. Both the single-player route and the
 * batch route build their response here, so they cannot drift apart.
 */
function seasonView(user, { state, currentWeek, workoutRows }, unsettled) {
  return {
    userId: user.id,
    name: user.name,
    currentWeek,
    priceLevel: state.priceLevel,
    fineIfMissed: engine.currentFine(state),
    standing: state.standing,
    suspendedAtWeek: state.suspendedAtWeek,
    outAtWeek: state.outAtWeek,
    cleanWeeks: state.cleanWeeks,
    missedWeeks: state.missedWeeks,
    cleanStreak: state.cleanStreak,
    missesAtLevel: state.missesAtLevel,
    tokensLeft: engine.MAX_SKIP_TOKENS - state.tokensUsed,
    billed: state.billed,
    paid: state.paid,
    outstanding: state.outstanding,
    potEligible: state.potEligible,
    weeks: state.weeks,
    // Not scored yet — the week is still running.
    currentWeekProgress: {
      week: currentWeek,
      workouts: workoutRows.filter(
        (r) => Number(r.week) === currentWeek && Boolean(r.is_completed)
      ).length,
      needed: engine.WORKOUTS_PER_WEEK,
    },
    unsettledFines: unsettled.map((f) => ({
      id: f.id,
      week: Number(f.week),
      amount: Number(f.amount),
      issuedAt: f.issued_at,
      dueAt: f.due_at,
      overdue: new Date(f.due_at) < new Date(),
    })),
  };
}

const groupByUser = (rows) => {
  const map = new Map();
  for (const row of rows) {
    const list = map.get(row.user_id);
    if (list) list.push(row);
    else map.set(row.user_id, [row]);
  }
  return map;
};

// Every player's season in one shot. Same objects as /api/season/:userId, but
// five table reads instead of five per player — Turso charges a round trip each.
app.get("/api/seasons", async (req, res) => {
  try {
    const [users, workoutRows, tokenRows, fineRows, settings] = await Promise.all([
      db.all("SELECT id, name FROM users ORDER BY name COLLATE NOCASE ASC"),
      db.all("SELECT user_id, week, day_of_week, is_completed FROM workout_days"),
      db.all("SELECT user_id, week FROM skip_tokens WHERE approved_at IS NOT NULL"),
      db.all(
        `SELECT user_id, id, week, amount, settled_at, issued_at, due_at
         FROM fines WHERE voided_at IS NULL ORDER BY week DESC`
      ),
      db.get("SELECT current_week FROM admin_settings WHERE id = 1"),
    ]);

    const currentWeek = settings ? Number(settings.current_week) : 1;
    const completedWeeks = Math.max(0, currentWeek - 1);
    const workoutsByUser = groupByUser(workoutRows);
    const tokensByUser = groupByUser(tokenRows);
    const finesByUser = groupByUser(fineRows);

    res.json(
      users.map((user) => {
        const mine = workoutsByUser.get(user.id) || [];
        const fines = finesByUser.get(user.id) || [];

        const state = engine.runSeason({
          userId: user.id,
          workoutDays: mine.map((r) => ({
            userId: r.user_id,
            week: Number(r.week),
            dayOfWeek: Number(r.day_of_week),
            isCompleted: Boolean(r.is_completed),
          })),
          skipWeeks: (tokensByUser.get(user.id) || []).map((r) => Number(r.week)),
          settledWeeks: fines.filter((r) => r.settled_at).map((r) => Number(r.week)),
          completedWeeks,
        });

        return seasonView(
          user,
          { state, currentWeek, workoutRows: mine },
          fines.filter((f) => !f.settled_at)
        );
      })
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Full derived state for one player: what a miss costs, what they owe, where they stand.
app.get("/api/season/:userId", async (req, res) => {
  try {
    const user = await db.get("SELECT id, name FROM users WHERE id = ?", [req.params.userId]);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const season = await loadSeason(req.params.userId);
    const unsettled = await db.all(
      `SELECT id, week, amount, issued_at, due_at FROM fines
       WHERE user_id = ? AND settled_at IS NULL AND voided_at IS NULL ORDER BY week DESC`,
      [req.params.userId]
    );

    res.json(seasonView(user, season, unsettled));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// The app posts fines itself. Nobody has to notice a missed week by hand.
app.post("/api/fines/sync", async (req, res) => {
  try {
    const userIds = req.body.userId
      ? [req.body.userId]
      : (await db.all("SELECT id FROM users WHERE standing != 'out'")).map((r) => r.id);

    const results = [];
    for (const userId of userIds) {
      const { issued, voided, state } = await syncFines(userId);
      results.push({ userId, issued, voided, standing: state.standing, outstanding: state.outstanding });
    }

    const total = results.reduce((n, r) => n + r.issued.length, 0);
    const retired = results.reduce((n, r) => n + r.voided.length, 0);
    debug(`Fine sync issued ${total} and voided ${retired} across ${userIds.length} player(s)`);
    res.json({ players: results.length, finesIssued: total, finesVoided: retired, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/fines", async (req, res) => {
  try {
    const { userId, unsettled } = req.query;
    const clauses = [];
    const params = [];
    if (userId) {
      clauses.push("user_id = ?");
      params.push(userId);
    }
    if (unsettled === "true") clauses.push("settled_at IS NULL");
    clauses.push("voided_at IS NULL");
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    const rows = await db.all(
      `SELECT id, user_id, week, amount, price_level, issued_at, due_at, settled_at
       FROM fines ${where} ORDER BY week DESC`,
      params
    );

    res.json(
      rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        week: Number(r.week),
        amount: Number(r.amount),
        priceLevel: Number(r.price_level),
        issuedAt: r.issued_at,
        dueAt: r.due_at,
        settledAt: r.settled_at,
        overdue: !r.settled_at && new Date(r.due_at) < new Date(),
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Settling clears the balance and, with it, a suspension.
app.post("/api/fines/:id/settle", async (req, res) => {
  try {
    const fine = await db.get("SELECT id, user_id, settled_at FROM fines WHERE id = ?", [req.params.id]);
    if (!fine) {
      res.status(404).json({ error: "Fine not found" });
      return;
    }
    if (denyUnlessOwner(req, res, fine.user_id)) return;
    if (await denyIfOut(res, fine.user_id)) return;
    if (fine.settled_at) {
      res.status(409).json({ error: "Fine already settled" });
      return;
    }

    await db.run("UPDATE fines SET settled_at = ? WHERE id = ?", [new Date().toISOString(), req.params.id]);
    const { state } = await syncFines(fine.user_id);

    res.json({ message: "Fine settled", standing: state.standing, outstanding: state.outstanding });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rule 09: three a season, never three in a row, dead in the final two weeks.
app.post("/api/skip-tokens", async (req, res) => {
  try {
    const { userId, week, approvedBy } = req.body;
    if (!userId || !week) {
      res.status(400).json({ error: "userId and week are required" });
      return;
    }
    if (denyUnlessOwner(req, res, userId)) return;
    if (await denyIfOut(res, userId)) return;

    const used = await db.all(
      "SELECT week FROM skip_tokens WHERE user_id = ? AND approved_at IS NOT NULL",
      [userId]
    );
    const settings = await db.get("SELECT current_week FROM admin_settings WHERE id = 1");
    const seasonWeeks = engine.SEASON_WEEKS;

    const blocker = engine.skipTokenBlocker(
      Number(week),
      seasonWeeks,
      used.map((r) => Number(r.week))
    );
    if (blocker) {
      res.status(400).json({ error: blocker });
      return;
    }
    if (settings && Number(week) < Number(settings.current_week)) {
      res.status(400).json({ error: "Appeal before your week starts" });
      return;
    }

    const now = new Date().toISOString();
    const id = uuidv4();
    await db.run(
      "INSERT INTO skip_tokens (id, user_id, week, requested_at, approved_at, approved_by) VALUES (?, ?, ?, ?, ?, ?)",
      [id, userId, Number(week), now, approvedBy ? now : null, approvedBy || null]
    );

    res.status(201).json({ id, userId, week: Number(week), approvedBy: approvedBy || null });
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) {
      res.status(409).json({ error: "A skip token already exists for that week" });
      return;
    }
    res.status(500).json({ error: err.message });
  }
});

// ==================== HEALTH CHECK ====================

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "FitBros 3.0 API is running",
    database: process.env.TURSO_DATABASE_URL ? "Turso" : "SQLite (local)",
    environment: isProduction ? "production" : "development",
    timestamp: new Date().toISOString(),
  });
});

// ==================== CATCH-ALL FOR REACT SPA ====================

if (isProduction && !isVercel) {
  app.get("*", (req, res) => {
    const buildPath = path.join(__dirname, "..", "build", "index.html");
    if (fs.existsSync(buildPath)) {
      res.sendFile(buildPath);
    } else {
      res.status(404).json({ error: "Frontend build not found" });
    }
  });
}

// ==================== START SERVER (standalone mode only) ====================

if (!isVercel) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 FitBois 2.0 API Server running on port ${PORT}`);
    console.log(
      `🌍 Environment: ${isProduction ? "production" : "development"}`
    );
    console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
  });

  process.on("SIGINT", () => {
    console.log("\n🛑 Shutting down server...");
    process.exit(0);
  });
}

module.exports = app;
