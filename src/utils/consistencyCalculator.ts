import { User, WorkoutDay, WeeklyPlan, getRequiredWorkouts } from '../types';

export interface WeekStatus {
  week: number;
  isComplete: boolean;
  completedWorkouts: number;
  requiredWorkouts: number;
}

export interface ConsistencyUpdate {
  userId: string;
  cleanWeeks: number;
  missedWeeks: number;
  stintMissedWeeks: number;
  newConsistencyLevel: 3 | 4 | 5;
  levelChanged: boolean;
  totalPoints: number;
  bonusWeeks: number;
}

/**
 * Result of a single-pass simulation over all completed weeks.
 * Eliminates redundant multi-pass computations.
 */
export interface FullSimulationResult {
  weekStatuses: WeekStatus[];
  levelHistory: LevelPoint[];
  currentLevel: 3 | 4 | 5;
  cleanWeeks: number;
  missedWeeks: number;
  consecutiveCleanWeeks: number;
  stintMissedWeeks: number;
}

/**
 * Single-pass simulation that computes ALL derived metrics at once.
 * Replaces the previous pattern of calling calculateAllWeekStatuses,
 * simulateProgression, calculateStintMissedWeeks, and calculateLevelHistory
 * separately (each doing a full O(weeks) pass).
 */
export const simulateFullHistory = (
  user: User,
  workoutDays: WorkoutDay[],
  currentWeek: number
): FullSimulationResult => {
  const completedWeeks = currentWeek - 1;
  const startingLevel = user.specialRules?.startingLevel || 5;
  const reactivatedAtWeek = user.specialRules?.reactivatedAtWeek;

  if (completedWeeks <= 0) {
    const level = (startingLevel as 3 | 4 | 5);
    return {
      weekStatuses: [],
      levelHistory: currentWeek > 0 ? [{ week: currentWeek, level, isClean: false }] : [],
      currentLevel: level,
      cleanWeeks: 0,
      missedWeeks: 0,
      consecutiveCleanWeeks: 0,
      stintMissedWeeks: 0,
    };
  }

  let simulatedLevel = reactivatedAtWeek ? 5 : startingLevel;
  let consecutiveClean = 0;
  let cleanWeeks = 0;
  let missedWeeks = 0;
  let maxStreak = 0;
  let currentStreak = 0;
  let stintMissedWeeks = 0;

  const loopStart = reactivatedAtWeek ?? 1;
  // For stint tracking when reactivatedAtWeek is set, we skip earlier weeks
  // but still need to simulate level for weekStatuses/levelHistory from week 1
  let stintSimLevel = reactivatedAtWeek ? 5 : startingLevel;
  let stintConsecutiveClean = 0;

  const weekStatuses: WeekStatus[] = [];
  const levelHistory: LevelPoint[] = [];

  for (let week = 1; week <= completedWeeks; week++) {
    const required = getRequiredWorkouts(simulatedLevel);
    const completed = countCompletedWorkouts(user.id, workoutDays, week, simulatedLevel);
    const isClean = completed >= required;

    weekStatuses.push({ week, isComplete: isClean, completedWorkouts: completed, requiredWorkouts: required });
    levelHistory.push({ week, level: simulatedLevel, isClean });

    // Metrics
    if (isClean) {
      cleanWeeks++;
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      missedWeeks++;
      currentStreak = 0;
    }

    // Stint tracking (only from loopStart onwards)
    if (week >= loopStart) {
      if (isClean) {
        stintConsecutiveClean++;
        if (stintConsecutiveClean >= 3 && stintSimLevel > 3) {
          stintMissedWeeks = 0;
          stintSimLevel--;
          stintConsecutiveClean = 0;
        }
      } else {
        stintConsecutiveClean = 0;
        if (stintSimLevel < 5) {
          stintSimLevel = Math.min(stintSimLevel + 1, startingLevel);
          if (stintSimLevel === 5) {
            stintMissedWeeks = 0;
          }
        } else {
          stintMissedWeeks++;
        }
      }
    }

    // Level progression (always from week 1 for accurate level tracking)
    if (isClean) {
      consecutiveClean++;
      if (consecutiveClean >= 3 && simulatedLevel > 3) {
        simulatedLevel--;
        consecutiveClean = 0;
      }
    } else {
      consecutiveClean = 0;
      if (simulatedLevel < 5) {
        simulatedLevel = Math.min(simulatedLevel + 1, startingLevel);
      }
    }
  }

  // Add current in-progress week to level history
  if (currentWeek > 0) {
    levelHistory.push({ week: currentWeek, level: simulatedLevel, isClean: false });
  }

  return {
    weekStatuses,
    levelHistory,
    currentLevel: simulatedLevel as 3 | 4 | 5,
    cleanWeeks,
    missedWeeks,
    consecutiveCleanWeeks: maxStreak,
    stintMissedWeeks,
  };
};

/**
 * Count completed workouts for a user in a given week.
 * When simulatedLevel < 5, steps days are excluded from the count.
 */
const countCompletedWorkouts = (
  userId: string,
  workoutDays: WorkoutDay[],
  week: number,
  simulatedLevel: number = 5
): number => {
  return workoutDays.filter(w =>
    w.userId === userId &&
    w.week === week &&
    w.isCompleted &&
    (simulatedLevel >= 5 || w.workoutType !== 'steps')
  ).length;
};

/**
 * Calculate week completion status for a user.
 * Uses requiredWorkouts parameter so callers can pass the correct level for each week.
 */
export const calculateWeekStatus = (
  user: User,
  workoutDays: WorkoutDay[],
  week: number,
  requiredWorkoutsOverride?: number,
  simulatedLevel?: number
): WeekStatus => {
  const level = simulatedLevel ?? user.currentConsistencyLevel;
  const completedWorkouts = countCompletedWorkouts(user.id, workoutDays, week, level);
  const requiredWorkouts = requiredWorkoutsOverride ?? getRequiredWorkouts(user.currentConsistencyLevel);

  return {
    week,
    isComplete: completedWorkouts >= requiredWorkouts,
    completedWorkouts,
    requiredWorkouts
  };
};

/**
 * Calculate all week statuses for a user (only for completed weeks).
 * Uses simulation to determine the correct required workouts for each week.
 */
export const calculateAllWeekStatuses = (
  user: User,
  workoutDays: WorkoutDay[],
  currentWeek: number
): WeekStatus[] => {
  const completedWeeks = currentWeek - 1;
  if (completedWeeks <= 0) return [];

  const startingLevel = user.specialRules?.startingLevel || 5;
  let simulatedLevel = startingLevel as number;
  let consecutiveClean = 0;
  const weekStatuses: WeekStatus[] = [];

  for (let week = 1; week <= completedWeeks; week++) {
    const required = getRequiredWorkouts(simulatedLevel);
    const status = calculateWeekStatus(user, workoutDays, week, required, simulatedLevel);
    weekStatuses.push(status);

    if (status.isComplete) {
      consecutiveClean++;
      if (consecutiveClean >= 3 && simulatedLevel > 3) {
        simulatedLevel--;
        consecutiveClean = 0;
      }
    } else {
      consecutiveClean = 0;
      if (simulatedLevel < 5) {
        simulatedLevel = Math.min(simulatedLevel + 1, startingLevel);
      }
    }
  }

  return weekStatuses;
};

/**
 * Calculate clean weeks and missed weeks for a user (only for completed weeks).
 * Each week is evaluated against the level that was active during that week.
 */
export const calculateConsistencyMetrics = (
  user: User,
  workoutDays: WorkoutDay[],
  currentWeek: number
): { cleanWeeks: number; missedWeeks: number; consecutiveCleanWeeks: number } => {
  const weekStatuses = calculateAllWeekStatuses(user, workoutDays, currentWeek);

  let cleanWeeks = 0;
  let missedWeeks = 0;
  let consecutiveCleanWeeks = 0;
  let currentStreak = 0;

  weekStatuses.forEach((status) => {
    if (status.isComplete) {
      cleanWeeks++;
      currentStreak++;
      consecutiveCleanWeeks = Math.max(consecutiveCleanWeeks, currentStreak);
    } else {
      missedWeeks++;
      currentStreak = 0;
    }
  });

  return {
    cleanWeeks,
    missedWeeks,
    consecutiveCleanWeeks
  };
};

/**
 * Simulate week-by-week level progression to determine the correct consistency level.
 * Walks through each completed week chronologically, tracking level changes as they happen.
 */
export const calculateNewConsistencyLevel = (
  user: User,
  _consecutiveCleanWeeks: number,
  _weekStatuses: WeekStatus[],
  workoutDays?: WorkoutDay[],
  currentWeek?: number
): 3 | 4 | 5 => {
  // If workoutDays and currentWeek are provided, use simulation
  // Otherwise fall back to using the pre-computed weekStatuses for backward compat
  if (workoutDays && currentWeek !== undefined) {
    return simulateProgression(user, workoutDays, currentWeek);
  }

  // Fallback: use simulation via weekStatuses data
  return simulateProgressionFromStatuses(user, _weekStatuses);
};

/**
 * Core simulation: walk through weeks chronologically, tracking level changes
 */
const simulateProgression = (
  user: User,
  workoutDays: WorkoutDay[],
  currentWeek: number
): 3 | 4 | 5 => {
  const completedWeeks = currentWeek - 1;
  if (completedWeeks <= 0) return (user.specialRules?.startingLevel || 5) as 3 | 4 | 5;

  const startingLevel = user.specialRules?.startingLevel || 5;
  let simulatedLevel = startingLevel;
  let consecutiveClean = 0;

  for (let week = 1; week <= completedWeeks; week++) {
    const required = getRequiredWorkouts(simulatedLevel);
    const completed = countCompletedWorkouts(user.id, workoutDays, week, simulatedLevel);
    const isClean = completed >= required;

    if (isClean) {
      consecutiveClean++;
      if (consecutiveClean >= 3 && simulatedLevel > 3) {
        simulatedLevel--;
        consecutiveClean = 0;
      }
    } else {
      consecutiveClean = 0;
      if (simulatedLevel < 5) {
        simulatedLevel = Math.min(simulatedLevel + 1, startingLevel);
      }
    }
  }

  return simulatedLevel as 3 | 4 | 5;
};

/**
 * Calculate the number of missed weeks in the user's *current* level-5 stint.
 * The counter resets every time the user arrives at level 5 (whether by starting there,
 * progressing down from 4→5, or being demoted back from 4→5).
 */
export const calculateStintMissedWeeks = (
  user: User,
  workoutDays: WorkoutDay[],
  currentWeek: number
): number => {
  const completedWeeks = currentWeek - 1;
  if (completedWeeks <= 0) return 0;

  const startingLevel = user.specialRules?.startingLevel || 5;
  const reactivatedAtWeek = user.specialRules?.reactivatedAtWeek;
  const loopStart = reactivatedAtWeek ?? 1;

  // If reactivatedAtWeek is set, start fresh at level 5 from that week
  let simulatedLevel = reactivatedAtWeek ? 5 : startingLevel;
  let consecutiveClean = 0;
  let stintMissedWeeks = 0;

  for (let week = loopStart; week <= completedWeeks; week++) {
    const required = getRequiredWorkouts(simulatedLevel);
    const completed = countCompletedWorkouts(user.id, workoutDays, week, simulatedLevel);
    const isClean = completed >= required;

    if (isClean) {
      consecutiveClean++;
      if (consecutiveClean >= 3 && simulatedLevel > 3) {
        // Progressed to a lower (better) level — new stint begins if they return to 5 later
        stintMissedWeeks = 0;
        simulatedLevel--;
        consecutiveClean = 0;
      }
    } else {
      consecutiveClean = 0;
      if (simulatedLevel < 5) {
        // Demoted to a higher (harder) level
        simulatedLevel = Math.min(simulatedLevel + 1, startingLevel);
        if (simulatedLevel === 5) {
          // New level-5 stint begins — reset the counter
          stintMissedWeeks = 0;
        }
      } else {
        // Already at level 5 — count this miss against the current stint
        stintMissedWeeks++;
      }
    }
  }

  return stintMissedWeeks;
};

/**
 * Simulation using pre-computed week statuses (for callers that don't pass workoutDays).
 * Re-evaluates completion against simulated levels using the completedWorkouts from each status.
 */
const simulateProgressionFromStatuses = (
  user: User,
  weekStatuses: WeekStatus[]
): 3 | 4 | 5 => {
  if (weekStatuses.length === 0) return (user.specialRules?.startingLevel || 5) as 3 | 4 | 5;

  const startingLevel = user.specialRules?.startingLevel || 5;
  let simulatedLevel = startingLevel;
  let consecutiveClean = 0;

  for (const status of weekStatuses) {
    const required = getRequiredWorkouts(simulatedLevel);
    const isClean = status.completedWorkouts >= required;

    if (isClean) {
      consecutiveClean++;
      if (consecutiveClean >= 3 && simulatedLevel > 3) {
        simulatedLevel--;
        consecutiveClean = 0;
      }
    } else {
      consecutiveClean = 0;
      if (simulatedLevel < 5) {
        simulatedLevel = Math.min(simulatedLevel + 1, startingLevel);
      }
    }
  }

  return simulatedLevel as 3 | 4 | 5;
};

/**
 * Check if user should be eliminated.
 * Uses per-stint missed weeks: each time the user arrives at level 5 they get
 * 2 misses before elimination; the counter resets on every new stint.
 */
export const shouldBeEliminated = (
  user: User,
  stintMissedWeeks: number
): boolean => {
  return user.currentConsistencyLevel === 5 && stintMissedWeeks >= 2;
};

/**
 * Count "planning bonus" weeks — completed weeks in which the user had a plan and
 * satisfied every committed day. A committed day is satisfied by a completed
 * workout_days row for that day_of_week. For Levels 3 & 4, a "steps" workout does
 * NOT satisfy a commitment (mirrors the level-aware steps rule for clean weeks).
 */
export const calculateBonusWeeks = (
  user: User,
  workoutDays: WorkoutDay[],
  weeklyPlans: WeeklyPlan[],
  currentWeek: number
): number => {
  const levelHistory = calculateLevelHistory(user, workoutDays, currentWeek);
  return calculateBonusWeeksFromHistory(user, workoutDays, weeklyPlans, currentWeek, levelHistory);
};

/**
 * Internal: bonus weeks calculation using pre-computed level history (avoids recomputation).
 */
const calculateBonusWeeksFromHistory = (
  user: User,
  workoutDays: WorkoutDay[],
  weeklyPlans: WeeklyPlan[],
  currentWeek: number,
  levelHistory: LevelPoint[]
): number => {
  const completedWeeks = currentWeek - 1;
  if (completedWeeks <= 0) return 0;

  const userPlans = weeklyPlans.filter(p => p.userId === user.id);
  if (userPlans.length === 0) return 0;

  const levelByWeek = new Map<number, number>();
  levelHistory.forEach(pt => levelByWeek.set(pt.week, pt.level));

  let bonus = 0;
  for (const plan of userPlans) {
    if (plan.week < 1 || plan.week > completedWeeks) continue;
    if (!Array.isArray(plan.committedDays) || plan.committedDays.length === 0) continue;

    const levelAtWeek = levelByWeek.get(plan.week) ?? 5;
    const stepsCounts = levelAtWeek >= 5;

    const satisfiedAll = plan.committedDays.every(day =>
      workoutDays.some(w =>
        w.userId === user.id &&
        w.week === plan.week &&
        w.dayOfWeek === day &&
        w.isCompleted &&
        (stepsCounts || w.workoutType !== 'steps')
      )
    );

    if (satisfiedAll) bonus++;
  }

  return bonus;
};

/**
 * Calculate complete consistency update for a user.
 * Uses simulateFullHistory internally for a single-pass computation.
 */
export const calculateConsistencyUpdate = (
  user: User,
  workoutDays: WorkoutDay[],
  currentWeek: number,
  completedGoals: number,
  weeklyPlans: WeeklyPlan[] = []
): ConsistencyUpdate => {
  const sim = simulateFullHistory(user, workoutDays, currentWeek);
  const bonusWeeks = calculateBonusWeeksFromHistory(user, workoutDays, weeklyPlans, currentWeek, sim.levelHistory);

  const totalPoints = completedGoals + sim.cleanWeeks + bonusWeeks;

  return {
    userId: user.id,
    cleanWeeks: sim.cleanWeeks,
    missedWeeks: sim.missedWeeks,
    stintMissedWeeks: sim.stintMissedWeeks,
    newConsistencyLevel: sim.currentLevel,
    levelChanged: sim.currentLevel !== user.currentConsistencyLevel,
    totalPoints,
    bonusWeeks
  };
};

export interface LevelPoint {
  week: number;
  level: number;    // 3, 4, or 5
  isClean: boolean; // false for current in-progress week
}

/**
 * Build a per-week level history for a user.
 * Returns one LevelPoint per week from 1 through currentWeek (inclusive).
 * The last point (currentWeek) always has isClean=false (still in progress).
 */
export const calculateLevelHistory = (
  user: User,
  workoutDays: WorkoutDay[],
  currentWeek: number
): LevelPoint[] => {
  const completedWeeks = currentWeek - 1;
  const startingLevel = user.specialRules?.startingLevel || 5;
  let simulatedLevel = startingLevel as number;
  let consecutiveClean = 0;
  const points: LevelPoint[] = [];

  for (let week = 1; week <= completedWeeks; week++) {
    const required = getRequiredWorkouts(simulatedLevel);
    const completed = countCompletedWorkouts(user.id, workoutDays, week, simulatedLevel);
    const isClean = completed >= required;
    points.push({ week, level: simulatedLevel, isClean });

    if (isClean) {
      consecutiveClean++;
      if (consecutiveClean >= 3 && simulatedLevel > 3) {
        simulatedLevel--;
        consecutiveClean = 0;
      }
    } else {
      consecutiveClean = 0;
      if (simulatedLevel < 5) {
        simulatedLevel = Math.min(simulatedLevel + 1, startingLevel);
      }
    }
  }

  if (currentWeek > 0) {
    points.push({ week: currentWeek, level: simulatedLevel, isClean: false });
  }

  return points;
};

/**
 * Update all users' consistency metrics.
 * Uses simulateFullHistory for efficient single-pass computation per user.
 */
export const updateAllUsersConsistency = (
  users: User[],
  workoutDays: WorkoutDay[],
  goals: { userId: string; isCompleted: boolean }[],
  currentWeek: number,
  weeklyPlans: WeeklyPlan[] = []
): User[] => {
  return users.map(user => {
    if (!user.isActive) return user;

    const userCompletedGoals = goals.filter(g => g.userId === user.id && g.isCompleted).length;
    const sim = simulateFullHistory(user, workoutDays, currentWeek);
    const bonusWeeks = calculateBonusWeeksFromHistory(user, workoutDays, weeklyPlans, currentWeek, sim.levelHistory);
    const totalPoints = userCompletedGoals + sim.cleanWeeks + bonusWeeks;
    const eliminated = shouldBeEliminated(user, sim.stintMissedWeeks);

    return {
      ...user,
      cleanWeeks: sim.cleanWeeks,
      missedWeeks: sim.missedWeeks,
      currentConsistencyLevel: sim.currentLevel,
      totalPoints,
      isActive: !eliminated
    };
  });
};

/**
 * For the current week, determine which remaining days a user MUST work out
 * because they have zero margin left (remaining workouts >= remaining days).
 * Returns an empty set for past/future weeks or when the week is already complete.
 */
export const getMustWorkoutDays = (
  userId: string,
  workoutDays: WorkoutDay[],
  level: number,
  required: number,
  completed: number,
  todayDow: number, // 1=Mon … 7=Sun
): Set<number> => {
  const remaining = required - completed;
  const daysLeft = 7 - todayDow + 1;

  if (remaining <= 0 || remaining < daysLeft) return new Set();

  const days = new Set<number>();
  for (let d = todayDow; d <= 7; d++) {
    const wd = workoutDays.find(
      (w) => w.userId === userId && w.dayOfWeek === d && w.isCompleted,
    );
    const done = wd && (level >= 5 || wd.workoutType !== 'steps');
    if (!done) days.add(d);
  }
  return days;
};
