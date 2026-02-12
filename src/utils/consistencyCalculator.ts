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
 * Calculate week completion status for a user
 */
export const calculateWeekStatus = (
  user: User, 
  workoutDays: WorkoutDay[], 
  week: number
): WeekStatus => {
  const userWorkouts = workoutDays.filter(w => 
    w.userId === user.id && 
    w.week === week && 
    w.isCompleted
  );
  
  const completedWorkouts = userWorkouts.length;
  const requiredWorkouts = user.currentConsistencyLevel;
  
  return {
    week,
    isComplete: completedWorkouts >= requiredWorkouts,
    completedWorkouts,
    requiredWorkouts
  };
};

/**
 * Calculate all week statuses for a user (only for completed weeks)
 */
export const calculateAllWeekStatuses = (
  user: User, 
  workoutDays: WorkoutDay[], 
  currentWeek: number
): WeekStatus[] => {
  const weekStatuses: WeekStatus[] = [];
  
  // Only calculate for completed weeks (not the current ongoing week)
  const completedWeeks = currentWeek - 1; // Current week is still in progress
  
  for (let week = 1; week <= completedWeeks; week++) {
    weekStatuses.push(calculateWeekStatus(user, workoutDays, week));
  }
  
  return weekStatuses;
};

/**
 * Calculate clean weeks and missed weeks for a user (only for completed weeks)
 */
export const calculateConsistencyMetrics = (
  user: User, 
  workoutDays: WorkoutDay[], 
  currentWeek: number
): { cleanWeeks: number; missedWeeks: number; consecutiveCleanWeeks: number } => {
  // Only calculate for completed weeks - current week is still in progress
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
      // Only count as missed week if the week is completely finished
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
 * Calculate consecutive clean weeks from the most recent missed week or start
 */
const calculateConsecutiveCleanWeeksFromLastMiss = (weekStatuses: WeekStatus[]): number => {
  // Count backwards from the most recent week
  // Stop when we hit a missed week
  let consecutiveClean = 0;
  for (let i = weekStatuses.length - 1; i >= 0; i--) {
    if (weekStatuses[i].isComplete) {
      consecutiveClean++;
    } else {
      // Hit a missed week - stop counting
      break;
    }
  }
  
  return consecutiveClean;
};

/**
 * Calculate new consistency level based on clean weeks and missed weeks (only for completed weeks)
 * Progression happens based on consecutive clean weeks from the last miss
 */
export const calculateNewConsistencyLevel = (
  user: User,
  consecutiveCleanWeeks: number,
  weekStatuses: WeekStatus[]
): 3 | 4 | 5 => {
  const currentLevel = user.currentConsistencyLevel;
  const startingLevel = user.specialRules?.startingLevel || 5; // Default to 5 if no special rules
  
  // Calculate consecutive clean weeks from the most recent missed week
  const recentConsecutiveClean = calculateConsecutiveCleanWeeksFromLastMiss(weekStatuses);
  
  // Check if the most recent week was missed (for regression)
  const lastWeekStatus = weekStatuses[weekStatuses.length - 1];
  const missedLastWeek = lastWeekStatus && !lastWeekStatus.isComplete;
  
  if (missedLastWeek) {
    // Regression rules: Miss a week → move back up one level (but not above starting level)
    if (currentLevel === 3) return Math.min(4, startingLevel) as 3 | 4 | 5;
    if (currentLevel === 4) return Math.min(5, startingLevel) as 3 | 4 | 5;
    // Already at 5, can't go higher
    return 5;
  }
  
  // Progression rules:
  // Level 5 → 4: 3 consecutive clean weeks
  // Level 4 → 3: 3 consecutive clean weeks at level 4
  //
  // Note: startingLevel ONLY affects regression (see above), not progression
  // All users can progress downward through levels they achieve
  
  if (currentLevel === 5 && recentConsecutiveClean >= 3) {
    return 4;
  } else if (currentLevel === 4 && recentConsecutiveClean >= 3) {
    return 3;
  }
  
  return currentLevel;
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
  
  const newConsistencyLevel = calculateNewConsistencyLevel(user, consecutiveCleanWeeks, weekStatuses);
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