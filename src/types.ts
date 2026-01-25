export interface User {
  id: string;
  name: string;
  avatar?: string;
  startDate: string;
  currentConsistencyLevel: 3 | 4 | 5; // days per week
  cleanWeeks: number;
  missedWeeks: number;
  totalPoints: number;
  isActive: boolean;
  specialRules?: {
    startingLevel?: number; // For users like Subhash who start at 4 days
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
  { level: 3, daysPerWeek: 3, cleanWeeksRequired: 0, canUseSteps: false },
];

export const GOAL_CATEGORIES = [
  { id: 'cardio', name: 'Cardio / Endurance', icon: '🏃‍♂️' },
  { id: 'strength', name: 'Strength', icon: '💪' },
  { id: 'consistency', name: 'Consistency / Habit Building', icon: '📅' },
  { id: 'sports', name: 'Sports / Play', icon: '⚽' },
  { id: 'personal-growth', name: 'Personal Growth', icon: '🎯' },
] as const;