import { User, Goal, WeeklyUpdate, Proof } from '../types';

export const generateMockData = () => {
  const users: User[] = [
    {
      id: '1',
      name: 'You',
      avatar: '👤',
      startDate: '2026-01-19',
      currentConsistencyLevel: 5,
      cleanWeeks: 0,
      missedWeeks: 0,
      totalPoints: 0,
      isActive: true,
    },
    {
      id: '2',
      name: 'Subhash',
      avatar: '🏆',
      startDate: '2026-01-19',
      currentConsistencyLevel: 4, // Starts at 4 days/week (winner of FitBois 1.0)
      cleanWeeks: 0,
      missedWeeks: 0,
      totalPoints: 0,
      isActive: true,
      specialRules: {
        startingLevel: 4
      }
    },
    {
      id: '3',
      name: 'Friend 1',
      avatar: '💪',
      startDate: '2026-01-19',
      currentConsistencyLevel: 5,
      cleanWeeks: 0,
      missedWeeks: 0,
      totalPoints: 0,
      isActive: true,
    },
    {
      id: '4',
      name: 'Friend 2',
      avatar: '🏃‍♂️',
      startDate: '2026-01-19',
      currentConsistencyLevel: 5,
      cleanWeeks: 0,
      missedWeeks: 0,
      totalPoints: 0,
      isActive: true,
    },
  ];

  // Sample goals for the current user
  const goals: Goal[] = [
    {
      id: 'goal-1',
      userId: '1',
      category: 'cardio',
      description: 'Improve 5K time from 32 minutes to under 30 minutes',
      isDifficult: true,
      isCompleted: false,
      proofs: [],
      createdDate: '2026-01-19',
    },
    {
      id: 'goal-2',
      userId: '1',
      category: 'strength',
      description: 'Build up to 50 consecutive push-ups',
      isDifficult: false,
      isCompleted: false,
      proofs: [],
      createdDate: '2026-01-19',
    },
    {
      id: 'goal-3',
      userId: '1',
      category: 'consistency',
      description: 'Walk 10,000 steps every day for a month',
      isDifficult: false,
      isCompleted: false,
      proofs: [],
      createdDate: '2026-01-19',
    },
    {
      id: 'goal-4',
      userId: '1',
      category: 'sports',
      description: 'Play tennis once per week',
      isDifficult: false,
      isCompleted: false,
      proofs: [],
      createdDate: '2026-01-19',
    },
    {
      id: 'goal-5',
      userId: '1',
      category: 'personal-growth',
      description: 'Learn proper swimming technique and swim 500m continuously',
      isDifficult: false,
      isCompleted: false,
      proofs: [],
      createdDate: '2026-01-19',
    },
  ];

  const proofs: Proof[] = [];
  const weeklyUpdates: WeeklyUpdate[] = [];

  return {
    users,
    goals,
    proofs,
    weeklyUpdates,
  };
};