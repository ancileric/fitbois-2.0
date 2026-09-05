const db = require("../db");

async function initDatabase() {
  console.log("🚀 Initializing FitBros 3.0 Database...");

  // Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      avatar TEXT,
      start_date TEXT NOT NULL,
      price_level INTEGER NOT NULL DEFAULT 1,
      clean_weeks INTEGER NOT NULL DEFAULT 0,
      missed_weeks INTEGER NOT NULL DEFAULT 0,
      standing TEXT NOT NULL DEFAULT 'active',
      cutoff_hour INTEGER NOT NULL DEFAULT 0,
      week_end_day INTEGER NOT NULL DEFAULT 7,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("✅ Users table ready");

  await db.exec(`
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 1,
      baseline TEXT,
      target TEXT,
      approved_at TEXT,
      is_completed BOOLEAN NOT NULL DEFAULT 0,
      completed_date TEXT,
      created_date TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);
  console.log("✅ Goals table ready");

  await db.exec(`
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
    )
  `);
  console.log("✅ Workout days table ready");

  await db.exec(`
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
    )
  `);
  console.log("✅ Proofs table ready");

  await db.exec(`
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
    )
  `);
  console.log("✅ Weekly updates table ready");

  await db.exec(`
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
    )
  `);
  console.log("✅ Weekly plans table ready");

  await db.exec(`
    CREATE TABLE IF NOT EXISTS fines (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      week INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      price_level INTEGER NOT NULL,
      issued_at TEXT NOT NULL,
      due_at TEXT NOT NULL,
      settled_at TEXT,
      waived_by_token_id TEXT,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      UNIQUE(user_id, week)
    )
  `);
  console.log("✅ Fines table ready");

  await db.exec(`
    CREATE TABLE IF NOT EXISTS skip_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      week INTEGER NOT NULL,
      requested_at TEXT NOT NULL,
      approved_at TEXT,
      approved_by TEXT,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      UNIQUE(user_id, week)
    )
  `);
  console.log("✅ Skip tokens table ready");

  await db.exec(`
    CREATE TABLE IF NOT EXISTS admin_settings (
      id INTEGER PRIMARY KEY,
      challenge_start_date TEXT NOT NULL,
      challenge_end_date TEXT NOT NULL,
      current_week INTEGER NOT NULL DEFAULT 1,
      is_active BOOLEAN NOT NULL DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("✅ Admin settings table ready");

  // Create indexes
  const indexes = [
    { name: "idx_workout_user", table: "workout_days", columns: "user_id" },
    { name: "idx_workout_week", table: "workout_days", columns: "week" },
    { name: "idx_workout_user_week", table: "workout_days", columns: "user_id, week" },
    { name: "idx_goals_user", table: "goals", columns: "user_id" },
    { name: "idx_goals_user_points", table: "goals", columns: "user_id, points" },
    { name: "idx_proofs_user", table: "proofs", columns: "user_id" },
    { name: "idx_proofs_goal", table: "proofs", columns: "goal_id" },
    { name: "idx_weekly_updates_user", table: "weekly_updates", columns: "user_id" },
    { name: "idx_weekly_plans_user", table: "weekly_plans", columns: "user_id" },
    { name: "idx_weekly_plans_week", table: "weekly_plans", columns: "week" },
    { name: "idx_fines_user", table: "fines", columns: "user_id" },
    { name: "idx_fines_unsettled", table: "fines", columns: "user_id, settled_at" },
    { name: "idx_skip_tokens_user", table: "skip_tokens", columns: "user_id" },
  ];

  for (const idx of indexes) {
    try {
      await db.exec(
        `CREATE INDEX IF NOT EXISTS ${idx.name} ON ${idx.table} (${idx.columns})`
      );
    } catch (err) {
      console.error(`Error creating index ${idx.name}:`, err.message);
    }
  }
  console.log("✅ Indexes ready");

  // Check user count
  const row = await db.get("SELECT COUNT(*) as count FROM users");
  console.log(`📊 Current users in database: ${row.count}`);

  console.log("✅ Database initialization complete!");
}

initDatabase()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Database initialization failed:", err);
    process.exit(1);
  });
