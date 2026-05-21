# FitBois 2.0 - Challenge Tracker

A full-stack fitness challenge tracking app built for the FitBois 2.0 6-month fitness challenge.

**Live:** [fitbois-v2.vercel.app](https://fitbois-v2.vercel.app)

## Challenge Overview

**Focus:** Consistency and personal progress — not who's already the fittest, but who actually shows up and improves.

**Timeline:** January 19 – July 31, 2026 (~6 months)
**Buy-in:** ₹5,000 per person

### Rules

- **Consistency levels:** Everyone starts at 5 workouts/week. Hit 3 consecutive clean weeks to drop to 4/week, then 3/week. Miss a week and you regress back up. Miss 2 weeks at the 5-day level and you're eliminated.
- **Goals:** 5 goals at a time, one from each category (Cardio, Strength, Consistency, Sports, Personal Growth). At least one must be a real stretch goal.
- **Scoring:** **2 points** per completed goal + 1 point per clean week + **1 point** per committed week where every committed day is hit (**−1** if any committed day is missed). Most points wins.

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Tailwind CSS, Lucide icons |
| **Backend** | Express (Vercel Serverless Functions) |
| **Database** | Turso (libSQL — cloud SQLite) |
| **Hosting** | Vercel (free tier) |

## Project Structure

```
FitBois 2.0/
├── api/
│   └── index.js              # Vercel serverless entry point
├── backend/
│   ├── db.js                  # Turso/libSQL database client
│   ├── server.js              # Express API (users, goals, workouts, plans)
│   ├── scripts/
│   │   └── safeInitDatabase.js
│   └── package.json
├── src/                        # React frontend
│   ├── components/
│   │   ├── Dashboard.tsx
│   │   ├── Goals.tsx
│   │   ├── Workout.tsx
│   │   ├── Admin.tsx
│   │   └── ...
│   ├── services/api.ts
│   ├── utils/
│   │   ├── consistencyCalculator.ts
│   │   └── dateUtils.ts
│   ├── types.ts
│   └── App.tsx
├── vercel.json
└── package.json
```

## Getting Started

### Prerequisites

- Node.js >= 22
- A [Turso](https://turso.tech) account (free tier) — or skip for local dev with SQLite

### Install

```bash
npm install
cd backend && npm install
```

### Run locally

Start the backend (connects to local SQLite file by default):

```bash
cd backend && node server.js
```

Start the frontend:

```bash
npm start
```

To connect to Turso instead of local SQLite, create a `.env` file (see `.env.example`) with your `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.

### Deploy

The app is configured for Vercel. Push to `main` and Vercel auto-deploys.

**Required Vercel environment variables:**
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/users` | List all users |
| `GET` | `/api/users/:id` | Get user by ID |
| `POST` | `/api/users` | Create user |
| `PUT` | `/api/users/:id` | Update user |
| `DELETE` | `/api/users/:id` | Delete user |
| `GET` | `/api/goals` | List all goals |
| `GET` | `/api/goals/user/:userId` | Goals for a user |
| `POST` | `/api/goals` | Create goal |
| `PUT` | `/api/goals/:id` | Update goal |
| `DELETE` | `/api/goals/:id` | Delete goal |
| `GET` | `/api/workouts` | List all workouts |
| `GET` | `/api/workouts/user/:userId` | Workouts for a user |
| `POST` | `/api/workouts` | Create/update workout |
| `DELETE` | `/api/workouts/:id` | Delete workout |
| `GET` | `/api/weekly-plans` | List all plans |
| `POST` | `/api/weekly-plans` | Upsert plan |
| `GET` | `/api/health` | Health check |

## License

Private project for FitBois 2.0 challenge participants.
