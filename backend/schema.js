/**
 * The FitBros 3.0 schema, in one place.
 *
 * Both the server (on boot) and scripts/safeInitDatabase.js run this, so the
 * shape of the database can't drift between them.
 */
const DDL = `
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
  );
  CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 1,
    baseline TEXT,
    target TEXT,
    baseline_value REAL,
    target_value REAL,
    unit TEXT,
    approved_at TEXT,
    is_completed BOOLEAN NOT NULL DEFAULT 0,
    completed_date TEXT,
    created_date TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS goal_progress (
    id TEXT PRIMARY KEY,
    goal_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    value REAL NOT NULL,
    note TEXT,
    recorded_at TEXT NOT NULL,
    FOREIGN KEY (goal_id) REFERENCES goals (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
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
  );
  CREATE TABLE IF NOT EXISTS skip_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    week INTEGER NOT NULL,
    requested_at TEXT NOT NULL,
    approved_at TEXT,
    approved_by TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE(user_id, week)
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
  CREATE TABLE IF NOT EXISTS weekly_plans (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    week INTEGER NOT NULL,
    committed_days TEXT NOT NULL,
    committed_at TEXT NOT NULL,
    created_by TEXT NOT NULL DEFAULT 'admin',
    swaps_used INTEGER NOT NULL DEFAULT 0,
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
  CREATE INDEX IF NOT EXISTS idx_workout_user_week ON workout_days (user_id, week);
  CREATE INDEX IF NOT EXISTS idx_goals_user ON goals (user_id);
  CREATE INDEX IF NOT EXISTS idx_goal_progress_goal ON goal_progress (goal_id, recorded_at);
  CREATE INDEX IF NOT EXISTS idx_fines_user ON fines (user_id);
  CREATE INDEX IF NOT EXISTS idx_fines_unsettled ON fines (user_id, settled_at);
  CREATE INDEX IF NOT EXISTS idx_skip_tokens_user ON skip_tokens (user_id);
  CREATE INDEX IF NOT EXISTS idx_weekly_plans_user ON weekly_plans (user_id);
`;

module.exports = { DDL };
