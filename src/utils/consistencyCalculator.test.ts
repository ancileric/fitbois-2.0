import {
  calculateWeekStatus,
  calculateAllWeekStatuses,
  calculateConsistencyMetrics,
  calculateNewConsistencyLevel,
  shouldBeEliminated,
  calculateConsistencyUpdate,
  updateAllUsersConsistency,
} from './consistencyCalculator';
import { User, WorkoutDay } from '../types';

describe('Consistency Calculator Tests', () => {
  // Helper to create a user
  const createUser = (
    id: string,
    level: 3 | 4 | 5 = 5,
    cleanWeeks: number = 0,
    missedWeeks: number = 0
  ): User => ({
    id,
    name: `User ${id}`,
    avatar: '👤',
    startDate: '2026-01-19',
    currentConsistencyLevel: level,
    cleanWeeks,
    missedWeeks,
    totalPoints: 0,
    isActive: true,
  });

  // Helper to create workout days
  const createWorkouts = (
    userId: string,
    weekWorkouts: number[]
  ): WorkoutDay[] => {
    const workouts: WorkoutDay[] = [];
    weekWorkouts.forEach((count, index) => {
      const week = index + 1;
      for (let day = 1; day <= count; day++) {
        workouts.push({
          id: `${userId}-w${week}-d${day}`,
          userId,
          week,
          dayOfWeek: day,
          date: `2026-01-${19 + (week - 1) * 7 + day}`,
          isCompleted: true,
          markedBy: 'user',
          timestamp: new Date().toISOString(),
        });
      }
    });
    return workouts;
  };

  describe('Basic Week Status Calculation', () => {
    test('should correctly identify complete week at level 5', () => {
      const user = createUser('u1', 5);
      const workouts = createWorkouts('u1', [5]); // 5 workouts in week 1

      const status = calculateWeekStatus(user, workouts, 1);

      expect(status.week).toBe(1);
      expect(status.completedWorkouts).toBe(5);
      expect(status.requiredWorkouts).toBe(5);
      expect(status.isComplete).toBe(true);
    });

    test('should correctly identify incomplete week at level 5', () => {
      const user = createUser('u1', 5);
      const workouts = createWorkouts('u1', [4]); // Only 4 workouts

      const status = calculateWeekStatus(user, workouts, 1);

      expect(status.completedWorkouts).toBe(4);
      expect(status.requiredWorkouts).toBe(5);
      expect(status.isComplete).toBe(false);
    });

    test('should handle week with extra workouts', () => {
      const user = createUser('u1', 5);
      const workouts = createWorkouts('u1', [7]); // 7 workouts (more than required)

      const status = calculateWeekStatus(user, workouts, 1);

      expect(status.completedWorkouts).toBe(7);
      expect(status.isComplete).toBe(true);
    });
  });

  describe('Progression: Level 5 → 4 (3 clean weeks)', () => {
    test('should progress from level 5 to 4 after 3 consecutive clean weeks', () => {
      const user = createUser('u1', 5);
      const workouts = createWorkouts('u1', [5, 5, 5]); // 3 weeks of 5 workouts
      const weekStatuses = calculateAllWeekStatuses(user, workouts, 4); // Current week is 4

      const newLevel = calculateNewConsistencyLevel(user, 3, weekStatuses);

      console.log('Test: 3 weeks at level 5');
      console.log('Week statuses:', weekStatuses);
      console.log('Expected: 4, Got:', newLevel);

      expect(newLevel).toBe(4);
    });

    test('should NOT progress with only 2 clean weeks', () => {
      const user = createUser('u1', 5);
      const workouts = createWorkouts('u1', [5, 5]); // Only 2 weeks
      const weekStatuses = calculateAllWeekStatuses(user, workouts, 3);

      const newLevel = calculateNewConsistencyLevel(user, 2, weekStatuses);

      expect(newLevel).toBe(5);
    });

    test('should NOT progress if one week is incomplete', () => {
      const user = createUser('u1', 5);
      const workouts = createWorkouts('u1', [5, 4, 5]); // Week 2 incomplete
      const weekStatuses = calculateAllWeekStatuses(user, workouts, 4);

      const newLevel = calculateNewConsistencyLevel(user, 2, weekStatuses);

      console.log('Test: Week 2 incomplete at level 5');
      console.log('Week statuses:', weekStatuses);
      console.log('Expected: 5, Got:', newLevel);

      expect(newLevel).toBe(5);
    });

    test('should progress after recovering from missed week', () => {
      const user = createUser('u1', 5);
      const workouts = createWorkouts('u1', [5, 4, 5, 5, 5]); // Miss week 2, then 3 clean
      const weekStatuses = calculateAllWeekStatuses(user, workouts, 6);

      const newLevel = calculateNewConsistencyLevel(user, 3, weekStatuses);

      console.log('Test: Recovered from missed week');
      console.log('Week statuses:', weekStatuses);
      console.log('Expected: 4 (3 consecutive after miss), Got:', newLevel);

      expect(newLevel).toBe(4);
    });
  });

  describe('Progression: Level 4 → 3 (requires special handling)', () => {
    test('CRITICAL: User at level 4 with 3 clean weeks should progress to level 3', () => {
      // User already progressed to level 4
      const user = createUser('u1', 4);
      // Simulating: weeks 1-3 were at level 5 (5 workouts each)
      // Now at level 4, weeks 4-6 have 4 workouts each
      const workouts = createWorkouts('u1', [5, 5, 5, 4, 4, 4]);
      const weekStatuses = calculateAllWeekStatuses(user, workouts, 7);

      const newLevel = calculateNewConsistencyLevel(user, 6, weekStatuses);

      console.log('Test: Level 4 user with 6 total weeks');
      console.log('Week statuses:', weekStatuses);
      console.log('User current level:', user.currentConsistencyLevel);
      console.log('Expected: 3, Got:', newLevel);

      // THIS IS THE BUG: It requires 6 consecutive weeks from last miss
      // But if user is at level 4, checking past weeks against level 4 requirement is wrong!
      expect(newLevel).toBe(3);
    });
  });

  describe('Regression: Miss a week', () => {
    test('should regress from level 3 to 4 when missing a week', () => {
      const user = createUser('u1', 3);
      const workouts = createWorkouts('u1', [3, 3, 2]); // Week 3 incomplete (only 2 workouts)
      const weekStatuses = calculateAllWeekStatuses(user, workouts, 4);

      const newLevel = calculateNewConsistencyLevel(user, 2, weekStatuses);

      console.log('Test: Regression from level 3');
      console.log('Week statuses:', weekStatuses);
      console.log('Expected: 4 (regressed), Got:', newLevel);

      expect(newLevel).toBe(4);
    });

    test('should regress from level 4 to 5 when missing a week', () => {
      const user = createUser('u1', 4);
      const workouts = createWorkouts('u1', [4, 4, 3]); // Week 3 incomplete
      const weekStatuses = calculateAllWeekStatuses(user, workouts, 4);

      const newLevel = calculateNewConsistencyLevel(user, 2, weekStatuses);

      expect(newLevel).toBe(5);
    });

    test('should stay at level 5 when missing a week (already at max)', () => {
      const user = createUser('u1', 5);
      const workouts = createWorkouts('u1', [5, 4]); // Week 2 incomplete
      const weekStatuses = calculateAllWeekStatuses(user, workouts, 3);

      const newLevel = calculateNewConsistencyLevel(user, 1, weekStatuses);

      expect(newLevel).toBe(5);
    });
  });

  describe('Elimination', () => {
    test('should eliminate user with 2 missed weeks at level 5', () => {
      const user = createUser('u1', 5);

      const eliminated = shouldBeEliminated(user, 2);

      expect(eliminated).toBe(true);
    });

    test('should NOT eliminate user with 2 missed weeks at level 4', () => {
      const user = createUser('u1', 4);

      const eliminated = shouldBeEliminated(user, 2);

      expect(eliminated).toBe(false);
    });

    test('should NOT eliminate user with only 1 missed week at level 5', () => {
      const user = createUser('u1', 5);

      const eliminated = shouldBeEliminated(user, 1);

      expect(eliminated).toBe(false);
    });
  });

  describe('Complete Consistency Update', () => {
    test('should correctly update all metrics for a progressing user', () => {
      const user = createUser('u1', 5);
      const workouts = createWorkouts('u1', [5, 5, 5]); // 3 clean weeks

      const update = calculateConsistencyUpdate(user, workouts, 4, 0);

      console.log('Complete update test:', update);

      expect(update.cleanWeeks).toBe(3);
      expect(update.missedWeeks).toBe(0);
      expect(update.newConsistencyLevel).toBe(4);
      expect(update.levelChanged).toBe(true);
      expect(update.totalPoints).toBe(3); // 3 clean weeks
    });

    test('should handle special starting level (Subhash)', () => {
      const user: User = {
        id: 'subhash',
        name: 'Subhash',
        avatar: '🏆',
        startDate: '2026-01-19',
        currentConsistencyLevel: 4, // Starts at 4
        cleanWeeks: 0,
        missedWeeks: 0,
        totalPoints: 0,
        isActive: true,
        specialRules: {
          startingLevel: 4, // Cannot go above 4
        },
      };
      const workouts = createWorkouts('subhash', [4, 4, 4]); // 3 clean weeks at level 4

      const update = calculateConsistencyUpdate(user, workouts, 4, 0);

      console.log('Subhash test:', update);

      expect(update.newConsistencyLevel).toBe(3); // Should progress to 3
      expect(update.levelChanged).toBe(true);
    });
  });

  describe('Real-world scenario: Mixed progression and regression', () => {
    test('should handle complex scenario: progress, regress, progress again', () => {
      let user = createUser('u1', 5);

      // Weeks 1-3: 5 workouts each → should progress to level 4
      let workouts = createWorkouts('u1', [5, 5, 5]);
      let update = calculateConsistencyUpdate(user, workouts, 4, 0);
      console.log('After weeks 1-3:', update);
      expect(update.newConsistencyLevel).toBe(4);

      // Update user to level 4
      user = { ...user, currentConsistencyLevel: 4 };

      // Week 4: miss (only 3 workouts) → should regress to level 5
      workouts = createWorkouts('u1', [5, 5, 5, 3]);
      update = calculateConsistencyUpdate(user, workouts, 5, 0);
      console.log('After week 4 miss:', update);
      expect(update.newConsistencyLevel).toBe(5);

      // Update user to level 5
      user = { ...user, currentConsistencyLevel: 5 };

      // Weeks 5-7: 5 workouts each → should progress back to level 4
      workouts = createWorkouts('u1', [5, 5, 5, 3, 5, 5, 5]);
      update = calculateConsistencyUpdate(user, workouts, 8, 0);
      console.log('After recovery:', update);
      expect(update.newConsistencyLevel).toBe(4);
    });
  });

  describe('Edge Cases', () => {
    test('should handle user with no workout data', () => {
      const user = createUser('u1', 5);
      const workouts: WorkoutDay[] = [];

      const update = calculateConsistencyUpdate(user, workouts, 1, 0);

      expect(update.cleanWeeks).toBe(0);
      expect(update.missedWeeks).toBe(0);
      expect(update.newConsistencyLevel).toBe(5);
    });

    test('should not count current week (week in progress)', () => {
      const user = createUser('u1', 5);
      const workouts = createWorkouts('u1', [5, 5, 5]); // 3 weeks complete

      // Current week is 4, so only weeks 1-3 should be counted
      const weekStatuses = calculateAllWeekStatuses(user, workouts, 4);

      expect(weekStatuses.length).toBe(3);
      expect(weekStatuses.every(s => s.week <= 3)).toBe(true);
    });
  });
});
