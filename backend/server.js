const express = require("express");
const cors = require("cors");
const compression = require("compression");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === "production";
const isVercel = process.env.VERCEL === "1";

const debug = isProduction ? () => {} : console.log;

// CORS configuration
const corsOptions = {
  origin: isProduction
    ? process.env.FRONTEND_URL || true
    : ["http://localhost:3000", "http://127.0.0.1:3000"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
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

  // Single batched DDL statement — reduces cold-start latency by avoiding
  // multiple sequential round-trips to the database.
  const ddl = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      avatar TEXT,
      start_date TEXT NOT NULL,
      current_consistency_level INTEGER NOT NULL DEFAULT 5,
      clean_weeks INTEGER NOT NULL DEFAULT 0,
      missed_weeks INTEGER NOT NULL DEFAULT 0,
      total_points INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT 1,
      special_starting_level INTEGER,
      reactivated_at_week INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      is_difficult BOOLEAN NOT NULL DEFAULT 0,
      is_completed BOOLEAN NOT NULL DEFAULT 0,
      completed_date TEXT,
      created_date TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      UNIQUE(user_id, category)
    );
    CREATE TABLE IF NOT EXISTS workout_days (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      week INTEGER NOT NULL,
      day_of_week INTEGER NOT NULL,
      date TEXT NOT NULL,
      is_completed BOOLEAN NOT NULL DEFAULT 0,
      workout_type TEXT,
      notes TEXT,
      marked_by TEXT NOT NULL DEFAULT 'admin',
      timestamp TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      UNIQUE(user_id, week, day_of_week)
    );
    CREATE TABLE IF NOT EXISTS proofs (
      id TEXT PRIMARY KEY,
      goal_id TEXT,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      url TEXT NOT NULL,
      description TEXT,
      timestamp TEXT NOT NULL,
      week INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (goal_id) REFERENCES goals (id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS weekly_updates (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      week INTEGER NOT NULL,
      year INTEGER NOT NULL,
      update_count INTEGER NOT NULL,
      required_updates INTEGER NOT NULL,
      is_complete BOOLEAN NOT NULL DEFAULT 0,
      submitted_date TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      UNIQUE(user_id, week, year)
    );
    CREATE TABLE IF NOT EXISTS weekly_plans (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      week INTEGER NOT NULL,
      committed_days TEXT NOT NULL,
      committed_at TEXT NOT NULL,
      created_by TEXT NOT NULL DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      UNIQUE(user_id, week)
    );
    CREATE TABLE IF NOT EXISTS admin_settings (
      id INTEGER PRIMARY KEY,
      challenge_start_date TEXT NOT NULL,
      challenge_end_date TEXT NOT NULL,
      current_week INTEGER NOT NULL DEFAULT 1,
      is_active BOOLEAN NOT NULL DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_workout_user ON workout_days (user_id);
    CREATE INDEX IF NOT EXISTS idx_workout_week ON workout_days (week);
    CREATE INDEX IF NOT EXISTS idx_workout_user_week ON workout_days (user_id, week);
    CREATE INDEX IF NOT EXISTS idx_goals_user ON goals (user_id);
    CREATE INDEX IF NOT EXISTS idx_goals_category ON goals (category);
    CREATE INDEX IF NOT EXISTS idx_weekly_plans_user ON weekly_plans (user_id);
    CREATE INDEX IF NOT EXISTS idx_weekly_plans_week ON weekly_plans (week);
  `;

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

const validateConsistencyLevel = (value) => {
  const level = Number(value);
  if (![3, 4, 5].includes(level)) {
    return "Consistency level must be 3, 4, or 5";
  }
  return null;
};

const validateGoalCategory = (value) => {
  const validCategories = [
    "cardio",
    "strength",
    "consistency",
    "sports",
    "personal-growth",
  ];
  if (!validCategories.includes(value)) {
    return `Category must be one of: ${validCategories.join(", ")}`;
  }
  return null;
};

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

const requiredWorkoutsForLevel = (level) => (Number(level) >= 5 ? 5 : 4);

// ==================== USER ROUTES ====================

app.get("/api/users", async (req, res) => {
  try {
    const rows = await db.all(`
      SELECT
        id, name, avatar, start_date, current_consistency_level,
        clean_weeks, missed_weeks, total_points, is_active,
        special_starting_level, reactivated_at_week, created_at, updated_at
      FROM users
      ORDER BY name COLLATE NOCASE ASC
    `);

    const users = rows.map((row) => ({
      id: row.id,
      name: row.name,
      avatar: row.avatar,
      startDate: row.start_date,
      currentConsistencyLevel: row.current_consistency_level,
      cleanWeeks: row.clean_weeks,
      missedWeeks: row.missed_weeks,
      totalPoints: row.total_points,
      isActive: Boolean(row.is_active),
      specialRules:
        row.special_starting_level || row.reactivated_at_week
          ? {
              startingLevel: row.special_starting_level || undefined,
              reactivatedAtWeek: row.reactivated_at_week || undefined,
            }
          : undefined,
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
        id, name, avatar, start_date, current_consistency_level,
        clean_weeks, missed_weeks, total_points, is_active,
        special_starting_level, reactivated_at_week, created_at, updated_at
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
      currentConsistencyLevel: row.current_consistency_level,
      cleanWeeks: row.clean_weeks,
      missedWeeks: row.missed_weeks,
      totalPoints: row.total_points,
      isActive: Boolean(row.is_active),
      specialRules:
        row.special_starting_level || row.reactivated_at_week
          ? {
              startingLevel: row.special_starting_level || undefined,
              reactivatedAtWeek: row.reactivated_at_week || undefined,
            }
          : undefined,
    };

    res.json(user);
  } catch (err) {
    console.error("Error fetching user:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/users", async (req, res) => {
  const {
    name,
    avatar,
    currentConsistencyLevel,
    cleanWeeks,
    missedWeeks,
    isActive,
    specialRules,
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

  if (currentConsistencyLevel !== undefined) {
    const levelError = validateConsistencyLevel(currentConsistencyLevel);
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

  if (specialRules?.startingLevel !== undefined) {
    const startingLevelError = validateConsistencyLevel(
      specialRules.startingLevel
    );
    if (startingLevelError) {
      res
        .status(400)
        .json({ error: `Special starting level: ${startingLevelError}` });
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
        id, name, avatar, start_date, current_consistency_level,
        clean_weeks, missed_weeks, total_points, is_active, special_starting_level
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sanitizedName,
        sanitizedAvatar,
        startDate,
        currentConsistencyLevel || 5,
        cleanWeeks || 0,
        missedWeeks || 0,
        0,
        isActive !== false ? 1 : 0,
        specialRules?.startingLevel || null,
      ]
    );

    debug(`Created user: ${sanitizedName} (ID: ${id})`);

    const user = {
      id,
      name: sanitizedName,
      avatar: sanitizedAvatar,
      startDate,
      currentConsistencyLevel: currentConsistencyLevel || 5,
      cleanWeeks: cleanWeeks || 0,
      missedWeeks: missedWeeks || 0,
      totalPoints: 0,
      isActive: isActive !== false,
      specialRules: specialRules?.startingLevel
        ? { startingLevel: specialRules.startingLevel }
        : undefined,
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
    currentConsistencyLevel,
    cleanWeeks,
    missedWeeks,
    totalPoints,
    isActive,
    specialRules,
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

  if (currentConsistencyLevel !== undefined) {
    const levelError = validateConsistencyLevel(currentConsistencyLevel);
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

  if (totalPoints !== undefined) {
    const pointsError = validateNumber(totalPoints, "Total points", 0, 10000);
    if (pointsError) {
      res.status(400).json({ error: pointsError });
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
        current_consistency_level = ?,
        clean_weeks = ?,
        missed_weeks = ?,
        total_points = ?,
        is_active = ?,
        special_starting_level = ?,
        reactivated_at_week = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        sanitizedName,
        sanitizedAvatar,
        currentConsistencyLevel,
        cleanWeeks,
        missedWeeks,
        totalPoints,
        isActive ? 1 : 0,
        specialRules?.startingLevel || null,
        specialRules?.reactivatedAtWeek || null,
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
      currentConsistencyLevel,
      cleanWeeks,
      missedWeeks,
      totalPoints,
      isActive,
      specialRules:
        specialRules?.startingLevel || specialRules?.reactivatedAtWeek
          ? {
              startingLevel: specialRules.startingLevel || undefined,
              reactivatedAtWeek: specialRules.reactivatedAtWeek || undefined,
            }
          : undefined,
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
    // Optional ?since=YYYY-MM-DD lets the frontend ask for just recent rows
    // on initial load. Default behavior (no param) returns the full history
    // so existing callers stay backward compatible.
    const since = typeof req.query.since === "string" ? req.query.since : null;
    const sinceValid = since && /^\d{4}-\d{2}-\d{2}$/.test(since);

    const sql = sinceValid
      ? `SELECT wd.*, u.name as user_name
         FROM workout_days wd
         JOIN users u ON wd.user_id = u.id
         WHERE wd.date >= ?
         ORDER BY wd.week DESC, wd.day_of_week ASC`
      : `SELECT wd.*, u.name as user_name
         FROM workout_days wd
         JOIN users u ON wd.user_id = u.id
         ORDER BY wd.week DESC, wd.day_of_week ASC`;

    const rows = await db.all(sql, sinceValid ? [since] : []);

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

    debug(
      `Fetched ${workouts.length} workout records${sinceValid ? ` since ${since}` : ""}`
    );
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

  if (!userId || !week || !dayOfWeek || !date) {
    res.status(400).json({
      error: "Missing required fields: userId, week, dayOfWeek, date",
    });
    return;
  }

  const validMarkedBy = ["user", "admin"].includes(markedBy)
    ? markedBy
    : "admin";

  const timestamp = new Date().toISOString();

  try {
    const existingRow = await db.get(
      `SELECT id FROM workout_days WHERE user_id = ? AND week = ? AND day_of_week = ?`,
      [userId, week, dayOfWeek]
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
        week,
        dayOfWeek,
        date,
        isCompleted ? 1 : 0,
        workoutType || null,
        notes || null,
        validMarkedBy,
        timestamp,
      ]
    );

    debug(
      `Upserted workout for user ${userId}, week ${week}, day ${dayOfWeek}`
    );

    const workout = {
      id,
      userId,
      week,
      dayOfWeek,
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
      isDifficult: Boolean(row.is_difficult),
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
      isDifficult: Boolean(row.is_difficult),
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
      isDifficult: Boolean(row.is_difficult),
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
  const { userId, category, description, isDifficult } = req.body;

  debug("Goal creation request:", { userId, category, description, isDifficult });

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

    if (isDifficult) {
      const existing = await db.get(
        "SELECT id FROM goals WHERE user_id = ? AND is_difficult = 1",
        [userId]
      );
      if (existing) {
        res.status(400).json({
          error: "User already has a difficult goal. Only 1 difficult goal is allowed per person.",
        });
        return;
      }
    }

    const id = uuidv4();
    const createdDate = new Date().toISOString().split("T")[0];
    const sanitizedDescription = sanitizeString(description);

    await db.run(
      `INSERT INTO goals (
        id, user_id, category, description, is_difficult,
        is_completed, completed_date, created_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        category,
        sanitizedDescription,
        isDifficult ? 1 : 0,
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
      isDifficult: isDifficult || false,
      isCompleted: false,
      completedDate: null,
      createdDate,
      proofs: [],
    };

    res.status(201).json(goal);
  } catch (err) {
    if (err.message.includes("UNIQUE constraint failed")) {
      res.status(409).json({
        error: `User already has a goal in the ${category} category`,
      });
    } else if (err.message.includes("FOREIGN KEY constraint failed")) {
      res.status(400).json({ error: `Invalid user ID: ${userId}` });
    } else {
      console.error("Error creating goal:", err.message);
      res.status(500).json({ error: err.message });
    }
  }
});

app.put("/api/goals/:id", async (req, res) => {
  const { description, isDifficult, isCompleted } = req.body;

  const descriptionError = validateString(description, "Description", 3, 500);
  if (descriptionError) {
    res.status(400).json({ error: descriptionError });
    return;
  }

  try {
    if (isDifficult) {
      const currentGoal = await db.get("SELECT user_id, is_difficult FROM goals WHERE id = ?", [req.params.id]);
      if (currentGoal && !currentGoal.is_difficult) {
        const existing = await db.get(
          "SELECT id FROM goals WHERE user_id = ? AND is_difficult = 1 AND id != ?",
          [currentGoal.user_id, req.params.id]
        );
        if (existing) {
          res.status(400).json({
            error: "User already has a difficult goal. Only 1 difficult goal is allowed per person.",
          });
          return;
        }
      }
    }

    const sanitizedDescription = sanitizeString(description);
    const completedDate = isCompleted
      ? new Date().toISOString().split("T")[0]
      : null;

    const result = await db.run(
      `UPDATE goals SET
        description = ?,
        is_difficult = ?,
        is_completed = ?,
        completed_date = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        sanitizedDescription,
        isDifficult ? 1 : 0,
        isCompleted ? 1 : 0,
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
      isDifficult: Boolean(row.is_difficult),
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
        SUM(CASE WHEN is_difficult = 1 THEN 1 ELSE 0 END) as difficult_goals,
        COUNT(DISTINCT category) as categories_covered
      FROM goals
      WHERE user_id = ?`,
      [req.params.userId]
    );

    const stats = {
      totalGoals: row.total_goals || 0,
      completedGoals: row.completed_goals || 0,
      difficultGoals: row.difficult_goals || 0,
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
      `SELECT id, current_consistency_level, is_active FROM users WHERE id = ?`,
      [userId]
    );

    if (!user) {
      res.status(404).json({ error: `User ${userId} not found` });
      return;
    }
    if (!user.is_active) {
      res
        .status(403)
        .json({ error: "User is eliminated — cannot submit a plan" });
      return;
    }

    const required = requiredWorkoutsForLevel(user.current_consistency_level);
    if (uniqueDays.length < required) {
      res.status(400).json({
        error: `Level ${user.current_consistency_level} users must commit to at least ${required} days`,
      });
      return;
    }

    const currentWeek = getCurrentWeekIST();
    if (!isAdminOverride && currentWeek > 0 && weekNum < currentWeek) {
      res
        .status(400)
        .json({ error: "Cannot submit a plan for a past week" });
      return;
    }

    if (!isAdminOverride && weekNum === currentWeek) {
      res.status(403).json({
        error:
          "Commitment window closed — plans for this week had to be set by Sunday 23:59 IST of the prior week",
        lockReason: "deadline-passed",
      });
      return;
    }

    const existing = await db.get(
      `SELECT id, committed_at FROM weekly_plans WHERE user_id = ? AND week = ?`,
      [userId, weekNum]
    );

    const id = existing?.id || uuidv4();
    const committedAt = existing?.committed_at || new Date().toISOString();

    await db.run(
      `INSERT OR REPLACE INTO weekly_plans (
        id, user_id, week, committed_days, committed_at, created_by, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
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

  try {
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

// ==================== HEALTH CHECK ====================

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "FitBois 2.0 API is running",
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
