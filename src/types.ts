export interface User {
  id: string;
  name: string;
  avatar?: string;
  startDate: string;
  /** What a missed week costs this player: 1 = ₹500, 2 = ₹1,000, 3 = ₹2,000. */
  priceLevel: 1 | 2 | 3;
  cleanWeeks: number;
  missedWeeks: number;
  /** Nothing takes a player out of the season any more. */
  isActive: boolean;

  // --- FitBois 2.0 fields, still read by screens that haven't migrated ---
  /** @deprecated workload ladder; replaced by priceLevel */
  currentConsistencyLevel?: 3 | 4 | 5;
  /** @deprecated no points in FitBros 3.0 */
  totalPoints?: number;
  /** @deprecated everyone starts at the same price now */
  specialRules?: {
    startingLevel?: number;
    reactivatedAtWeek?: number;
  };
}

export interface Goal {
  id: string;
  userId: string;
  /** Free text now — players choose their own categories. */
  category: string;
  description: string;
  /** Where you started, recorded at Week 0. */
  baseline?: string;
  /** What counts as completing it. */
  target?: string;
  /** Where you started and what counts as done, as numbers. */
  baselineValue?: number;
  targetValue?: number;
  unit?: string;
  isCompleted: boolean;
  completedDate?: string;
  proofs: Proof[];
  createdDate: string;

  /** @deprecated goals carry no weight in FitBros 3.0. */
  isDifficult?: boolean;
}

/** @deprecated FitBros 3.0 lets players name their own categories. */
export type GoalCategory = string;

export interface Proof {
  id: string;
  goalId: string;
  userId: string;
  type: 'photo' | 'video' | 'screenshot';
  url: string;
  description?: string;
  timestamp: string;
  week: number;
}

export interface WeeklyUpdate {
  id: string;
  userId: string;
  week: number;
  year: number;
  proofs: Proof[];
  updateCount: number;
  requiredUpdates: number;
  isComplete: boolean;
  submittedDate: string;
}

/** A session is a workout; 10k steps is half of one. */
export type WorkoutKind = 'session' | 'steps';

export interface WorkoutDay {
  id: string;
  userId: string;
  week: number;
  dayOfWeek: number; // 1-7 (Monday-Sunday)
  date: string;
  isCompleted: boolean;
  /** What was logged. Absent on rows from before steps counted: read as a session. */
  kind?: WorkoutKind;
  workoutType?: string;
  notes?: string;
  markedBy: 'user' | 'admin';
  timestamp: string;
}

export interface AdminSettings {
  challengeStartDate: string;
  challengeEndDate: string;
  currentWeek: number;
  isActive: boolean;
}

/** A clean week is 5 workouts, the same for everyone (see seasonEngine). */
export const WORKOUTS_PER_WEEK = 5;

/** @deprecated the workload ladder is gone; a clean week is always WORKOUTS_PER_WEEK. */
export const getRequiredWorkouts = (_level?: number): number => WORKOUTS_PER_WEEK;

/** @deprecated players name their own categories now. */
export const GOAL_CATEGORIES = [] as const;