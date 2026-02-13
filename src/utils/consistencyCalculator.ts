import { User, WorkoutDay } from '../types';

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
  newConsistencyLevel: 3 | 4 | 5;
  levelChanged: boolean;
  totalPoints: number;
}

/**
 * Count completed workouts for a user in a given week
 */
const countCompletedWorkouts = (
  userId: string,
  workoutDays: WorkoutDay[],
  week: number
): number => {
  return workoutDays.filter(w =>
    w.userId === userId &&
    w.week === week &&
    w.isCompleted
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
  requiredWorkoutsOverride?: number
): WeekStatus => {
  const completedWorkouts = countCompletedWorkouts(user.id, workoutDays, week);
  const requiredWorkouts = requiredWorkoutsOverride ?? user.currentConsistencyLevel;

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
    const required = simulatedLevel;
    const status = calculateWeekStatus(user, workoutDays, week, required);
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
    const required = simulatedLevel;
    const completed = countCompletedWorkouts(user.id, workoutDays, week);
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
    const required = simulatedLevel;
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
 * Check if user should be eliminated
 */
export const shouldBeEliminated = (
  user: User,
  missedWeeks: number
): boolean => {
  // Rule: Miss 2 weeks at 5 days/week → eliminated
  return user.currentConsistencyLevel === 5 && missedWeeks >= 2;
};

/**
 * Calculate complete consistency update for a user
 */
export const calculateConsistencyUpdate = (
  user: User,
  workoutDays: WorkoutDay[],
  currentWeek: number,
  completedGoals: number
): ConsistencyUpdate => {
  const weekStatuses = calculateAllWeekStatuses(user, workoutDays, currentWeek);
  const { cleanWeeks, missedWeeks, consecutiveCleanWeeks } = calculateConsistencyMetrics(
    user,
    workoutDays,
    currentWeek
  );

  const newConsistencyLevel = simulateProgression(user, workoutDays, currentWeek);
  const levelChanged = newConsistencyLevel !== user.currentConsistencyLevel;

  // Points = completed goals (1 point each) + clean weeks (1 point each)
  const totalPoints = completedGoals + cleanWeeks;

  return {
    userId: user.id,
    cleanWeeks,
    missedWeeks,
    newConsistencyLevel,
    levelChanged,
    totalPoints
  };
};

/**
 * Update all users' consistency metrics
 */
export const updateAllUsersConsistency = (
  users: User[],
  workoutDays: WorkoutDay[],
  goals: { userId: string; isCompleted: boolean }[],
  currentWeek: number
): User[] => {
  return users.map(user => {
    if (!user.isActive) return user;

    const userCompletedGoals = goals.filter(g => g.userId === user.id && g.isCompleted).length;
    const update = calculateConsistencyUpdate(user, workoutDays, currentWeek, userCompletedGoals);

    // Check for elimination
    const eliminated = shouldBeEliminated(user, update.missedWeeks);

    return {
      ...user,
      cleanWeeks: update.cleanWeeks,
      missedWeeks: update.missedWeeks,
      currentConsistencyLevel: update.newConsistencyLevel,
      totalPoints: update.totalPoints,
      isActive: !eliminated
    };
  });
};
