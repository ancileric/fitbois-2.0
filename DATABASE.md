# FitBois 2.0 Database Documentation

## 🗄️ **Database Setup**

The FitBois 2.0 app now uses a **SQLite database** stored locally in your project folder instead of browser localStorage.

### **Database Location:**
```
backend/database/fitbois.db
```

## 🚀 **Getting Started**

### **1. Install Backend Dependencies**
```bash
cd backend
npm install
```

### **2. Initialize Database**
```bash
cd backend
npm run init-db
```

### **3. Start Backend Server**
```bash
cd backend
npm start
```
Server runs on: http://localhost:5000

### **4. Start Frontend (separate terminal)**
```bash
npm start
```
Frontend runs on: http://localhost:3000

## 📊 **Database Schema**

### **Users Table**
```sql
CREATE TABLE users (
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
);
```

### **Workout Days Table**
```sql
CREATE TABLE workout_days (
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
```

### **Goals Table**
```sql
CREATE TABLE goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  target_value TEXT,
  current_value TEXT,
  is_difficult BOOLEAN NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT 0,
  completed_date TEXT,
  created_date TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
```

### **Proofs Table**
```sql
CREATE TABLE proofs (
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
```

### **Weekly Updates Table**
```sql
CREATE TABLE weekly_updates (
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
```

### **Admin Settings Table**
```sql
CREATE TABLE admin_settings (
  id INTEGER PRIMARY KEY,
  challenge_start_date TEXT NOT NULL,
  challenge_end_date TEXT NOT NULL,
  current_week INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT 1,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🔌 **API Endpoints**

### **Users**
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### **Workouts**
- `GET /api/workouts/:userId/:week` - Get workouts for user/week
- `POST /api/workouts` - Save workout data

### **System**
- `GET /api/health` - Health check

## 💾 **Data Persistence**

### **What's Stored:**
- ✅ **User profiles** (name, consistency level, clean weeks, etc.)
- ✅ **Workout tracking** (daily checkmarks for each week)
- 🚧 **Goals** (coming soon)
- 🚧 **Proofs** (coming soon)
- 🚧 **Weekly updates** (coming soon)

### **Benefits:**
- **Permanent storage** - Data survives browser restarts, computer restarts
- **File-based** - Database file is in your project folder
- **No browser dependency** - Works across different browsers
- **Backup friendly** - Easy to backup the .db file
- **Multi-user ready** - Can be extended for team use

## 🛠️ **Database Management**

### **View Database Contents**
You can use any SQLite browser tool like:
- [DB Browser for SQLite](https://sqlitebrowser.org/) (free)
- [SQLite Studio](https://sqlitestudio.pl/) (free)
- VS Code SQLite extensions

### **Manual Database Operations**
```bash
# Connect to database
sqlite3 backend/database/fitbois.db

# View all users
.headers on
SELECT * FROM users;

# Exit
.quit
```

### **Reset Database**
```bash
# Delete database file
rm backend/database/fitbois.db

# Reinitialize
cd backend
npm run init-db
```

## 🔍 **Troubleshooting**

### **Backend not connecting?**
1. Check if backend server is running: `http://localhost:5000/api/health`
2. Check console for database connection errors
3. Ensure database file exists: `backend/database/fitbois.db`

### **Data not saving?**
1. Check browser console for API errors
2. Check backend terminal for error messages
3. Verify backend server is running on port 5000

### **Database corrupted?**
```bash
# Backup current data (if possible)
cp backend/database/fitbois.db backend/database/fitbois.db.backup

# Reset database
rm backend/database/fitbois.db
cd backend && npm run init-db
```

## 🎯 **Next Steps**

The database foundation is complete! Upcoming features:
- Goals management API endpoints
- Proof upload system
- Weekly updates tracking
- Data export/import tools
- Database backup automation

Your FitBois 2.0 data is now permanently stored and will persist across all sessions! 💪