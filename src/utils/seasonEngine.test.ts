import {
  runSeason,
  skipTokenBlocker,
  goalSplitError,
  FINE_BY_LEVEL,
  WORKOUTS_PER_WEEK,
} from './seasonEngine';
import { WorkoutDay } from '../types';

/** Build workout rows from a per-week count: [5, 3] = week 1 clean, week 2 missed. */
const workouts = (userId: string, perWeek: number[]): WorkoutDay[] => {
  const rows: WorkoutDay[] = [];
  perWeek.forEach((count, i) => {
    for (let d = 1; d <= count; d++) {
      rows.push({
        id: `${userId}-w${i + 1}-d${d}`,
        userId,
        week: i + 1,
        dayOfWeek: d,
        date: '2026-01-19',
        isCompleted: true,
        markedBy: 'user',
        timestamp: '2026-01-19T10:00:00Z',
      });
    }
  });
  return rows;
};

const season = (perWeek: number[], opts: { skipWeeks?: number[]; settledWeeks?: number[] } = {}) =>
  runSeason({
    userId: 'u1',
    workoutDays: workouts('u1', perWeek),
    completedWeeks: perWeek.length,
    ...opts,
  });

/** Settle every week, so payment behaviour stays out of ladder tests. */
const paidUp = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe('what makes a week clean', () => {
  test('5 workouts is clean, 4 is not', () => {
    expect(season([5]).weeks[0].outcome).toBe('clean');
    expect(season([4]).weeks[0].outcome).toBe('missed');
  });

  test('more than 5 is still just clean', () => {
    expect(season([7]).weeks[0].outcome).toBe('clean');
    expect(season([7]).missedWeeks).toBe(0);
  });

  test('the threshold is the same for everyone, every week', () => {
    expect(WORKOUTS_PER_WEEK).toBe(5);
  });
});

describe('the price ladder', () => {
  test('everyone starts at ₹500', () => {
    expect(season([]).priceLevel).toBe(1);
    expect(FINE_BY_LEVEL[1]).toBe(500);
  });

  test('3 misses raise the price', () => {
    const s = season([0, 0, 0], { settledWeeks: paidUp(3) });
    expect(s.priceLevel).toBe(2);
    expect(s.billed).toBe(1500);
  });

  test('the 4th miss is charged at the new price', () => {
    expect(season([0, 0, 0, 0], { settledWeeks: paidUp(4) }).billed).toBe(2500);
  });

  test('3 clean weeks bring it back down', () => {
    const s = season([0, 0, 0, 5, 5, 5], { settledWeeks: paidUp(6) });
    expect(s.priceLevel).toBe(1);
  });

  test('₹2,000 is the ceiling', () => {
    const s = season(Array(9).fill(0), { settledWeeks: paidUp(9) });
    expect(s.priceLevel).toBe(3);
    expect(s.billed).toBe(3 * 500 + 3 * 1000 + 3 * 2000);
  });

  test('a broken streak restarts the count', () => {
    const s = season([5, 5, 0, 5, 5], { settledWeeks: paidUp(5) });
    expect(s.priceLevel).toBe(1);
    expect(s.cleanStreak).toBe(2);
  });
});

describe('paying, suspension and elimination', () => {
  test('the fine week itself is still inside the grace period', () => {
    const s = season([0]);
    expect(s.standing).toBe('active');
    expect(s.outstanding).toBe(500);
  });

  test('carrying the balance into the next week suspends', () => {
    const s = season([0, 5]);
    expect(s.standing).toBe('suspended');
    expect(s.suspendedAtWeek).toBe(2);
  });

  test('paying inside the week keeps you active', () => {
    const s = season([0, 5], { settledWeeks: [1] });
    expect(s.standing).toBe('active');
    expect(s.paid).toBe(500);
    expect(s.outstanding).toBe(0);
  });

  test('paying late lifts the suspension', () => {
    const s = season([0, 5], { settledWeeks: [2] });
    expect(s.standing).toBe('active');
    expect(s.suspendedAtWeek).toBeNull();
  });

  test('two fines while suspended puts you out', () => {
    const s = season([0, 0, 0, 0, 0]);
    expect(s.standing).toBe('out');
    expect(s.outAtWeek).toBe(3);
  });

  test('weeks after elimination are not played', () => {
    expect(season([0, 0, 0, 0, 0]).weeks).toHaveLength(3);
  });

  test('settling every week keeps you in for the whole season', () => {
    const s = season(Array(10).fill(0), { settledWeeks: paidUp(10) });
    expect(s.standing).toBe('active');
    expect(s.outstanding).toBe(0);
  });
});

describe('the pot (Rule 11)', () => {
  test('a fined week does not cost you the pot', () => {
    const s = season([0, 5, 5], { settledWeeks: [1] });
    expect(s.missedWeeks).toBe(1);
    expect(s.potEligible).toBe(true);
  });

  test('owing money at the end does', () => {
    expect(season([0, 5, 5]).potEligible).toBe(false);
  });

  test('elimination does, permanently', () => {
    expect(season([0, 0, 0, 0, 0]).potEligible).toBe(false);
  });

  test('a clean season is in', () => {
    expect(season([5, 5, 5, 5]).potEligible).toBe(true);
  });
});

describe('skip tokens', () => {
  test('a token cancels the fine and freezes the ladder', () => {
    const s = season([0], { skipWeeks: [1] });
    expect(s.weeks[0].outcome).toBe('skipped');
    expect(s.billed).toBe(0);
    expect(s.priceLevel).toBe(1);
    expect(s.tokensUsed).toBe(1);
  });

  test('a token week neither breaks a streak nor builds one', () => {
    const s = season([5, 5, 0, 5], { skipWeeks: [3] });
    expect(s.cleanStreak).toBe(3);
    expect(s.priceLevel).toBe(1);
  });

  test('a clean week does not spend a token', () => {
    const s = season([5], { skipWeeks: [1] });
    expect(s.tokensUsed).toBe(0);
    expect(s.weeks[0].outcome).toBe('clean');
  });

  test('three a season, never three in a row, not in the last two weeks', () => {
    expect(skipTokenBlocker(5, 24, [])).toBeNull();
    expect(skipTokenBlocker(5, 24, [1, 2, 3])).toMatch(/All 3/);
    expect(skipTokenBlocker(5, 24, [3, 4])).toMatch(/three in a row/);
    expect(skipTokenBlocker(23, 24, [])).toMatch(/final two weeks/);
    expect(skipTokenBlocker(5, 24, [2, 3])).toBeNull(); // gap breaks the run
  });
});

describe('goal points (Rule 02)', () => {
  test('all 7 legal splits pass', () => {
    const legal = [[3, 3], [3, 2, 1], [3, 1, 1, 1], [2, 2, 2], [2, 2, 1, 1], [2, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1]];
    legal.forEach((split) => expect(goalSplitError(split)).toBeNull());
  });

  test('wrong totals and single goals fail', () => {
    expect(goalSplitError([3, 2])).toMatch(/still to spend/);
    expect(goalSplitError([3, 3, 1])).toMatch(/over/);
    expect(goalSplitError([3, 3, 3])).toMatch(/over/);
  });

  test('one goal is never legal, whatever it is worth', () => {
    expect(goalSplitError([3])).not.toBeNull();
  });

  test('a goal outside 1-3 points is rejected', () => {
    expect(goalSplitError([6])).toMatch(/1, 2 or 3/);
  });
});
