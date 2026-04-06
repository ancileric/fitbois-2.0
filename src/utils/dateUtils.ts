export const CHALLENGE_START_DATE = '2026-01-19';
export const CHALLENGE_END_DATE = '2026-07-31';

// IST offset: UTC+5:30 (5.5 hours = 330 minutes)
const IST_OFFSET_MINUTES = 330;

/**
 * Parse a date string (YYYY-MM-DD) and return Date object at IST midnight
 */
const parseISTDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  // Create date at UTC, then adjust for IST
  // IST midnight = UTC previous day 18:30
  const utcDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  // Subtract IST offset to get the correct UTC time for IST midnight
  utcDate.setMinutes(utcDate.getMinutes() - IST_OFFSET_MINUTES);
  return utcDate;
};

/**
 * Get current date/time in IST
 */
const getCurrentISTDate = (): Date => {
  const now = new Date();
  // Convert current UTC time to IST by adding the offset
  const istTime = new Date(now.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
  return istTime;
};

/**
 * Get IST midnight for current date
 */
const getISTMidnight = (): Date => {
  const istNow = getCurrentISTDate();
  // Get year, month, day in IST
  const year = istNow.getUTCFullYear();
  const month = istNow.getUTCMonth();
  const day = istNow.getUTCDate();
  // Create midnight in IST (represented in UTC)
  return new Date(Date.UTC(year, month, day, 0, 0, 0) - IST_OFFSET_MINUTES * 60 * 1000);
};

export const getCurrentWeek = (startDate: string = CHALLENGE_START_DATE): number => {
  const startIST = parseISTDate(startDate);
  const nowIST = getISTMidnight();

  const timeDiff = nowIST.getTime() - startIST.getTime();
  const daysDiff = Math.floor(timeDiff / (24 * 60 * 60 * 1000));

  if (daysDiff < 0) {
    // Challenge hasn't started yet
    return 0;
  } else {
    // Challenge is active - calculate which week we're in
    return Math.floor(daysDiff / 7) + 1;
  }
};

export const getDaysUntilStart = (startDate: string = CHALLENGE_START_DATE): number => {
  const startIST = parseISTDate(startDate);
  const nowIST = getISTMidnight();

  const timeDiff = startIST.getTime() - nowIST.getTime();
  return Math.ceil(timeDiff / (24 * 60 * 60 * 1000));
};

export const getDaysSinceStart = (startDate: string = CHALLENGE_START_DATE): number => {
  const startIST = parseISTDate(startDate);
  const nowIST = getISTMidnight();

  const timeDiff = nowIST.getTime() - startIST.getTime();
  return Math.max(0, Math.ceil(timeDiff / (24 * 60 * 60 * 1000)));
};

export const getTotalChallengeDays = (
  startDate: string = CHALLENGE_START_DATE,
  endDate: string = CHALLENGE_END_DATE
): number => {
  const startIST = parseISTDate(startDate);
  const endIST = parseISTDate(endDate);

  return Math.ceil((endIST.getTime() - startIST.getTime()) / (24 * 60 * 60 * 1000));
};

export const getChallengeProgress = (
  startDate: string = CHALLENGE_START_DATE,
  endDate: string = CHALLENGE_END_DATE
): { daysPassed: number; totalDays: number; progressPercentage: number } => {
  const totalDays = getTotalChallengeDays(startDate, endDate);
  const daysPassed = getDaysSinceStart(startDate);
  const progressPercentage = Math.min(100, Math.max(0, (daysPassed / totalDays) * 100));

  return { daysPassed, totalDays, progressPercentage };
};

/**
 * Get the 7 dates (Mon–Sun) for a given challenge week number.
 * Returns Date objects representing each day in IST.
 */
export const getWeekDates = (challengeStartDate: string = CHALLENGE_START_DATE, weekNumber: number): Date[] => {
  const monday = parseISTDate(challengeStartDate);
  monday.setDate(monday.getDate() + (weekNumber - 1) * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getTime());
    d.setDate(d.getDate() + i);
    return d;
  });
};

/**
 * Format a Date to "Apr 6" style label (uses UTC fields since dates are stored at IST midnight in UTC)
 */
export const formatDayLabel = (date: Date): string => {
  const istDate = new Date(date.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
  const month = istDate.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const day = istDate.getUTCDate();
  return `${month} ${day}`;
};

/**
 * Format a date to YYYY-MM-DD in IST
 */
export const formatISTDate = (date: Date): string => {
  const istDate = new Date(date.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};