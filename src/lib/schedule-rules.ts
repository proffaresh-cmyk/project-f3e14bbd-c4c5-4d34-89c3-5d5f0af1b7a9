// Pure scheduling rules shared by the cron tick and tests.
import { timeToMinutes } from "./time";

/** True when `minutes` falls inside the quiet window [sleep, wake), which may wrap midnight. */
export function inSleepHours(minutes: number, sleepTime: string, wakeTime: string): boolean {
  const sleep = timeToMinutes(sleepTime);
  const wake = timeToMinutes(wakeTime);
  if (sleep === wake) return false;
  if (sleep > wake) return minutes >= sleep || minutes < wake;
  return minutes >= sleep && minutes < wake;
}

/** How late (minutes) a scheduled reminder may still fire, e.g. after a missed tick. */
export const CATCH_UP_MINUTES = 20;

export type ReminderLike = {
  remind_time: string;
  days: number[];
  active: boolean;
  last_sent_date: string | null;
  kind: string;
};

/** Should a recurring reminder send its first message today? Never twice on the same day. */
export function shouldFireReminder(
  r: ReminderLike,
  now: { date: string; minutes: number; dow: number },
  sleep: { sleepTime: string; wakeTime: string },
): boolean {
  if (!r.active) return false;
  if (!r.days.includes(now.dow)) return false;
  if (r.last_sent_date === now.date) return false;
  const at = timeToMinutes(r.remind_time);
  const late = now.minutes - at;
  if (late < 0 || late > CATCH_UP_MINUTES) return false;
  if (r.kind !== "morning" && inSleepHours(now.minutes, sleep.sleepTime, sleep.wakeTime)) return false;
  return true;
}

/** Next moment a pending (not yet done) item should be re-sent. */
export function nextNagAt(
  lastSentAt: string | null,
  snoozedUntil: string | null,
  nagIntervalMin: number,
): Date | null {
  if (snoozedUntil) return new Date(snoozedUntil);
  if (!lastSentAt) return null;
  return new Date(new Date(lastSentAt).getTime() + nagIntervalMin * 60_000);
}

export function isNagDue(
  lastSentAt: string | null,
  snoozedUntil: string | null,
  nagIntervalMin: number,
  now: Date,
): boolean {
  const next = nextNagAt(lastSentAt, snoozedUntil, nagIntervalMin);
  return next !== null && now.getTime() >= next.getTime();
}
