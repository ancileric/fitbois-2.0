
/**
 * FitBros 3.0 season engine.
 *
 * One rule owner for the whole season. Every derived fact — the price of a miss,
 * the fines, the standing, the pot — is replayed from the raw record of what a
 * player did, so there is no stored state to drift.
 *
 * Replaces consistencyCalculator.ts, which models the FitBois 2.0 rules
 * (a workload ladder scored on points). Both exist until the screens migrate.
 *
 * Plain CommonJS on purpose: the Express server requires this same file, so the
 * rules can never drift between what the app shows and what the API charges.
 * Types are in seasonEngine.d.ts.
 */

/** A clean week is 5 workouts. Flat for everyone, every week. */
const WORKOUTS_PER_WEEK = 5;

/** The ladder sets what a miss costs. Everyone starts at level 1. */
const FINE_BY_LEVEL = { 1: 500, 2: 1000, 3: 2000 };

/** Misses at one price before it rises; clean weeks in a row before it falls. */
const WEEKS_TO_MOVE = 3;

const MAX_SKIP_TOKENS = 3;
const MAX_CONSECUTIVE_TOKENS = 2;

/** Hours a fine may go unpaid before the player is suspended. */
const PAYMENT_GRACE_HOURS = 48;

/** Fines accumulated while suspended before elimination. */
const FINES_TO_ELIMINATE = 2;


const countWorkouts = (userId, workoutDays, week) =>
  workoutDays.filter((w) => w.userId === userId && w.week === week && w.isCompleted).length;

/**
 * Replay the season and derive everything from it.
 *
 * Order inside a week matters and mirrors the rules: a balance carried into a new
 * week is a balance past its 48 hours, so suspension is judged at the start of the
 * week, not the moment the fine lands.
 */
const runSeason = ({
  userId,
  workoutDays,
  skipWeeks = [],
  settledWeeks = [],
  completedWeeks,
}) => {
  let priceLevel = 1;
  let cleanStreak = 0;
  let missesAtLevel = 0;
  let cleanWeeks = 0;
  let missedWeeks = 0;
  let tokensUsed = 0;
  let billed = 0;
  let paid = 0;
  let outstanding = 0;
  let outstandingSince = null;
  let finesWhileSuspended = 0;
  let standing = 'active';
  let suspendedAtWeek = null;
  let outAtWeek = null;

  const weeks = [];

  // Elimination breaks out of the loop below, so nothing after it is ever replayed:
  // out is out, and the rest of the season doesn't happen.
  for (let week = 1; week <= completedWeeks; week++) {
    // A balance that survived into this week has outlived its grace period.
    if (outstanding > 0 && standing === 'active' && outstandingSince !== null && outstandingSince < week) {
      standing = 'suspended';
      suspendedAtWeek = week;
    }

    const workouts = countWorkouts(userId, workoutDays, week);
    const isClean = workouts >= WORKOUTS_PER_WEEK;
    const isSkipped = skipWeeks.includes(week);

    if (isSkipped && !isClean) {
      // A token cancels the fine and leaves the ladder untouched: neither a
      // clean week nor a missed one.
      tokensUsed++;
      weeks.push({ week, outcome: 'skipped', workouts, priceLevel, fine: 0 });
    } else if (isClean) {
      cleanWeeks++;
      cleanStreak++;
      weeks.push({ week, outcome: 'clean', workouts, priceLevel, fine: 0 });
      if (cleanStreak === WEEKS_TO_MOVE && priceLevel > 1) {
        priceLevel = priceLevel - 1;
        cleanStreak = 0;
        missesAtLevel = 0;
      }
    } else {
      const fine = FINE_BY_LEVEL[priceLevel];
      missedWeeks++;
      billed += fine;
      if (outstanding === 0) outstandingSince = week;
      outstanding += fine;
      weeks.push({ week, outcome: 'missed', workouts, priceLevel, fine });

      if (standing === 'suspended') {
        finesWhileSuspended++;
        if (finesWhileSuspended >= FINES_TO_ELIMINATE) {
          standing = 'out';
          outAtWeek = week;
        }
      }

      cleanStreak = 0;
      missesAtLevel++;
      if (missesAtLevel === WEEKS_TO_MOVE && priceLevel < 3) {
        priceLevel = priceLevel + 1;
        missesAtLevel = 0;
      }
    }

    if (standing === 'out') break;

    // Settling inside the week clears the balance and lifts a suspension.
    if (settledWeeks.includes(week) && outstanding > 0) {
      paid += outstanding;
      outstanding = 0;
      outstandingSince = null;
      if (standing === 'suspended') {
        standing = 'active';
        suspendedAtWeek = null;
        finesWhileSuspended = 0;
      }
    }
  }

  return {
    weeks,
    priceLevel,
    cleanWeeks,
    missedWeeks,
    cleanStreak,
    missesAtLevel,
    tokensUsed,
    billed,
    paid,
    outstanding,
    standing,
    suspendedAtWeek,
    outAtWeek,
    potEligible: standing !== 'out' && outstanding === 0,
  };
};

/** What a miss costs this player right now. */
const currentFine = (state) => FINE_BY_LEVEL[state.priceLevel];

/**
 * Why a skip token can't be used this week, or null when it can.
 * Rule 09: three a season, never three in a row, dead in the final two weeks.
 */
const skipTokenBlocker = (week, seasonWeeks, usedWeeks) => {
  if (usedWeeks.length >= MAX_SKIP_TOKENS) return 'All 3 skip tokens used';
  if (week > seasonWeeks - 2) return 'Not usable in the final two weeks';

  let consecutive = 0;
  for (let w = week - 1; w >= 1 && usedWeeks.includes(w); w--) consecutive++;
  if (consecutive >= MAX_CONSECUTIVE_TOKENS) return 'Never three in a row';

  return null;
};

/**
 * Fines the app should be telling this player about: unsettled, newest first.
 * The app posts these — nobody has to notice a missed week by hand.
 */
const unpaidFines = (state, settledWeeks = []) =>
  state.weeks
    .filter((w) => w.fine > 0 && !settledWeeks.includes(w.week))
    .sort((a, b) => b.week - a.week);


/**
 * Rule 01: a goal must be physical output, measured by a number, and provable.
 *
 * The group still approves every goal at Week 0 — this only catches the three
 * things the rules say outright, so nobody has to argue them one at a time.
 * Returns null when the goal is eligible.
 */
const INTAKE_WORDS = [
  "eat", "eating", "diet", "calorie", "calories", "macro", "macros", "protein shake",
  "sleep", "sleeping", "hydrate", "hydration", "water intake", "supplement", "fast",
  "fasting", "meal", "meals", "sugar", "alcohol", "smoking", "quit",
];
const BODYWEIGHT_WORDS = [
  "bodyweight", "body weight", "lose weight", "weight loss", "body fat", "bodyfat",
  "bmi", "waist", "slim down", "lean down", "cut to",
];
// "Lose 5kg" and friends name a weight, not a training output.
const BODYWEIGHT_PATTERNS = [
  /\b(lose|drop|shed|cut)\s+\d+\s*(kg|kgs|kilo|kilos|lb|lbs|pounds|%)/,
  /\bweigh\s+\d+/,
  /\bget\s+(down\s+)?to\s+\d+\s*(kg|kgs|lb|lbs|pounds)/,
];

const goalEligibilityError = (description, target) => {
  const text = String(description || "").toLowerCase().trim();
  if (!text) return "Say what the goal is";

  // Bodyweight is a state, not an output, and it's personal rather than group business.
  const bodyweight =
    BODYWEIGHT_WORDS.find((w) => text.includes(w)) ||
    BODYWEIGHT_PATTERNS.find((re) => re.test(text));
  if (bodyweight) {
    return "Bodyweight isn't a goal — it's a state, not an output. Set the training that gets you there.";
  }

  // Training, not intake.
  const intake = INTAKE_WORDS.find((w) => new RegExp(`\\b${w}\\b`).test(text));
  if (intake) {
    return `"${intake}" is something you consume, not something you do. Goals are training.`;
  }

  // Measured by a number: the target carries it, or the description does.
  const hasNumber = /\d/.test(String(target || "")) || /\d/.test(text);
  if (!hasNumber) {
    return "Give it a number — reps, kg, minutes, sessions, distance or time.";
  }

  return null;
};

/**
 * Goal points must total exactly 6 across 2 to 6 goals (Rule 02).
 * Returns null when the split is legal.
 */
const goalSplitError = (points) => {
  const total = points.reduce((sum, p) => sum + p, 0);
  if (points.some((p) => p < 1 || p > 3)) return 'Every goal is worth 1, 2 or 3 points';
  if (points.length < 2) return 'At least 2 goals';
  if (points.length > 6) return 'At most 6 goals';
  if (total !== 6) return total < 6 ? `${6 - total} points still to spend` : `${total - 6} points over`;
  return null;
};

module.exports = {
  WORKOUTS_PER_WEEK,
  FINE_BY_LEVEL,
  WEEKS_TO_MOVE,
  MAX_SKIP_TOKENS,
  MAX_CONSECUTIVE_TOKENS,
  PAYMENT_GRACE_HOURS,
  FINES_TO_ELIMINATE,
  runSeason,
  currentFine,
  skipTokenBlocker,
  unpaidFines,
  goalSplitError,
  goalEligibilityError,
};
