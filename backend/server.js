const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

// CORS configuration
const corsOptions = {
  origin: isProduction
    ? process.env.FRONTEND_URL || true  // Allow configured frontend URL or any in production
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Middleware
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from React build in production
if (isProduction) {
  const buildPath = path.join(__dirname, '..', 'build');
  if (fs.existsSync(buildPath)) {
    app.use(express.static(buildPath));
    console.log('✅ Serving static files from:', buildPath);
  }
}

// Database connection
const dbPath = path.join(__dirname, 'database', 'fitbois.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to SQLite database');
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Create indexes if they don't exist (for existing databases)
const createIndexes = () => {
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_workout_user ON workout_days (user_id)',
    'CREATE INDEX IF NOT EXISTS idx_workout_week ON workout_days (week)',
    'CREATE INDEX IF NOT EXISTS idx_workout_user_week ON workout_days (user_id, week)',
    'CREATE INDEX IF NOT EXISTS idx_goals_user ON goals (user_id)',
    'CREATE INDEX IF NOT EXISTS idx_goals_category ON goals (category)',
  ];

  indexes.forEach(sql => {
    db.run(sql, (err) => {
      if (err) console.error('Index creation error:', err.message);
    });
  });
  console.log('✅ Database indexes verified');
};
createIndexes();

// ==================== INPUT VALIDATION HELPERS ====================

const validateString = (value, fieldName, minLength = 1, maxLength = 255) => {
  if (typeof value !== 'string') {
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
  if (typeof value !== 'boolean' && value !== 0 && value !== 1) {
    return `${fieldName} must be a boolean`;
  }
  return null;
};

const validateConsistencyLevel = (value) => {
  const level = Number(value);
  if (![3, 4, 5].includes(level)) {
    return 'Consistency level must be 3, 4, or 5';
  }
  return null;
};

const validateGoalCategory = (value) => {
  const validCategories = ['cardio', 'strength', 'consistency', 'sports', 'personal-growth'];
  if (!validCategories.includes(value)) {
    return `Category must be one of: ${validCategories.join(', ')}`;
  }
  return null;
};

const sanitizeString = (value) => {
  if (typeof value !== 'string') return value;
  // Remove potentially dangerous characters while preserving useful ones
  return value.trim().replace(/[<>]/g, '');
};

// ==================== USER ROUTES ====================

// GET all users
app.get('/api/users', (req, res) => {
  const query = `
    SELECT 
      id, name, avatar, start_date, current_consistency_level,
      clean_weeks, missed_weeks, total_points, is_active,
      special_starting_level, created_at, updated_at
    FROM users 
    ORDER BY name COLLATE NOCASE ASC
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error fetching users:', err.message);
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Transform database format to frontend format
    const users = rows.map(row => ({
      id: row.id,
      name: row.name,
      avatar: row.avatar,
      startDate: row.start_date,
      currentConsistencyLevel: row.current_consistency_level,
      cleanWeeks: row.clean_weeks,
      missedWeeks: row.missed_weeks,
      totalPoints: row.total_points,
      isActive: Boolean(row.is_active),
      specialRules: row.special_starting_level ? {
        startingLevel: row.special_starting_level
      } : undefined
    }));
    
    console.log(`📊 Fetched ${users.length} users`);
    res.json(users);
  });
});

// GET single user by ID
app.get('/api/users/:id', (req, res) => {
  const query = `
    SELECT 
      id, name, avatar, start_date, current_consistency_level,
      clean_weeks, missed_weeks, total_points, is_active,
      special_starting_level, created_at, updated_at
    FROM users 
    WHERE id = ?
  `;
  
  db.get(query, [req.params.id], (err, row) => {
    if (err) {
      console.error('Error fetching user:', err.message);
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!row) {
      res.status(404).json({ error: 'User not found' });
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
      specialRules: row.special_starting_level ? {
        startingLevel: row.special_starting_level
      } : undefined
    };
    
    res.json(user);
  });
});

// POST create new user
app.post('/api/users', (req, res) => {
  const { name, avatar, currentConsistencyLevel, cleanWeeks, missedWeeks, isActive, specialRules } = req.body;

  // Validate required fields
  const nameError = validateString(name, 'Name', 1, 100);
  if (nameError) {
    res.status(400).json({ error: nameError });
    return;
  }

  // Validate optional fields
  if (avatar) {
    const avatarError = validateString(avatar, 'Avatar', 1, 10);
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
    const cleanWeeksError = validateNumber(cleanWeeks, 'Clean weeks', 0, 52);
    if (cleanWeeksError) {
      res.status(400).json({ error: cleanWeeksError });
      return;
    }
  }

  if (missedWeeks !== undefined) {
    const missedWeeksError = validateNumber(missedWeeks, 'Missed weeks', 0, 52);
    if (missedWeeksError) {
      res.status(400).json({ error: missedWeeksError });
      return;
    }
  }

  if (specialRules?.startingLevel !== undefined) {
    const startingLevelError = validateConsistencyLevel(specialRules.startingLevel);
    if (startingLevelError) {
      res.status(400).json({ error: `Special starting level: ${startingLevelError}` });
      return;
    }
  }

  const id = uuidv4();
  const startDate = '2026-01-19'; // Challenge start date
  const sanitizedName = sanitizeString(name);
  const sanitizedAvatar = avatar ? sanitizeString(avatar) : sanitizedName.charAt(0).toUpperCase();

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
    specialRules?.startingLevel || null
  ];

  db.run(query, params, function(err) {
    if (err) {
      console.error('Error creating user:', err.message);
      res.status(500).json({ error: err.message });
      return;
    }

    console.log(`✅ Created user: ${sanitizedName} (ID: ${id})`);

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
      specialRules: specialRules?.startingLevel ? {
        startingLevel: specialRules.startingLevel
      } : undefined
    };

    res.status(201).json(user);
  });
});

// PUT update user
app.put('/api/users/:id', (req, res) => {
  const { name, avatar, currentConsistencyLevel, cleanWeeks, missedWeeks, totalPoints, isActive, specialRules } = req.body;

  // Validate required fields
  const nameError = validateString(name, 'Name', 1, 100);
  if (nameError) {
    res.status(400).json({ error: nameError });
    return;
  }

  // Validate optional fields
  if (avatar) {
    const avatarError = validateString(avatar, 'Avatar', 1, 10);
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
    const cleanWeeksError = validateNumber(cleanWeeks, 'Clean weeks', 0, 52);
    if (cleanWeeksError) {
      res.status(400).json({ error: cleanWeeksError });
      return;
    }
  }

  if (missedWeeks !== undefined) {
    const missedWeeksError = validateNumber(missedWeeks, 'Missed weeks', 0, 52);
    if (missedWeeksError) {
      res.status(400).json({ error: missedWeeksError });
      return;
    }
  }

  if (totalPoints !== undefined) {
    const pointsError = validateNumber(totalPoints, 'Total points', 0, 10000);
    if (pointsError) {
      res.status(400).json({ error: pointsError });
      return;
    }
  }

  const sanitizedName = sanitizeString(name);
  const sanitizedAvatar = avatar ? sanitizeString(avatar) : sanitizedName.charAt(0).toUpperCase();

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
    req.params.id
  ];

  db.run(query, params, function(err) {
    if (err) {
      console.error('Error updating user:', err.message);
      res.status(500).json({ error: err.message });
      return;
    }

    if (this.changes === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    console.log(`✅ Updated user: ${sanitizedName} (ID: ${req.params.id})`);

    // Return the updated user
    const user = {
      id: req.params.id,
      name: sanitizedName,
      avatar: sanitizedAvatar,
      startDate: '2026-01-19',
      currentConsistencyLevel,
      cleanWeeks,
      missedWeeks,
      totalPoints,
      isActive,
      specialRules: specialRules?.startingLevel ? {
        startingLevel: specialRules.startingLevel
      } : undefined
    };

    res.json(user);
  });
});

// DELETE user
app.delete('/api/users/:id', (req, res) => {
  const query = 'DELETE FROM users WHERE id = ?';
  
  db.run(query, [req.params.id], function(err) {
    if (err) {
      console.error('Error deleting user:', err.message);
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    console.log(`🗑️ Deleted user ID: ${req.params.id}`);
    res.json({ message: 'User deleted successfully' });
  });
});

// ==================== WORKOUT ROUTES ====================

// GET all workouts (for admin overview)
app.get('/api/workouts', (req, res) => {
  const query = `
    SELECT wd.*, u.name as user_name 
    FROM workout_days wd
    JOIN users u ON wd.user_id = u.id
    ORDER BY wd.week DESC, wd.day_of_week ASC
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error fetching all workouts:', err.message);
      res.status(500).json({ error: err.message });
      return;
    }
    
    const workouts = rows.map(row => ({
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
      timestamp: row.timestamp
    }));
    
    console.log(`📊 Fetched ${workouts.length} workout records`);
    res.json(workouts);
  });
});

// GET workout days for a specific user
app.get('/api/workouts/user/:userId', (req, res) => {
  const query = `
    SELECT * FROM workout_days 
    WHERE user_id = ?
    ORDER BY week DESC, day_of_week ASC
  `;
  
  db.all(query, [req.params.userId], (err, rows) => {
    if (err) {
      console.error('Error fetching user workouts:', err.message);
      res.status(500).json({ error: err.message });
      return;
    }
    
    const workouts = rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      week: row.week,
      dayOfWeek: row.day_of_week,
      date: row.date,
      isCompleted: Boolean(row.is_completed),
      workoutType: row.workout_type,
      notes: row.notes,
      markedBy: row.marked_by,
      timestamp: row.timestamp
    }));
    
    console.log(`📊 Fetched ${workouts.length} workouts for user ${req.params.userId}`);
    res.json(workouts);
  });
});

// GET workout days for a user and week
app.get('/api/workouts/:userId/:week', (req, res) => {
  const query = `
    SELECT * FROM workout_days 
    WHERE user_id = ? AND week = ?
    ORDER BY day_of_week
  `;
  
  db.all(query, [req.params.userId, req.params.week], (err, rows) => {
    if (err) {
      console.error('Error fetching workouts:', err.message);
      res.status(500).json({ error: err.message });
      return;
    }
    
    const workouts = rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      week: row.week,
      dayOfWeek: row.day_of_week,
      date: row.date,
      isCompleted: Boolean(row.is_completed),
      workoutType: row.workout_type,
      notes: row.notes,
      markedBy: row.marked_by,
      timestamp: row.timestamp
    }));
    
    res.json(workouts);
  });
});

// POST/PUT workout day (upsert) - Uses INSERT OR REPLACE to avoid race conditions
app.post('/api/workouts', (req, res) => {
  const { userId, week, dayOfWeek, date, isCompleted, workoutType, notes, markedBy } = req.body;

  if (!userId || !week || !dayOfWeek || !date) {
    res.status(400).json({ error: 'Missing required fields: userId, week, dayOfWeek, date' });
    return;
  }

  // Validate markedBy field
  const validMarkedBy = ['user', 'admin'].includes(markedBy) ? markedBy : 'admin';

  const timestamp = new Date().toISOString();

  // First, check if a record exists to preserve the ID
  const checkQuery = `SELECT id FROM workout_days WHERE user_id = ? AND week = ? AND day_of_week = ?`;

  db.get(checkQuery, [userId, week, dayOfWeek], (err, existingRow) => {
    if (err) {
      console.error('Error checking existing workout:', err.message);
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
      id, userId, week, dayOfWeek, date, isCompleted ? 1 : 0,
      workoutType || null, notes || null, validMarkedBy, timestamp
    ];

    db.run(upsertQuery, params, function(err) {
      if (err) {
        console.error('Error upserting workout:', err.message);
        res.status(500).json({ error: err.message });
        return;
      }

      console.log(`✅ Upserted workout for user ${userId}, week ${week}, day ${dayOfWeek}`);

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
        timestamp
      };

      res.json(workout);
    });
  });
});

// DELETE workout day
app.delete('/api/workouts/:id', (req, res) => {
  const query = 'DELETE FROM workout_days WHERE id = ?';
  
  db.run(query, [req.params.id], function(err) {
    if (err) {
      console.error('Error deleting workout:', err.message);
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ error: 'Workout not found' });
      return;
    }
    
    console.log(`🗑️ Deleted workout ID: ${req.params.id}`);
    res.json({ message: 'Workout deleted successfully' });
  });
});

// GET workout statistics for a user
app.get('/api/workouts/stats/:userId', (req, res) => {
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
      console.error('Error fetching workout stats:', err.message);
      res.status(500).json({ error: err.message });
      return;
    }
    
    const stats = {
      totalWorkouts: row.total_workouts || 0,
      completedWorkouts: row.completed_workouts || 0,
      weeksWithData: row.weeks_with_data || 0,
      latestWeek: row.latest_week || 0,
      completionRate: row.total_workouts > 0 ? 
        Math.round((row.completed_workouts / row.total_workouts) * 100) : 0
    };
    
    res.json(stats);
  });
});

// ==================== GOALS ROUTES ====================

// GET all goals
app.get('/api/goals', (req, res) => {
  const query = `
    SELECT g.*, u.name as user_name 
    FROM goals g
    JOIN users u ON g.user_id = u.id
    ORDER BY g.created_date DESC
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error fetching all goals:', err.message);
      res.status(500).json({ error: err.message });
      return;
    }
    
    const goals = rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      category: row.category,
      description: row.description,
      isDifficult: Boolean(row.is_difficult),
      isCompleted: Boolean(row.is_completed),
      completedDate: row.completed_date,
      createdDate: row.created_date,
      proofs: [] // Will be populated when proofs table is implemented
    }));
    
    console.log(`📊 Fetched ${goals.length} goals`);
    res.json(goals);
  });
});

// GET goals for a specific user
app.get('/api/goals/user/:userId', (req, res) => {
  const query = `
    SELECT * FROM goals 
    WHERE user_id = ?
    ORDER BY created_date DESC
  `;
  
  db.all(query, [req.params.userId], (err, rows) => {
    if (err) {
      console.error('Error fetching user goals:', err.message);
      res.status(500).json({ error: err.message });
      return;
    }
    
    const goals = rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      category: row.category,
      description: row.description,
      isDifficult: Boolean(row.is_difficult),
      isCompleted: Boolean(row.is_completed),
      completedDate: row.completed_date,
      createdDate: row.created_date,
      proofs: [] // Will be populated when proofs table is implemented
    }));
    
    console.log(`📊 Fetched ${goals.length} goals for user ${req.params.userId}`);
    res.json(goals);
  });
});

// GET single goal by ID
app.get('/api/goals/:id', (req, res) => {
  const query = `SELECT * FROM goals WHERE id = ?`;
  
  db.get(query, [req.params.id], (err, row) => {
    if (err) {
      console.error('Error fetching goal:', err.message);
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!row) {
      res.status(404).json({ error: 'Goal not found' });
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
      proofs: [] // Will be populated when proofs table is implemented
    };
    
    res.json(goal);
  });
});

// POST create new goal
app.post('/api/goals', (req, res) => {
  const { userId, category, description, isDifficult } = req.body;

  console.log('📝 Goal creation request:', { userId, category, description, isDifficult });

  // Validate required fields
  if (!userId) {
    res.status(400).json({ error: 'User ID is required' });
    return;
  }

  const categoryError = validateGoalCategory(category);
  if (categoryError) {
    res.status(400).json({ error: categoryError });
    return;
  }

  const descriptionError = validateString(description, 'Description', 3, 500);
  if (descriptionError) {
    res.status(400).json({ error: descriptionError });
    return;
  }

  // First, check if the user exists
  const userCheckQuery = 'SELECT id FROM users WHERE id = ?';
  db.get(userCheckQuery, [userId], (err, userRow) => {
    if (err) {
      console.error('Error checking user existence:', err.message);
      res.status(500).json({ error: 'Database error checking user' });
      return;
    }

    if (!userRow) {
      console.error('User not found:', userId);
      res.status(404).json({ error: `User with ID ${userId} not found` });
      return;
    }

    const id = uuidv4();
    const createdDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
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
      createdDate
    ];

    db.run(query, params, function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          res.status(409).json({ error: `User already has a goal in the ${category} category` });
        } else if (err.message.includes('FOREIGN KEY constraint failed')) {
          res.status(400).json({ error: `Invalid user ID: ${userId}` });
        } else {
          console.error('Error creating goal:', err.message);
          res.status(500).json({ error: err.message });
        }
        return;
      }

      console.log(`✅ Created goal: ${sanitizedDescription} for user ${userId}`);

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
        proofs: []
      };

      res.status(201).json(goal);
    });
  });
});

// PUT update goal
app.put('/api/goals/:id', (req, res) => {
  const { description, isDifficult, isCompleted } = req.body;
  
  if (!description) {
    res.status(400).json({ error: 'Description is required' });
    return;
  }
  
  const completedDate = isCompleted ? new Date().toISOString().split('T')[0] : null;
  
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
    description,
    isDifficult ? 1 : 0,
    isCompleted ? 1 : 0,
    completedDate,
    req.params.id
  ];
  
  db.run(query, params, function(err) {
    if (err) {
      console.error('Error updating goal:', err.message);
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ error: 'Goal not found' });
      return;
    }
    
    console.log(`✅ Updated goal: ${req.params.id}`);
    
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
        proofs: []
      };
      
      res.json(goal);
    });
  });
});

// DELETE goal
app.delete('/api/goals/:id', (req, res) => {
  const query = 'DELETE FROM goals WHERE id = ?';
  
  db.run(query, [req.params.id], function(err) {
    if (err) {
      console.error('Error deleting goal:', err.message);
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ error: 'Goal not found' });
      return;
    }
    
    console.log(`🗑️ Deleted goal ID: ${req.params.id}`);
    res.json({ message: 'Goal deleted successfully' });
  });
});

// GET goal statistics for a user
app.get('/api/goals/stats/:userId', (req, res) => {
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
      console.error('Error fetching goal stats:', err.message);
      res.status(500).json({ error: err.message });
      return;
    }
    
    const stats = {
      totalGoals: row.total_goals || 0,
      completedGoals: row.completed_goals || 0,
      difficultGoals: row.difficult_goals || 0,
      categoriesCovered: row.categories_covered || 0,
      completionRate: row.total_goals > 0 ? 
        Math.round((row.completed_goals / row.total_goals) * 100) : 0
    };
    
    res.json(stats);
  });
});

// ==================== HEALTH CHECK ====================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'FitBois 2.0 API is running',
    database: 'SQLite',
    environment: isProduction ? 'production' : 'development',
    timestamp: new Date().toISOString()
  });
});

// ==================== CATCH-ALL FOR REACT SPA ====================

// In production, serve React app for any non-API routes
if (isProduction) {
  app.get('*', (req, res) => {
    const buildPath = path.join(__dirname, '..', 'build', 'index.html');
    if (fs.existsSync(buildPath)) {
      res.sendFile(buildPath);
    } else {
      res.status(404).json({ error: 'Frontend build not found' });
    }
  });
}

// ==================== START SERVER ====================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 FitBois 2.0 API Server running on port ${PORT}`);
  console.log(`📁 Database: ${dbPath}`);
  console.log(`🌍 Environment: ${isProduction ? 'production' : 'development'}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('✅ Database connection closed');
    }
    process.exit(0);
  });
});