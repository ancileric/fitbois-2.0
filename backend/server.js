const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
// const multer = require("multer");

// Configure multer for file uploads
// const upload = multer({ dest: "/tmp/" });

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === "production";

// Per-request debug logs are dev-only noise; errors always surface via console.error.
const debug = isProduction ? () => {} : console.log;

// CORS configuration
const corsOptions = {
  origin: isProduction
    ? process.env.FRONTEND_URL || true // Allow configured frontend URL or any in production
    : ["http://localhost:3000", "http://127.0.0.1:3000"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// Middleware
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from React build in production
if (isProduction) {
  const buildPath = path.join(__dirname, "..", "build");
  if (fs.existsSync(buildPath)) {
    app.use(express.static(buildPath));
    console.log("✅ Serving static files from:", buildPath);
  }
}

// Database connection
const dbDir = path.join(__dirname, "database");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.join(dbDir, "fitbois.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
    process.exit(1);
  }
  console.log("✅ Connected to SQLite database at:", dbPath);
});

// Enable foreign keys
db.run("PRAGMA foreign_keys = ON");

// Run schema migrations for existing databases
db.run(
  "ALTER TABLE users ADD COLUMN reactivated_at_week INTEGER",
  (err) => {
    if (err && !err.message.includes("duplicate column name")) {
      console.error("Migration error (reactivated_at_week):", err.message);
    } else {
      console.log("✅ Migration: reactivated_at_week column ready");
    }
  }
);

// Create weekly_plans table if it doesn't exist (self-heal for existing DBs)
db.run(
  `CREATE TABLE IF NOT EXISTS weekly_plans (
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
  )`,
  (err) => {
    if (err) {
      console.error("Error creating weekly_plans table:", err.message);
    } else {
      console.log("✅ Migration: weekly_plans table ready");
    }
  }
);

// Create indexes if they don't exist (for existing databases)
const createIndexes = () => {
  const indexes = [
    "CREATE INDEX IF NOT EXISTS idx_workout_user ON workout_days (user_id)",
    "CREATE INDEX IF NOT EXISTS idx_workout_week ON workout_days (week)",
    "CREATE INDEX IF NOT EXISTS idx_workout_user_week ON workout_days (user_id, week)",
    "CREATE INDEX IF NOT EXISTS idx_goals_user ON goals (user_id)",
    "CREATE INDEX IF NOT EXISTS idx_goals_category ON goals (category)",
    "CREATE INDEX IF NOT EXISTS idx_weekly_plans_user ON weekly_plans (user_id)",
    "CREATE INDEX IF NOT EXISTS idx_weekly_plans_week ON weekly_plans (week)",
  ];

  indexes.forEach((sql) => {
    db.run(sql, (err) => {
      if (err) console.error("Index creation error:", err.message);
    });
  });
  console.log("✅ Database indexes verified");
};
createIndexes();

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
  // Remove potentially dangerous characters while preserving useful ones
  return value.trim().replace(/[<>]/g, "");
};

// ==================== IST DATE HELPERS ====================
// Challenge start (Monday, IST). MUST match frontend src/utils/dateUtils.ts.
const CHALLENGE_START_UTC_MS = Date.UTC(2026, 0, 19);
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Returns the current challenge week (1-based) in IST, or 0 before start.
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

// Returns 1 (Monday) through 7 (Sunday) in IST.
const currentISTDayOfWeek = () => {
  const istNow = new Date(Date.now() + IST_OFFSET_MS);
  const jsDow = istNow.getUTCDay(); // 0=Sun..6=Sat
  return jsDow === 0 ? 7 : jsDow;
};

const requiredWorkoutsForLevel = (level) => (Number(level) >= 5 ? 5 : 4);

// ==================== USER ROUTES ====================

// GET all users
app.get("/api/users", (req, res) => {
  const query = `
    SELECT
      id, name, avatar, start_date, current_consistency_level,
      clean_weeks, missed_weeks, total_points, is_active,
      special_starting_level, reactivated_at_week, created_at, updated_at
    FROM users
    ORDER BY name COLLATE NOCASE ASC
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("Error fetching users:", err.message);
      res.status(500).json({ error: err.message });
      return;
    }

    // Transform database format to frontend format
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
  });
});

// GET single user by ID
app.get("/api/users/:id", (req, res) => {
  const query = `
    SELECT
      id, name, avatar, start_date, current_consistency_level,
      clean_weeks, missed_weeks, total_points, is_active,
      special_starting_level, reactivated_at_week, created_at, updated_at
    FROM users
    WHERE id = ?
  `;

  db.get(query, [req.params.id], (err, row) => {
    if (err) {
      console.error("Error fetching user:", err.message);
      res.status(500).json({ error: err.message });
      return;
    }

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
  });
});

// POST create new user
app.post("/api/users", (req, res) => {
  const {
    name,
    avatar,
    currentConsistencyLevel,
    cleanWeeks,
    missedWeeks,
    isActive,
    specialRules,
  } = req.body;

  // Validate required fields
  const nameError = validateString(name, "Name", 1, 100);
  if (nameError) {
    res.status(400).json({ error: nameError });
    return;
  }

  // Validate optional fields
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
      specialRules.startingLevel,
    );
    if (startingLevelError) {
      res
        .status(400)
        .json({ error: `Special starting level: ${startingLevelError}` });
      return;
    }
  }

  const id = uuidv4();
  const startDate = "2026-01-19"; // Challenge start date
  const sanitizedName = sanitizeString(name);
  const sanitizedAvatar = avatar
    ? sanitizeString(avatar)
    : sanitizedName.charAt(0).toUpperCase();

  const query = `
    INSERT INTO users (
      id, name, avatar, start_date, current_consistency_level,
      clean_weeks, missed_weeks, total_points, is_active, special_starting_level
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    id,
    sanitizedName,
    sanitizedAvatar,
    startDate,
    currentConsistencyLevel || 5,
    cleanWeeks || 0,
    missedWeeks || 0,
    0, // total_points starts at 0
    isActive !== false ? 1 : 0,
    specialRules?.startingLevel || null,
  ];

  db.run(query, params, function (err) {
    if (err) {
      console.error("Error creating user:", err.message);
      res.status(500).json({ error: err.message });
      return;
    }

    debug(`Created user: ${sanitizedName} (ID: ${id})`);

    // Return the created user
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
        ? {
            startingLevel: specialRules.startingLevel,
          }
        : undefined,
    };

    res.status(201).json(user);
  });
});

// PUT update user
app.put("/api/users/:id", (req, res) => {
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

  // Validate required fields
  const nameError = validateString(name, "Name", 1, 100);
  if (nameError) {
    res.status(400).json({ error: nameError });
    return;
  }

  // Validate optional fields
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

  const sanitizedName = sanitizeString(name);
  const sanitizedAvatar = avatar
    ? sanitizeString(avatar)
    : sanitizedName.charAt(0).toUpperCase();

  const query = `
    UPDATE users SET
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
    WHERE id = ?
  `;

  const params = [
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
  ];

  db.run(query, params, function (err) {
    if (err) {
      console.error("Error updating user:", err.message);
      res.status(500).json({ error: err.message });
      return;
    }

    if (this.changes === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    debug(`Updated user: ${sanitizedName} (ID: ${req.params.id})`);

    // Return the updated user
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
  });
});

// DELETE user
app.delete("/api/users/:id", (req, res) => {
  const query = "DELETE FROM users WHERE id = ?";

  db.run(query, [req.params.id], function (err) {
    if (err) {
      console.error("Error deleting user:", err.message);
      res.status(500).json({ error: err.message });
      return;
    }

    if (this.changes === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    debug(`Deleted user ID: ${req.params.id}`);
    res.json({ message: "User deleted successfully" });
  });
});

// ==================== WORKOUT ROUTES ====================

// GET all workouts (for admin overview)
app.get("/api/workouts", (req, res) => {
  const query = `
    SELECT wd.*, u.name as user_name 
    FROM workout_days wd
    JOIN users u ON wd.user_id = u.id
    ORDER BY wd.week DESC, wd.day_of_week ASC
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("Error fetching all workouts:", err.message);
      res.status(500).json({ error: err.message });
      return;
    }

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
  });
});

// GET workout days for a specific user
app.get("/api/workouts/user/:userId", (req, res) => {
  const query = `
    SELECT * FROM workout_days 
    WHERE user_id = ?
    ORDER BY week DESC, day_of_week ASC
  `;

  db.all(query, [req.params.userId], (err, rows) => {
    if (err) {
      console.error("Error fetching user workouts:", err.message);
      res.status(500).json({ error: err.message });
      return;
    }

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
      `Fetched ${workouts.length} workouts for user ${req.params.userId}`,
    );
    res.json(workouts);
  });
});

// GET workout days for a user and week
app.get("/api/workouts/:userId/:week", (req, res) => {
  const query = `
    SELECT * FROM workout_days 
    WHERE user_id = ? AND week = ?
    ORDER BY day_of_week
  `;

  db.all(query, [req.params.userId, req.params.week], (err, rows) => {
    if (err) {
      console.error("Error fetching workouts:", err.message);
      res.status(500).json({ error: err.message });
      return;
    }

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
  });
});

// POST/PUT workout day (upsert) - Uses INSERT OR REPLACE to avoid race conditions
app.post("/api/workouts", (req, res) => {
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
    res
      .status(400)
      .json({
        error: "Missing required fields: userId, week, dayOfWeek, date",
      });
    return;
  }

  // Validate markedBy field
  const validMarkedBy = ["user", "admin"].includes(markedBy)
    ? markedBy
    : "admin";

  const timestamp = new Date().toISOString();

  // First, check if a record exists to preserve the ID
  const checkQuery = `SELECT id FROM workout_days WHERE user_id = ? AND week = ? AND day_of_week = ?`;

  db.get(checkQuery, [userId, week, dayOfWeek], (err, existingRow) => {
    if (err) {
      console.error("Error checking existing workout:", err.message);
      res.status(500).json({ error: err.message });
      return;
    }

    const id = existingRow?.id || uuidv4();

    // Use INSERT OR REPLACE to handle race conditions atomically
    const upsertQuery = `
      INSERT OR REPLACE INTO workout_days (
        id, user_id, week, day_of_week, date, is_completed,
        workout_type, notes, marked_by, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
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
    ];

    db.run(upsertQuery, params, function (err) {
      if (err) {
        console.error("Error upserting workout:", err.message);
        res.status(500).json({ error: err.message });
        return;
      }

      debug(
        `Upserted workout for user ${userId}, week ${week}, day ${dayOfWeek}`,
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
    });
  });
});

// DELETE workout day
app.delete("/api/workouts/:id", (req, res) => {
  const query = "DELETE FROM workout_days WHERE id = ?";

  db.run(query, [req.params.id], function (err) {
    if (err) {
      console.error("Error deleting workout:", err.message);
      res.status(500).json({ error: err.message });
      return;
    }

    if (this.changes === 0) {
      res.status(404).json({ error: "Workout not found" });
      return;
    }

    debug(`Deleted workout ID: ${req.params.id}`);
    res.json({ message: "Workout deleted successfully" });
  });
});

// GET workout statistics for a user
app.get("/api/workouts/stats/:userId", (req, res) => {
  const query = `
    SELECT 
      COUNT(*) as total_workouts,
      SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as completed_workouts,
      COUNT(DISTINCT week) as weeks_with_data,
      MAX(week) as latest_week
    FROM workout_days 
    WHERE user_id = ?
  `;

  db.get(query, [req.params.userId], (err, row) => {
    if (err) {
      console.error("Error fetching workout stats:", err.message);
      res.status(500).json({ error: err.message });
      return;
    }

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
  });
});

// ==================== GOALS ROUTES ====================

// GET all goals
app.get("/api/goals", (req, res) => {
  const query = `
    SELECT g.*, u.name as user_name 
    FROM goals g
    JOIN users u ON g.user_id = u.id
    ORDER BY g.created_date DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("Error fetching all goals:", err.message);
      res.status(500).json({ error: err.message });
      return;
    }

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
      proofs: [], // Will be populated when proofs table is implemented
    }));

    debug(`Fetched ${goals.length} goals`);
    res.json(goals);
  });
});

// GET goals for a specific user
app.get("/api/goals/user/:userId", (req, res) => {
  const query = `
    SELECT * FROM goals 
    WHERE user_id = ?
    ORDER BY created_date DESC
  `;

  db.all(query, [req.params.userId], (err, rows) => {
    if (err) {
      console.error("Error fetching user goals:", err.message);
      res.status(500).json({ error: err.message });
      return;
    }

    const goals = rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      category: row.category,
      description: row.description,
      isDifficult: Boolean(row.is_difficult),
      isCompleted: Boolean(row.is_completed),
      completedDate: row.completed_date,
      createdDate: row.created_date,
      proofs: [], // Will be populated when proofs table is implemented
    }));

    debug(
      `Fetched ${goals.length} goals for user ${req.params.userId}`,
    );
    res.json(goals);
  });
});

// GET single goal by ID
app.get("/api/goals/:id", (req, res) => {
  const query = `SELECT * FROM goals WHERE id = ?`;

  db.get(query, [req.params.id], (err, row) => {
    if (err) {
      console.error("Error fetching goal:", err.message);
      res.status(500).json({ error: err.message });
      return;
    }

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
      proofs: [], // Will be populated when proofs table is implemented
    };

    res.json(goal);
  });
});

// POST create new goal
app.post("/api/goals", (req, res) => {
  const { userId, category, description, isDifficult } = req.body;

  debug("Goal creation request:", {
    userId,
    category,
    description,
    isDifficult,
  });

  // Validate required fields
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

  // First, check if the user exists
  const userCheckQuery = "SELECT id FROM users WHERE id = ?";
  db.get(userCheckQuery, [userId], (err, userRow) => {
    if (err) {
      console.error("Error checking user existence:", err.message);
      res.status(500).json({ error: "Database error checking user" });
      return;
    }

    if (!userRow) {
      console.error("User not found:", userId);
      res.status(404).json({ error: `User with ID ${userId} not found` });
      return;
    }

    const id = uuidv4();
    const createdDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
    const sanitizedDescription = sanitizeString(description);

    const query = `
      INSERT INTO goals (
        id, user_id, category, description, is_difficult,
        is_completed, completed_date, created_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      id,
      userId,
      category,
      sanitizedDescription,
      isDifficult ? 1 : 0,
      0, // is_completed starts as false
      null, // completed_date starts as null
      createdDate,
    ];

    db.run(query, params, function (err) {
      if (err) {
        if (err.message.includes("UNIQUE constraint failed")) {
          res
            .status(409)
            .json({
              error: `User already has a goal in the ${category} category`,
            });
        } else if (err.message.includes("FOREIGN KEY constraint failed")) {
          res.status(400).json({ error: `Invalid user ID: ${userId}` });
        } else {
          console.error("Error creating goal:", err.message);
          res.status(500).json({ error: err.message });
        }
        return;
      }

      debug(
        `Created goal: ${sanitizedDescription} for user ${userId}`,
      );

      // Return the created goal
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
    });
  });
});

// PUT update goal
app.put("/api/goals/:id", (req, res) => {
  const { description, isDifficult, isCompleted } = req.body;

  // Validate description
  const descriptionError = validateString(description, "Description", 3, 500);
  if (descriptionError) {
    res.status(400).json({ error: descriptionError });
    return;
  }

  const sanitizedDescription = sanitizeString(description);
  const completedDate = isCompleted
    ? new Date().toISOString().split("T")[0]
    : null;

  const query = `
    UPDATE goals SET 
      description = ?, 
      is_difficult = ?,
      is_completed = ?,
      completed_date = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;

  const params = [
    sanitizedDescription,
    isDifficult ? 1 : 0,
    isCompleted ? 1 : 0,
    completedDate,
    req.params.id,
  ];

  db.run(query, params, function (err) {
    if (err) {
      console.error("Error updating goal:", err.message);
      res.status(500).json({ error: err.message });
      return;
    }

    if (this.changes === 0) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }

    debug(`Updated goal: ${req.params.id}`);

    // Fetch and return the updated goal
    const selectQuery = `SELECT * FROM goals WHERE id = ?`;
    db.get(selectQuery, [req.params.id], (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
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
    });
  });
});

// DELETE goal
app.delete("/api/goals/:id", (req, res) => {
  const query = "DELETE FROM goals WHERE id = ?";

  db.run(query, [req.params.id], function (err) {
    if (err) {
      console.error("Error deleting goal:", err.message);
      res.status(500).json({ error: err.message });
      return;
    }

    if (this.changes === 0) {
      res.status(404).json({ error: "Goal not found" });
      return;
    }

    debug(`Deleted goal ID: ${req.params.id}`);
    res.json({ message: "Goal deleted successfully" });
  });
});

// GET goal statistics for a user
app.get("/api/goals/stats/:userId", (req, res) => {
  const query = `
    SELECT 
      COUNT(*) as total_goals,
      SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as completed_goals,
      SUM(CASE WHEN is_difficult = 1 THEN 1 ELSE 0 END) as difficult_goals,
      COUNT(DISTINCT category) as categories_covered
    FROM goals 
    WHERE user_id = ?
  `;

  db.get(query, [req.params.userId], (err, row) => {
    if (err) {
      console.error("Error fetching goal stats:", err.message);
      res.status(500).json({ error: err.message });
      return;
    }

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
  });
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

// GET all weekly plans
app.get("/api/weekly-plans", (req, res) => {
  const query = `SELECT * FROM weekly_plans ORDER BY week DESC, user_id`;
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("Error fetching weekly plans:", err.message);
      res.status(500).json({ error: err.message });
      return;
    }
    const plans = rows.map(serializeWeeklyPlan);
    debug(`Fetched ${plans.length} weekly plans`);
    res.json(plans);
  });
});

// GET a weekly plan for (userId, week)
app.get("/api/weekly-plans/:userId/:week", (req, res) => {
  const userId = req.params.userId;
  const week = Number(req.params.week);
  if (!Number.isInteger(week) || week < 1) {
    res.status(400).json({ error: "week must be a positive integer" });
    return;
  }
  db.get(
    `SELECT * FROM weekly_plans WHERE user_id = ? AND week = ?`,
    [userId, week],
    (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (!row) {
        res.status(404).json({ error: "Weekly plan not found" });
        return;
      }
      res.json(serializeWeeklyPlan(row));
    }
  );
});

// POST upsert a weekly plan
app.post("/api/weekly-plans", (req, res) => {
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

  db.get(
    `SELECT id, current_consistency_level, is_active FROM users WHERE id = ?`,
    [userId],
    (err, user) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
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

      const upsert = () => {
        db.get(
          `SELECT id, committed_at FROM weekly_plans WHERE user_id = ? AND week = ?`,
          [userId, weekNum],
          (errExisting, existing) => {
            if (errExisting) {
              res.status(500).json({ error: errExisting.message });
              return;
            }
            const id = existing?.id || uuidv4();
            const committedAt =
              existing?.committed_at || new Date().toISOString();

            const upsertQuery = `
              INSERT OR REPLACE INTO weekly_plans (
                id, user_id, week, committed_days, committed_at, created_by, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;
            const params = [
              id,
              userId,
              weekNum,
              JSON.stringify(uniqueDays),
              committedAt,
              validCreatedBy,
            ];
            db.run(upsertQuery, params, function (errRun) {
              if (errRun) {
                console.error(
                  "Error upserting weekly plan:",
                  errRun.message
                );
                res.status(500).json({ error: errRun.message });
                return;
              }
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
            });
          }
        );
      };

      // Lock check: only applies to the current week. Future weeks are
      // always editable; past weeks were rejected above.
      // Admin override (createdBy:"admin" + override:true) bypasses lock.
      if (!isAdminOverride && weekNum === currentWeek) {
        if (currentISTDayOfWeek() > 1) {
          res.status(403).json({
            error:
              "Commitment window closed — it is past Monday IST for this week",
            lockReason: "monday-ended",
          });
          return;
        }
        db.get(
          `SELECT 1 FROM workout_days WHERE user_id = ? AND week = ? AND is_completed = 1 LIMIT 1`,
          [userId, weekNum],
          (errWorkout, row) => {
            if (errWorkout) {
              res.status(500).json({ error: errWorkout.message });
              return;
            }
            if (row) {
              res.status(403).json({
                error:
                  "Commitment window closed — a workout has already been logged for this week",
                lockReason: "workout-logged",
              });
              return;
            }
            upsert();
          }
        );
      } else {
        upsert();
      }
    }
  );
});

// DELETE a weekly plan (admin cleanup / testing)
app.delete("/api/weekly-plans/:userId/:week", (req, res) => {
  const userId = req.params.userId;
  const week = Number(req.params.week);
  if (!Number.isInteger(week) || week < 1) {
    res.status(400).json({ error: "week must be a positive integer" });
    return;
  }
  db.run(
    `DELETE FROM weekly_plans WHERE user_id = ? AND week = ?`,
    [userId, week],
    function (err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: "Weekly plan not found" });
        return;
      }
      debug(`Deleted weekly plan for user ${userId}, week ${week}`);
      res.json({ message: "Weekly plan deleted" });
    }
  );
});

// ==================== HEALTH CHECK ====================

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "FitBois 2.0 API is running",
    database: "SQLite",
    environment: isProduction ? "production" : "development",
    timestamp: new Date().toISOString(),
  });
});

// ==================== CATCH-ALL FOR REACT SPA ====================

// In production, serve React app for any non-API routes
if (isProduction) {
  app.get("*", (req, res) => {
    const buildPath = path.join(__dirname, "..", "build", "index.html");
    if (fs.existsSync(buildPath)) {
      res.sendFile(buildPath);
    } else {
      res.status(404).json({ error: "Frontend build not found" });
    }
  });
}

// ==================== START SERVER ====================

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 FitBois 2.0 API Server running on port ${PORT}`);
  console.log(`📁 Database: ${dbPath}`);
  console.log(`🌍 Environment: ${isProduction ? "production" : "development"}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down server...");
  db.close((err) => {
    if (err) {
      console.error("Error closing database:", err.message);
    } else {
      console.log("✅ Database connection closed");
    }
    process.exit(0);
  });
});
