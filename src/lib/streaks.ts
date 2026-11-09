import { addDays, dowOf } from "./time";

/** Consecutive days with a log, ending today (or yesterday if today isn't logged yet). */
export function dailyStreak(logDates: string[], today: string): number {
  const set = new Set(logDates);
  let cursor = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(cursor)) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

/** Weeks start on Sunday. */
export function weekStart(date: string): string {
  return addDays(date, -dowOf(date));
}

/** Consecutive weeks with at least one log, ending this week (or last week). */
export function weeklyStreak(logDates: string[], today: string): number {
  const weeks = new Set(logDates.map(weekStart));
  let cursor = weekStart(today);
  if (!weeks.has(cursor)) cursor = addDays(cursor, -7);
  let n = 0;
  while (weeks.has(cursor)) {
    n++;
    cursor = addDays(cursor, -7);
  }
  return n;
}

export function streakFor(frequency: string, logDates: string[], today: string): number {
  return frequency === "weekly" ? weeklyStreak(logDates, today) : dailyStreak(logDates, today);
}
