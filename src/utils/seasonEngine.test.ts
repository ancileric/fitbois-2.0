import {
  runSeason,
  skipTokenBlocker,
  goalSplitError,
  goalProgressFraction,
  fineAtLevel,
  FINE_BASE,
  WORKOUTS_PER_WEEK,
  MAX_SKIP_TOKENS,
  SEASON_WEEKS,
} from './seasonEngine';
import { WorkoutDay } from '../types';

/**
 * Build workout rows from a per-week entry.
 *
 * A number is that many sessions: [5, 3] = week 1 clean, week 2 missed.
 * A pair is [sessions, stepDays]: [3, 4] in week 1 is 3 + 4×½ = 5 credits.
 */
type WeekEntry = number | [number, number];

const workouts = (userId: string, perWeek: WeekEntry[]): WorkoutDay[] => {
  const rows: WorkoutDay[] = [];
  perWeek.forEach((entry, i) => {
    const [sessions, steps] = Array.isArray(entry) ? entry : [entry, 0];
    let day = 1;
    const push = (kind: 'session' | 'steps') => {
      rows.push({
        id: `${userId}-w${i + 1}-d${day}`,
        userId,
        week: i + 1,
        dayOfWeek: day,
        date: '2026-01-19',
        isCompleted: true,
        kind,
        markedBy: 'user',
        timestamp: '2026-01-19T10:00:00Z',
      });
      day++;
    };
    for (let d = 0; d < sessions; d++) push('session');
    for (let d = 0; d < steps; d++) push('steps');
  });
  return rows;
};

const season = (perWeek: WeekEntry[], opts: { skipWeeks?: number[]; settledWeeks?: number[] } = {}) =>
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

  test('10k steps is half a workout, so two step days make one', () => {
    expect(season([[4, 2]]).weeks[0].credits).toBe(5);
    expect(season([[4, 2]]).weeks[0].outcome).toBe('clean');
    expect(season([[4, 1]]).weeks[0].credits).toBe(4.5);
    expect(season([[4, 1]]).weeks[0].outcome).toBe('missed');
  });

  test('a week cannot be walked clean — seven step days is 3.5', () => {
    expect(season([[0, 7]]).weeks[0].credits).toBe(3.5);
    expect(season([[0, 7]]).weeks[0].outcome).toBe('missed');
  });

  test('a row logged before steps existed still counts as a session', () => {
    const legacy = workouts('u1', [5]).map(({ kind, ...rest }) => rest as WorkoutDay);
    const s = runSeason({ userId: 'u1', workoutDays: legacy, completedWeeks: 1 });
    expect(s.weeks[0].credits).toBe(5);
    expect(s.weeks[0].outcome).toBe('clean');
  });
});

describe('the price ladder', () => {
  test('everyone starts at ₹200', () => {
    expect(season([]).priceLevel).toBe(1);
    expect(FINE_BASE).toBe(200);
    expect(fineAtLevel(1)).toBe(200);
  });

  test('every level doubles the one below it', () => {
    expect([1, 2, 3, 4, 5].map(fineAtLevel)).toEqual([200, 400, 800, 1600, 3200]);
  });

  test('two strikes at a price, then it doubles', () => {
    const s = season([0, 0, 0, 0, 0, 0], { settledWeeks: paidUp(6) });
    expect(s.weeks.map((w) => w.fine)).toEqual([200, 200, 400, 400, 800, 800]);
    expect(s.billed).toBe(2800);
  });

  test('the third miss is charged at the doubled price', () => {
    expect(season([0, 0, 0], { settledWeeks: paidUp(3) }).weeks[2].fine).toBe(400);
  });

  test('two clean weeks halve it again', () => {
    const s = season([0, 0, 5, 5, 0], { settledWeeks: paidUp(5) });
    expect(s.priceLevel).toBe(1);
    expect(s.weeks[4].fine).toBe(200);
  });

  test('the ladder has no ceiling', () => {
    const s = season(Array(8).fill(0), { settledWeeks: paidUp(8) });
    expect(s.priceLevel).toBe(5);
    expect(s.weeks[7].fine).toBe(1600);
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
    expect(s.outstanding).toBe(200);
  });

  test('carrying the balance into the next week suspends', () => {
    const s = season([0, 5]);
    expect(s.standing).toBe('suspended');
    expect(s.suspendedAtWeek).toBe(2);
  });

  test('paying inside the week keeps you active', () => {
    const s = season([0, 5], { settledWeeks: [1] });
    expect(s.standing).toBe('active');
    expect(s.paid).toBe(200);
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

  test('exactly 3 tokens are all honoured', () => {
    const s = season([0, 0, 0], { skipWeeks: [1, 2, 3] });
    expect(s.tokensUsed).toBe(3);
    expect(s.billed).toBe(0);
    expect(s.weeks.map((w) => w.outcome)).toEqual(['skipped', 'skipped', 'skipped']);
  });

  test('a 4th token week is fined like any other miss', () => {
    const s = season([0, 0, 0, 0], { skipWeeks: [1, 2, 3, 4] });
    expect(s.tokensUsed).toBe(3);
    expect(s.missedWeeks).toBe(1);
    expect(s.billed).toBe(200);
    expect(s.weeks[3].outcome).toBe('missed');
  });

  test('the cap holds however many weeks were approved', () => {
    const weeks = Array.from({ length: 24 }, (_, i) => i + 1);
    const s = season(Array(24).fill(0), { skipWeeks: weeks, settledWeeks: weeks });
    expect(s.tokensUsed).toBe(MAX_SKIP_TOKENS);
  });

  test('the first three approved weeks are the ones honoured, in week order', () => {
    const s = season([0, 0, 0, 0], { skipWeeks: [4, 3, 2, 1] });
    expect(s.weeks[3].outcome).toBe('missed');
    expect(s.weeks[0].outcome).toBe('skipped');
  });

  test('a week outside the season is rejected as such, not as a late week', () => {
    expect(skipTokenBlocker(99, SEASON_WEEKS, [])).toMatch(/isn't in the season/);
    expect(skipTokenBlocker(0, SEASON_WEEKS, [])).toMatch(/isn't in the season/);
    expect(skipTokenBlocker(SEASON_WEEKS, SEASON_WEEKS, [])).toMatch(/final two weeks/);
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

describe('goal progress (Rule 11: completed AT TARGET)', () => {
  test('a lift completes only when the reading reaches the target', () => {
    expect(goalProgressFraction(70, 100, 85)).toBeCloseTo(0.5);
    expect(goalProgressFraction(70, 100, 99)).not.toBe(1);
    expect(goalProgressFraction(70, 100, 100)).toBe(1);
    expect(goalProgressFraction(70, 100, 120)).toBe(1);
  });

  test('a goal that counts down completes the same way', () => {
    expect(goalProgressFraction(150, 120, 135)).toBeCloseTo(0.5);
    expect(goalProgressFraction(150, 120, 121)).not.toBe(1);
    expect(goalProgressFraction(150, 120, 120)).toBe(1);
    expect(goalProgressFraction(150, 120, 110)).toBe(1);
  });

  test('going backwards floors at 0, never negative', () => {
    expect(goalProgressFraction(70, 100, 50)).toBe(0);
  });

  test('a goal with no numbers has no fraction, so no reading can complete it', () => {
    expect(goalProgressFraction(null, 100, 90)).toBeNull();
    expect(goalProgressFraction(70, null, 90)).toBeNull();
    expect(goalProgressFraction(70, 100, undefined)).toBeNull();
  });
});
