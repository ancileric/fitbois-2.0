import {
  calculateWeekStatus,
  calculateAllWeekStatuses,
  calculateConsistencyMetrics,
  calculateNewConsistencyLevel,
  shouldBeEliminated,
  calculateConsistencyUpdate,
  updateAllUsersConsistency,
  calculateStintMissedWeeks,
} from './consistencyCalculator';
import { User, WorkoutDay, getRequiredWorkouts } from '../types';

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

    test('should use requiredWorkoutsOverride when provided', () => {
      const user = createUser('u1', 5);
      const workouts = createWorkouts('u1', [4]);

      const status = calculateWeekStatus(user, workouts, 1, 4);

      expect(status.requiredWorkouts).toBe(4);
      expect(status.isComplete).toBe(true);
    });
  });

  describe('Progression: Level 5 → 4 (3 clean weeks)', () => {
    test('should progress from level 5 to 4 after 3 consecutive clean weeks', () => {
      const user = createUser('u1', 5);
      const workouts = createWorkouts('u1', [5, 5, 5]); // 3 weeks of 5 workouts

      const update = calculateConsistencyUpdate(user, workouts, 4, 0);

      expect(update.newConsistencyLevel).toBe(4);
    });

    test('should NOT progress with only 2 clean weeks', () => {
      const user = createUser('u1', 5);
      const workouts = createWorkouts('u1', [5, 5]); // Only 2 weeks

      const update = calculateConsistencyUpdate(user, workouts, 3, 0);

      expect(update.newConsistencyLevel).toBe(5);
    });

    test('should NOT progress if one week is incomplete', () => {
      const user = createUser('u1', 5);
      const workouts = createWorkouts('u1', [5, 4, 5]); // Week 2 incomplete

      const update = calculateConsistencyUpdate(user, workouts, 4, 0);

      expect(update.newConsistencyLevel).toBe(5);
    });

    test('should progress after recovering from missed week', () => {
      const user = createUser('u1', 5);
      const workouts = createWorkouts('u1', [5, 4, 5, 5, 5]); // Miss week 2, then 3 clean

      const update = calculateConsistencyUpdate(user, workouts, 6, 0);

      expect(update.newConsistencyLevel).toBe(4);
    });
  });

  describe('Progression: Level 4 → 3 (requires simulation)', () => {
    test('CRITICAL: User should progress 5→4→3 with 6 clean weeks', () => {
      // User starts at level 5. Weeks 1-3: 5 workouts each (level 5).
      // After week 3: progresses to level 4. Weeks 4-6: 4 workouts each (level 4).
      // After week 6: progresses to level 3.
      const user = createUser('u1', 5);
      const workouts = createWorkouts('u1', [5, 5, 5, 4, 4, 4]);

      const update = calculateConsistencyUpdate(user, workouts, 7, 0);

      expect(update.newConsistencyLevel).toBe(3);
    });

    test('should NOT skip level: 3 clean weeks at level 5 → level 4 only', () => {
      const user = createUser('u1', 5);
      const workouts = createWorkouts('u1', [5, 5, 5]);

      const update = calculateConsistencyUpdate(user, workouts, 4, 0);

      expect(update.newConsistencyLevel).toBe(4);
      // Verify it did NOT jump to 3
      expect(update.newConsistencyLevel).not.toBe(3);
    });

    test('should stay at level 4 with only 2 clean weeks after progression', () => {
      const user = createUser('u1', 5);
      // 3 clean at level 5 → progresses to 4, then only 2 clean at level 4
      const workouts = createWorkouts('u1', [5, 5, 5, 4, 4]);

      const update = calculateConsistencyUpdate(user, workouts, 6, 0);

      expect(update.newConsistencyLevel).toBe(4);
    });
  });

  describe('Regression: Miss a week', () => {
    test('should regress from level 4 to 5 when missing a week after progression', () => {
      const user = createUser('u1', 5);
      // 3 clean at level 5 → level 4, then miss week 4
      const workouts = createWorkouts('u1', [5, 5, 5, 3]);

      const update = calculateConsistencyUpdate(user, workouts, 5, 0);

      expect(update.newConsistencyLevel).toBe(5);
    });

    test('should stay at level 5 when missing a week (already at max)', () => {
      const user = createUser('u1', 5);
      const workouts = createWorkouts('u1', [5, 4]); // Week 2 incomplete

      const update = calculateConsistencyUpdate(user, workouts, 3, 0);

      expect(update.newConsistencyLevel).toBe(5);
    });

    test('should regress from level 3 to 4 when missing a week', () => {
      const user = createUser('u1', 5);
      // 6 clean weeks to reach level 3, then miss week 7
      const workouts = createWorkouts('u1', [5, 5, 5, 4, 4, 4, 2]);

      const update = calculateConsistencyUpdate(user, workouts, 8, 0);

      expect(update.newConsistencyLevel).toBe(4);
    });
  });

  describe('Elimination', () => {
    test('should eliminate user with 2 stint-missed weeks at level 5', () => {
      const user = createUser('u1', 5);

      const eliminated = shouldBeEliminated(user, 2);

      expect(eliminated).toBe(true);
    });

    test('should NOT eliminate user with 2 stint-missed weeks at level 4', () => {
      const user = createUser('u1', 4);

      const eliminated = shouldBeEliminated(user, 2);

      expect(eliminated).toBe(false);
    });

    test('should NOT eliminate user with only 1 stint-missed week at level 5', () => {
      const user = createUser('u1', 5);

      const eliminated = shouldBeEliminated(user, 1);

      expect(eliminated).toBe(false);
    });
  });

  describe('Per-stint elimination logic', () => {
    test('stintMissedWeeks resets when user progresses from level 5 to 4', () => {
      const user = createUser('u1', 5);
      // Week 1: miss at level 5 (stintMissedWeeks = 1)
      // Weeks 2-4: 5 workouts each → 3 clean in a row → progress to level 4, reset to 0
      const workouts = createWorkouts('u1', [3, 5, 5, 5]);

      const stintMissedWeeks = calculateStintMissedWeeks(user, workouts, 5);

      expect(stintMissedWeeks).toBe(0);
    });

    test('stintMissedWeeks resets when user is demoted back to level 5 (new stint)', () => {
      const user = createUser('u1', 5);
      // Week 1: miss at level 5 (stintMissedWeeks = 1)
      // Weeks 2-4: 5 workouts each → progress to level 4, stintMissedWeeks resets to 0
      // Week 5: miss at level 4 → demoted back to level 5, stintMissedWeeks resets to 0 (new stint)
      const workouts = createWorkouts('u1', [3, 5, 5, 5, 3]);

      const stintMissedWeeks = calculateStintMissedWeeks(user, workouts, 6);

      expect(stintMissedWeeks).toBe(0);
    });

    test('should NOT eliminate user who progressed from level 5 and was demoted back (Sibi scenario)', () => {
      const user = createUser('u1', 5);
      // Week 1: miss at level 5 → stintMissedWeeks = 1
      // Weeks 2-4: clean at level 5 → progress to level 4, stintMissedWeeks reset to 0
      // Week 5: miss at level 4 → demoted back to level 5, new stint, stintMissedWeeks = 0
      const workouts = createWorkouts('u1', [3, 5, 5, 5, 3]);

      const stintMissedWeeks = calculateStintMissedWeeks(user, workouts, 6);
      const eliminated = shouldBeEliminated(user, stintMissedWeeks);

      expect(stintMissedWeeks).toBe(0);
      expect(eliminated).toBe(false);
    });

    test('should eliminate user who misses twice in the same level-5 stint', () => {
      const user = createUser('u1', 5);
      // Weeks 1-2: miss at level 5 → stintMissedWeeks = 2 → eliminated
      const workouts = createWorkouts('u1', [3, 3]);

      const stintMissedWeeks = calculateStintMissedWeeks(user, workouts, 3);
      const eliminated = shouldBeEliminated(user, stintMissedWeeks);

      expect(stintMissedWeeks).toBe(2);
      expect(eliminated).toBe(true);
    });

    test('stintMissedWeeks counts only misses in the current stint after demotion', () => {
      const user = createUser('u1', 5);
      // Week 1: miss at level 5 (old stint, stintMissedWeeks = 1)
      // Weeks 2-4: clean at level 5 → progress to level 4, reset to 0
      // Week 5: miss at level 4 → demoted to level 5, new stint reset to 0
      // Week 6: miss at level 5 (new stint, stintMissedWeeks = 1)
      const workouts = createWorkouts('u1', [3, 5, 5, 5, 3, 3]);

      const stintMissedWeeks = calculateStintMissedWeeks(user, workouts, 7);

      expect(stintMissedWeeks).toBe(1);
    });
  });

  describe('Complete Consistency Update', () => {
    test('should correctly update all metrics for a progressing user', () => {
      const user = createUser('u1', 5);
      const workouts = createWorkouts('u1', [5, 5, 5]); // 3 clean weeks

      const update = calculateConsistencyUpdate(user, workouts, 4, 0);

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

      expect(update.newConsistencyLevel).toBe(3); // Should progress to 3
      expect(update.levelChanged).toBe(true);
    });
  });

  describe('Real-world scenario: Mixed progression and regression', () => {
    test('should handle complex scenario: progress, regress, progress again', () => {
      const user = createUser('u1', 5);

      // Weeks 1-3: 5 workouts → progress to level 4
      // Week 4: 3 workouts (miss at level 4) → regress to level 5
      // Weeks 5-7: 5 workouts → progress back to level 4
      const workouts = createWorkouts('u1', [5, 5, 5, 3, 5, 5, 5]);

      const update = calculateConsistencyUpdate(user, workouts, 8, 0);

      expect(update.newConsistencyLevel).toBe(4);
    });

    test('should simulate full 6-week double progression correctly', () => {
      const user = createUser('u1', 5);

      // Week-by-week simulation:
      // Week 1: level 5, 5 workouts → clean (streak: 1)
      // Week 2: level 5, 5 workouts → clean (streak: 2)
      // Week 3: level 5, 5 workouts → clean (streak: 3) → PROGRESS to 4, reset streak
      // Week 4: level 4, 4 workouts → clean (streak: 1)
      // Week 5: level 4, 4 workouts → clean (streak: 2)
      // Week 6: level 4, 4 workouts → clean (streak: 3) → PROGRESS to 3, reset streak
      const workouts = createWorkouts('u1', [5, 5, 5, 4, 4, 4]);

      const update = calculateConsistencyUpdate(user, workouts, 7, 0);

      expect(update.newConsistencyLevel).toBe(3);
      expect(update.cleanWeeks).toBe(6);
      expect(update.missedWeeks).toBe(0);
    });
  });

  describe('Week statuses reflect simulation', () => {
    test('week statuses should show correct required workouts per level', () => {
      const user = createUser('u1', 5);
      const workouts = createWorkouts('u1', [5, 5, 5, 4, 4, 4, 4]);

      const weekStatuses = calculateAllWeekStatuses(user, workouts, 8);

      // Weeks 1-3 should require 5 (level 5)
      expect(weekStatuses[0].requiredWorkouts).toBe(5);
      expect(weekStatuses[1].requiredWorkouts).toBe(5);
      expect(weekStatuses[2].requiredWorkouts).toBe(5);
      // Weeks 4-6 should require 4 (level 4 after progression)
      expect(weekStatuses[3].requiredWorkouts).toBe(4);
      expect(weekStatuses[4].requiredWorkouts).toBe(4);
      expect(weekStatuses[5].requiredWorkouts).toBe(4);
      // Week 7 should require 4 (level 3 still requires 4 minimum)
      expect(weekStatuses[6].requiredWorkouts).toBe(4);
      // All weeks should be complete
      expect(weekStatuses.every(s => s.isComplete)).toBe(true);
    });
  });

  describe('Required workouts per level', () => {
    test('level 5 requires 5 workouts', () => {
      expect(getRequiredWorkouts(5)).toBe(5);
    });

    test('level 4 requires 4 workouts', () => {
      expect(getRequiredWorkouts(4)).toBe(4);
    });

    test('level 3 requires 4 workouts (minimum 4 rule)', () => {
      expect(getRequiredWorkouts(3)).toBe(4);
    });

    test('level 3 user needs 4 workouts for a clean week', () => {
      const user = createUser('u1', 5);
      // 6 clean weeks to reach level 3, then week 7 with only 3 workouts should be a miss
      const workouts = createWorkouts('u1', [5, 5, 5, 4, 4, 4, 3]);

      const update = calculateConsistencyUpdate(user, workouts, 8, 0);

      // 3 workouts at level 3 is NOT enough (need 4), so user regresses to level 4
      expect(update.newConsistencyLevel).toBe(4);
    });

    test('level 3 user with 4 workouts gets a clean week', () => {
      const user = createUser('u1', 5);
      // 6 clean weeks to reach level 3, then week 7 with 4 workouts should be clean
      const workouts = createWorkouts('u1', [5, 5, 5, 4, 4, 4, 4]);

      const update = calculateConsistencyUpdate(user, workouts, 8, 0);

      expect(update.newConsistencyLevel).toBe(3);
      expect(update.cleanWeeks).toBe(7);
    });
  });

  describe('Second-chance reactivation (reactivatedAtWeek)', () => {
    test('reactivated user is not re-eliminated if misses are all before reactivation week', () => {
      // Weeks 1-2: miss at level 5 (would normally eliminate), reactivatedAtWeek = 3
      const user: User = {
        ...createUser('u1', 5),
        specialRules: { reactivatedAtWeek: 3 },
      };
      const workouts = createWorkouts('u1', [3, 3, 5, 5]); // miss, miss, clean, clean

      const stintMissedWeeks = calculateStintMissedWeeks(user, workouts, 5);

      expect(stintMissedWeeks).toBe(0);
    });

    test('second-chance user can still be eliminated after 2 new misses post-reactivation', () => {
      // Weeks 1-2: miss (before reactivation), reactivatedAtWeek = 3
      // Weeks 3-4: miss (after reactivation) → stintMissedWeeks = 2 → eliminated
      const user: User = {
        ...createUser('u1', 5),
        specialRules: { reactivatedAtWeek: 3 },
      };
      const workouts = createWorkouts('u1', [3, 3, 3, 3]);

      const stintMissedWeeks = calculateStintMissedWeeks(user, workouts, 5);
      const eliminated = shouldBeEliminated(user, stintMissedWeeks);

      expect(stintMissedWeeks).toBe(2);
      expect(eliminated).toBe(true);
    });

    test('second-chance user with 1 miss after reactivation is at risk but not eliminated', () => {
      const user: User = {
        ...createUser('u1', 5),
        specialRules: { reactivatedAtWeek: 3 },
      };
      // Weeks 1-2: miss (before), week 3: miss (after), week 4: clean
      const workouts = createWorkouts('u1', [3, 3, 3, 5]);

      const stintMissedWeeks = calculateStintMissedWeeks(user, workouts, 5);
      const eliminated = shouldBeEliminated(user, stintMissedWeeks);

      expect(stintMissedWeeks).toBe(1);
      expect(eliminated).toBe(false);
    });

    test('reactivatedAtWeek after all completed weeks returns 0 (no weeks in new stint yet)', () => {
      // reactivatedAtWeek = 5, but currentWeek = 5 so completedWeeks = 4
      const user: User = {
        ...createUser('u1', 5),
        specialRules: { reactivatedAtWeek: 5 },
      };
      const workouts = createWorkouts('u1', [3, 3, 3, 3]); // all misses but before reactivation

      const stintMissedWeeks = calculateStintMissedWeeks(user, workouts, 5);

      expect(stintMissedWeeks).toBe(0);
    });

    test('without reactivatedAtWeek, same history correctly counts pre-reactivation misses', () => {
      // Same as above but WITHOUT reactivatedAtWeek — should still count the misses
      const user = createUser('u1', 5);
      const workouts = createWorkouts('u1', [3, 3]); // 2 misses → eliminated

      const stintMissedWeeks = calculateStintMissedWeeks(user, workouts, 3);

      expect(stintMissedWeeks).toBe(2);
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
