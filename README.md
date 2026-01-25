# FitBois 2.0 - Challenge Tracker 💪

A comprehensive fitness challenge tracking application built for the FitBois 2.0 6-month fitness challenge (January - June 2025).

## Challenge Overview

**Focus:** Consistency and personal progress - not who's already the fittest, but who actually shows up and improves.

**Timeline:** January 19 - July 31, 2026 (~6 months)

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
- Challenge timeline
- Weekly proof tracking
- Alerts and reminders

### 🎯 Goals Management
- Create and track 5 goals across categories
- Mark difficult goals
- Upload proofs for each goal
- Complete goals and earn points

### 📅 Consistency Tracking
- Weekly update system
- Visual progress through levels (5→4→3 days/week)
- Clean weeks counter
- Proof upload with descriptions

### 🏆 Leaderboard
- Real-time rankings
- Multiple sorting options (points, consistency, categories)
- Detailed user statistics
- Category completion tracking

### 👤 User Profile
- Personal information management
- Challenge statistics
- Special rules (e.g., Subhash's winner bonus)
- Rules reference

## Technology Stack

- **Frontend:** React 18 with TypeScript
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Build Tool:** Create React App

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm start
   ```

3. **Open your browser:**
   Navigate to `http://localhost:3000`

## Project Structure

```
src/
├── components/           # React components
│   ├── Dashboard.tsx    # Main dashboard view
│   ├── Goals.tsx        # Goals management
│   ├── Consistency.tsx  # Weekly tracking
│   ├── Leaderboard.tsx  # Rankings & stats
│   ├── UserProfile.tsx  # User profile
│   └── Header.tsx       # Navigation header
├── utils/
│   └── mockData.ts      # Sample data generation
├── types.ts             # TypeScript interfaces
├── App.tsx             # Main app component
└── index.tsx           # App entry point
```

## Key Features Implemented

### ✅ Consistency Tracking
- 5→4→3 days/week progression system
- Clean weeks tracking
- Weekly proof requirements
- Visual timeline with status indicators

### ✅ Goal Management
- 5-category system with icons
- Difficult goal requirement
- Proof upload system
- Goal completion tracking

### ✅ Scoring System
- Point calculation (1 point per goal)
- Category completion tracking
- Leaderboard with multiple sort options
- Tiebreaker logic implementation

### ✅ User Interface
- Modern, responsive design
- Mobile-friendly navigation
- Real-time progress indicators
- Intuitive modals and forms

## Challenge Timeline

- **Start:** January 19, 2026 (Sunday)
- **End:** July 31, 2026
- **Duration:** ~6 months
- **Buy-in:** ₹5,000 per person

## Special Features

### Winner Bonus System
- Subhash starts at 4 days/week (FitBois 1.0 winner reward)
- Special badges and indicators

### Proof System
- Support for photos, videos, and screenshots
- Weekly minimum requirements
- Time-stamped submissions

### Smart Alerts
- Missing difficult goal warnings
- Weekly proof reminders
- Consistency level notifications

## Development Notes

This app uses mock data for demonstration. In a production environment, you would need:

- Backend API for data persistence
- User authentication system
- File upload service for proofs
- Real-time notifications
- Mobile app version

## Contributing

Built with ❤️ for the FitBois 2.0 challenge. Remember: **This only works if we're honest with ourselves.**

---

*"Consistency and personal progress are the keys to success!"* 💪