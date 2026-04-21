export interface User {
  id: string;
  name: string;
  avatar?: string;
  startDate: string;
  currentConsistencyLevel: 3 | 4 | 5; // consistency level (levels 3 & 4 both require 4 workouts/week)
  cleanWeeks: number;
  missedWeeks: number;
  totalPoints: number;
  isActive: boolean;
  specialRules?: {
    startingLevel?: number; // For users like Subhash who start at 4 days
    reactivatedAtWeek?: number; // Week from which a second-chance user's stint resets
  };
}

export interface Goal {
  id: string;
  userId: string;
  category: GoalCategory;
  description: string;
  isDifficult: boolean; // At least one goal must be difficult
  isCompleted: boolean;
  completedDate?: string;
  proofs: Proof[];
  createdDate: string;
}

export type GoalCategory = 
  | 'cardio'
  | 'strength' 
  | 'consistency'
  | 'sports'
  | 'personal-growth';

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

export interface WorkoutDay {
  id: string;
  userId: string;
  week: number;
  dayOfWeek: number; // 1-7 (Monday-Sunday)
  date: string;
  isCompleted: boolean;
  workoutType?: string;
  notes?: string;
  markedBy: 'user' | 'admin';
  timestamp: string;
}

export interface WeeklyPlan {
  id: string;
  userId: string;
  week: number;
  committedDays: number[]; // 1 = Monday … 7 = Sunday
  committedAt: string;
  createdBy: 'user' | 'admin';
}

export interface AdminSettings {
  challengeStartDate: string;
  challengeEndDate: string;
  currentWeek: number;
  isActive: boolean;
}

export interface ConsistencyRule {
  level: 3 | 4 | 5;
  daysPerWeek: number;
  cleanWeeksRequired: number;
  canUseSteps: boolean;
}

export const CONSISTENCY_RULES: ConsistencyRule[] = [
  { level: 5, daysPerWeek: 5, cleanWeeksRequired: 3, canUseSteps: true },
  { level: 4, daysPerWeek: 4, cleanWeeksRequired: 3, canUseSteps: false },
  { level: 3, daysPerWeek: 4, cleanWeeksRequired: 0, canUseSteps: false },
];

/**
 * Get the required number of workouts per week for a given consistency level.
 * Levels 3 and 4 both require 4 workouts/week. Level 5 requires 5.
 */
export const getRequiredWorkouts = (level: number): number => {
  if (level <= 4) return 4;
  return level;
};

export const GOAL_CATEGORIES = [
  { id: 'cardio', name: 'Cardio / Endurance', icon: '🏃‍♂️' },
  { id: 'strength', name: 'Strength', icon: '💪' },
  { id: 'consistency', name: 'Consistency / Habit Building', icon: '📅' },
  { id: 'sports', name: 'Sports / Play', icon: '⚽' },
  { id: 'personal-growth', name: 'Personal Growth', icon: '🎯' },
] as const;