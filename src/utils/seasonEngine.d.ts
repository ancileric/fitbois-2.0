import { WorkoutDay } from '../types';

/**
 * Types for the shared season engine (seasonEngine.js).
 *
 * The implementation is CommonJS because the Express server requires the very
 * same file — one set of rules, no drift between UI and API.
 */

export type PriceLevel = 1 | 2 | 3;
export type Standing = 'active' | 'suspended' | 'out';
export type WeekOutcome = 'clean' | 'missed' | 'skipped';

export interface WeekResult {
  week: number;
  outcome: WeekOutcome;
  workouts: number;
  /** The price level this week was judged at. */
  priceLevel: PriceLevel;
  /** Amount fined for this week, 0 when clean or covered by a token. */
  fine: number;
}

export interface SeasonState {
  weeks: WeekResult[];
  priceLevel: PriceLevel;
  cleanWeeks: number;
  missedWeeks: number;
  /** Clean weeks in a row right now, toward dropping a price level. */
  cleanStreak: number;
  /** Misses at the current price, toward raising it. */
  missesAtLevel: number;
  tokensUsed: number;
  /** Total fined across the season, settled or not. */
  billed: number;
  /** Settled so far. */
  paid: number;
  /** Owed right now. */
  outstanding: number;
  standing: Standing;
  suspendedAtWeek: number | null;
  outAtWeek: number | null;
  /** Rule 11: still standing with nothing owed. */
  potEligible: boolean;
}

export interface SeasonInput {
  userId: string;
  workoutDays: WorkoutDay[];
  /** Weeks covered by an approved skip token. */
  skipWeeks?: number[];
  /** Weeks whose fine has been settled. */
  settledWeeks?: number[];
  /** Weeks completed so far; the in-progress week is not judged. */
  completedWeeks: number;
}

/** A clean week is 5 workouts. Flat for everyone, every week. */
export const WORKOUTS_PER_WEEK: 5;
/** The ladder sets what a miss costs. Everyone starts at level 1. */
export const FINE_BY_LEVEL: Record<PriceLevel, number>;
/** Misses at one price before it rises; clean weeks in a row before it falls. */
export const WEEKS_TO_MOVE: 3;
export const MAX_SKIP_TOKENS: 3;
export const MAX_CONSECUTIVE_TOKENS: 2;
/** Hours a fine may go unpaid before the player is suspended. */
export const PAYMENT_GRACE_HOURS: 48;
/** Fines accumulated while suspended before elimination. */
export const FINES_TO_ELIMINATE: 2;

export function runSeason(input: SeasonInput): SeasonState;
export function currentFine(state: SeasonState): number;
export function skipTokenBlocker(week: number, seasonWeeks: number, usedWeeks: number[]): string | null;
export function unpaidFines(state: SeasonState, settledWeeks?: number[]): WeekResult[];
export function goalSplitError(points: number[]): string | null;
/** Rule 01: physical output, measured by a number, provable. Null when eligible. */
export function goalEligibilityError(description: string, target?: string): string | null;
