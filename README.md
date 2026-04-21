# FitBois 2.0 - Challenge Tracker 💪

A full-stack fitness challenge tracking application built for the FitBois 2.0 6-month fitness challenge.

## Challenge Overview

**Focus:** Consistency and personal progress - not who's already the fittest, but who actually shows up and improves.

**Timeline:** January 19 - July 31, 2026 (~6 months)  
**Buy-in:** ₹5,000 per person

### Key Rules

#### Consistency System
- Everyone starts with **5 update days/week**
- 3 clean weeks → move to **4 days/week**
- Another 3 clean weeks → **3 days/week**
- Miss a week → move back up one level
- Miss 2 weeks at 5 days/week → **eliminated**
- Steps allowed once per week, only at 5-day level

#### Goals & Categories
- **5 goals at a time**, one from each category:
  1. 🏃‍♂️ Cardio / Endurance
  2. 💪 Strength
  3. 📅 Consistency / Habit Building
  4. ⚽ Sports / Play
  5. 🎯 Personal Growth (new sport/skill)
- **At least one must be difficult** (a real stretch)
- Complete all 5 → lock in next set of 5

#### Scoring & Winning
- Every completed goal = **1 point**
- Every clean week = **1 point**
- Same goal can't be reused unless clearly progressed
- **Most points wins**
- Tiebreakers: more categories → better consistency → group vote

#### Proof Requirements
- **Minimum 3 proofs/week**
- Time-stamped photos, videos, or app screenshots only

## Features

### 📊 Dashboard
- Personal progress overview
- Real-time statistics and metrics
- Weekly workout tracking
- User consistency levels

### 🎯 Goals Management
- Create, edit, and delete goals across 5 categories
- Mark difficult goals (at least one required)
- Complete goals and earn points
- Category completion tracking with visual indicators
- Modal-based editing interface

### 💪 Workout Tracking
- Week-by-week workout logging
- Day-of-week completion tracking
- Consistency level monitoring (5→4→3 days/week)
- Visual calendar interface
- Admin controls for bulk updates

### 👥 Admin Panel
- User management (add, edit, delete participants)
- Workout data management
- Consistency recalculation tools
- Database maintenance features

## Technology Stack

### Frontend
- **Framework:** React 18 with TypeScript
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Build Tool:** Create React App

### Backend
- **Runtime:** Node.js with Express
- **Database:** SQLite3
- **API:** RESTful architecture
- **Validation:** Server-side input validation
- **Security:** XSS prevention, SQL injection protection

### Deployment
- **Platform:** Railway
- **Configuration:** nixpacks.toml, Procfile

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd "FitBois 2.0"
   ```

2. **Install frontend dependencies:**
   ```bash
   npm install
   ```

3. **Install backend dependencies:**
   ```bash
   cd backend
   npm install
   cd ..
   ```

### Running the Application

1. **Start the backend server** (in one terminal):
   ```bash
   cd backend
   node server.js
   ```
   Backend will run on `http://localhost:5000`

2. **Start the frontend** (in another terminal):
   ```bash
   npm start
   ```
   Frontend will run on `http://localhost:3000`

3. **Open your browser:**
   Navigate to `http://localhost:3000`

### Database Setup

The SQLite database will be automatically created on first run at:
```
backend/database/fitbois.db
```

On each backend boot, `backend/scripts/safeInitDatabase.js` runs with `CREATE TABLE IF NOT EXISTS` guards — your data is preserved across restarts.

## Project Structure

```
FitBois 2.0/
├── backend/                    # Backend server
│   ├── database/              # SQLite database
│   │   └── fitbois.db        # Main database file
│   ├── scripts/              # Database utilities
│   │   ├── safeInitDatabase.js # Idempotent DB init (runs on boot)
│   │   ├── backupDatabase.js   # Backup utility
│   │   └── restoreDatabase.js  # Restore utility
│   ├── server.js             # Express server & API
│   └── package.json          # Backend dependencies
├── src/                       # Frontend React app
│   ├── components/           # React components
│   │   ├── Dashboard.tsx    # Main dashboard
│   │   ├── Goals.tsx        # Goals management (CRUD)
│   │   ├── Workout.tsx      # Workout tracking
│   │   ├── Admin.tsx        # Admin panel
│   │   ├── Header.tsx       # Navigation
│   │   └── ...              # Other components
│   ├── services/
│   │   └── api.ts           # API client service
│   ├── utils/
│   │   ├── consistencyCalculator.ts
│   │   └── dateUtils.ts
│   ├── types.ts             # TypeScript interfaces
│   ├── App.tsx             # Main app component
│   └── index.tsx           # App entry point
├── public/                   # Static assets
├── package.json             # Frontend dependencies
└── README.md               # This file
```

## Key Features Implemented

### ✅ Full CRUD Operations
- **Create:** Add new users, goals, and workout entries
- **Read:** View all data with sorting and filtering
- **Update:** Edit goals (description, difficulty), modify workout records
- **Delete:** Remove goals, users, and workout entries with confirmation

### ✅ Workout Tracking System
- Week-by-week calendar view
- Individual day completion tracking
- Consistency level management (5→4→3 days/week)
- Automatic clean/missed week calculation
- Admin bulk update capabilities

### ✅ Goals Management
- Full edit capability for non-completed goals
- 5-category system with visual icons
- Difficult goal enforcement (at least 1 required)
- Category completion indicators
- Per-user goal tracking with accordion UI

### ✅ Automatic Consistency Calculator
- Real-time consistency level adjustments
- Clean weeks counter
- Missed weeks tracking
- Automatic level progression/regression
- Point calculation system

### ✅ Database & API
- RESTful API with Express
- SQLite database with proper indexing
- Input validation and sanitization
- Foreign key constraints
- Transaction support

### ✅ User Interface
- Modern, responsive design (mobile + desktop)
- Tailwind CSS styling
- Modal-based forms
- Confirmation dialogs for destructive actions
- Real-time UI updates

## API Endpoints

### Users
- `GET /api/users` - Get all users
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Goals
- `GET /api/goals` - Get all goals
- `GET /api/goals/:id` - Get goal by ID
- `GET /api/goals/user/:userId` - Get goals for a user
- `POST /api/goals` - Create new goal
- `PUT /api/goals/:id` - Update goal (edit description, difficulty)
- `DELETE /api/goals/:id` - Delete goal

### Workouts
- `GET /api/workouts` - Get all workouts
- `GET /api/workouts/user/:userId` - Get workouts for a user
- `GET /api/workouts/:userId/:week` - Get workouts for user and week
- `POST /api/workouts` - Create/update workout
- `DELETE /api/workouts/:id` - Delete workout

### Weekly Plans
- `GET /api/weekly-plans` - Get all weekly plans
- `GET /api/weekly-plans/:userId/:week` - Get a single plan
- `POST /api/weekly-plans` - Upsert a plan (admin+override:true bypasses lock)
- `DELETE /api/weekly-plans/:userId/:week` - Delete a plan

### Health
- `GET /api/health` - Check API status

## Deployment

This app is configured for Railway deployment:

1. **Push to GitHub**
2. **Connect Railway** to your repository
3. **Railway automatically:**
   - Detects the project using `nixpacks.toml`
   - Builds frontend and backend
   - Starts server using `Procfile`
   - Serves static React build from backend

## Special Features

### Winner Bonus System
- Previous winner (Subhash) starts at 4 days/week
- Configurable special rules per user

### Data Integrity
- Foreign key constraints
- Input validation and sanitization
- SQL injection prevention
- XSS protection

### Automatic Calculations
- Consistency levels update based on clean/missed weeks
- Points calculated automatically
- User status (active/eliminated) tracked

## Future Enhancements

Potential features for future versions:
- User authentication & authorization
- File upload for workout/goal proofs
- Push notifications for reminders
- Mobile app (React Native)
- Social features (comments, likes)
- Goal templates library
- Export data (PDF reports, CSV)

## Contributing

Built with ❤️ for the FitBois 2.0 challenge.  
Remember: **This only works if we're honest with ourselves.**

## License

Private project for FitBois 2.0 challenge participants.

---

*"Consistency and personal progress are the keys to success!"* 💪