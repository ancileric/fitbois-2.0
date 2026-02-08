const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Create database directory if it doesn't exist
const dbDir = path.join(__dirname, '../database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log('📁 Created database directory');
}

const dbPath = path.join(dbDir, 'fitbois.db');
const isNewDatabase = !fs.existsSync(dbPath);

console.log(`🔍 Database check: ${isNewDatabase ? 'NEW DATABASE - will initialize' : 'EXISTING DATABASE - will preserve data'}`);

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database at:', dbPath);
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Create tables (IF NOT EXISTS means it won't overwrite)
const createTables = () => {
  // Users table
  db.run(`
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating users table:', err.message);
    } else {
      console.log('✅ Users table ready');
    }
  });

  // Goals table
  db.run(`
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
    )
  `, (err) => {
    if (err) {
      console.error('Error creating goals table:', err.message);
    } else {
      console.log('✅ Goals table ready');
    }
  });

  // Workout days table
  db.run(`
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
  `, (err) => {
    if (err) {
      console.error('Error creating workout_days table:', err.message);
    } else {
      console.log('✅ Workout days table ready');
    }
  });

  // Proofs table
  db.run(`
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
  `, (err) => {
    if (err) {
      console.error('Error creating proofs table:', err.message);
    } else {
      console.log('✅ Proofs table ready');
    }
  });

  // Weekly updates table
  db.run(`
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
  `, (err) => {
    if (err) {
      console.error('Error creating weekly_updates table:', err.message);
    } else {
      console.log('✅ Weekly updates table ready');
    }
  });

  // Admin settings table
  db.run(`
    CREATE TABLE IF NOT EXISTS admin_settings (
      id INTEGER PRIMARY KEY,
      challenge_start_date TEXT NOT NULL,
      challenge_end_date TEXT NOT NULL,
      current_week INTEGER NOT NULL DEFAULT 1,
      is_active BOOLEAN NOT NULL DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating admin_settings table:', err.message);
    } else {
      console.log('✅ Admin settings table ready');

      // Insert default admin settings ONLY if this is a new database
      if (isNewDatabase) {
        db.run(`
          INSERT OR IGNORE INTO admin_settings (id, challenge_start_date, challenge_end_date, current_week, is_active)
          VALUES (1, '2026-01-19', '2026-07-31', 1, 1)
        `, (err) => {
          if (err) {
            console.error('Error inserting default admin settings:', err.message);
          } else {
            console.log('✅ Default admin settings inserted');
          }
        });
      }
    }
  });

  // Create indexes for frequently queried columns
  const indexes = [
    { name: 'idx_workout_user', table: 'workout_days', column: 'user_id' },
    { name: 'idx_workout_week', table: 'workout_days', column: 'week' },
    { name: 'idx_workout_user_week', table: 'workout_days', columns: 'user_id, week' },
    { name: 'idx_goals_user', table: 'goals', column: 'user_id' },
    { name: 'idx_goals_category', table: 'goals', column: 'category' },
    { name: 'idx_proofs_user', table: 'proofs', column: 'user_id' },
    { name: 'idx_proofs_goal', table: 'proofs', column: 'goal_id' },
    { name: 'idx_weekly_updates_user', table: 'weekly_updates', column: 'user_id' },
  ];

  indexes.forEach(idx => {
    const columns = idx.columns || idx.column;
    db.run(`CREATE INDEX IF NOT EXISTS ${idx.name} ON ${idx.table} (${columns})`, (err) => {
      if (err) {
        console.error(`Error creating index ${idx.name}:`, err.message);
      }
    });
  });
};

// Insert sample data ONLY for new databases
const insertSampleDataIfNew = () => {
  if (!isNewDatabase) {
    console.log('⏭️  Skipping sample data - existing database detected');
    return;
  }

  console.log('📝 Inserting sample data for new database...');

  const sampleUsers = [
    {
      id: 'user-1',
      name: 'You',
      avatar: '👤',
      start_date: '2026-01-19',
      current_consistency_level: 5,
      clean_weeks: 0,
      missed_weeks: 0,
      total_points: 0,
      is_active: 1,
      special_starting_level: null
    },
    {
      id: 'user-2',
      name: 'Subhash',
      avatar: '🏆',
      start_date: '2026-01-19',
      current_consistency_level: 4,
      clean_weeks: 0,
      missed_weeks: 0,
      total_points: 0,
      is_active: 1,
      special_starting_level: 4
    },
    {
      id: 'user-3',
      name: 'Friend 1',
      avatar: '💪',
      start_date: '2026-01-19',
      current_consistency_level: 5,
      clean_weeks: 0,
      missed_weeks: 0,
      total_points: 0,
      is_active: 1,
      special_starting_level: null
    },
    {
      id: 'user-4',
      name: 'Friend 2',
      avatar: '🏃‍♂️',
      start_date: '2026-01-19',
      current_consistency_level: 5,
      clean_weeks: 0,
      missed_weeks: 0,
      total_points: 0,
      is_active: 1,
      special_starting_level: null
    }
  ];

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (
      id, name, avatar, start_date, current_consistency_level, 
      clean_weeks, missed_weeks, total_points, is_active, special_starting_level
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  sampleUsers.forEach(user => {
    insertUser.run(
      user.id, user.name, user.avatar, user.start_date, 
      user.current_consistency_level, user.clean_weeks, 
      user.missed_weeks, user.total_points, user.is_active,
      user.special_starting_level
    );
  });

  insertUser.finalize();
  console.log('✅ Sample users inserted');

  // Insert sample goals
  const sampleGoals = [
    {
      id: 'goal-1',
      user_id: 'user-1',
      category: 'cardio',
      description: 'Run 5K in under 30 minutes (current best: 32:15)',
      is_difficult: 1,
      is_completed: 0,
      completed_date: null,
      created_date: '2026-01-19'
    },
    {
      id: 'goal-2',
      user_id: 'user-1',
      category: 'strength',
      description: 'Complete 50 consecutive push-ups without stopping',
      is_difficult: 0,
      is_completed: 0,
      completed_date: null,
      created_date: '2026-01-19'
    },
    {
      id: 'goal-3',
      user_id: 'user-2',
      category: 'cardio',
      description: 'Complete a 10K run without walking breaks',
      is_difficult: 1,
      is_completed: 0,
      completed_date: null,
      created_date: '2026-01-19'
    }
  ];

  const insertGoal = db.prepare(`
    INSERT OR IGNORE INTO goals (
      id, user_id, category, description, is_difficult, 
      is_completed, completed_date, created_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  sampleGoals.forEach(goal => {
    insertGoal.run(
      goal.id, goal.user_id, goal.category, goal.description,
      goal.is_difficult, goal.is_completed, goal.completed_date, goal.created_date
    );
  });

  insertGoal.finalize();
  console.log('✅ Sample goals inserted');
};

// Initialize database
console.log('🚀 Initializing FitBois 2.0 Database...');
createTables();

// Wait a bit for tables to be created, then insert sample data if needed
setTimeout(() => {
  insertSampleDataIfNew();
  
  // Get database stats
  db.get('SELECT COUNT(*) as count FROM users', [], (err, row) => {
    if (!err && row) {
      console.log(`📊 Current users in database: ${row.count}`);
    }
    
    // Close database connection
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
        process.exit(1);
      } else {
        console.log('✅ Database initialization complete!');
        console.log(`📁 Database location: ${dbPath}`);
        process.exit(0);
      }
    });
  });
}, 1000);
