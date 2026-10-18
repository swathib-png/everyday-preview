import { dayKey, type MedsEntry, type MedsStatus, type Settings } from './types';

// Two taps at dose time, once. No answer is logged as unknown, never nagged.
export const DUE_WINDOW_MS = 3 * 60 * 60 * 1000;
export const SKIP_CARD_AFTER = 3;

export function isDue(medsTime: Settings['medsTime'], log: MedsEntry[], now: number): boolean {
  if (!medsTime) return false;
  const today = dayKey(now);
  if (log.some((e) => e.day === today)) return false;
  const dose = new Date(now);
  dose.setHours(medsTime.hour, medsTime.minute, 0, 0);
  const since = now - dose.getTime();
  return since >= 0 && since <= DUE_WINDOW_MS;
}

export function record(log: MedsEntry[], now: number, status: MedsStatus): MedsEntry[] {
  const day = dayKey(now);
  return [...log.filter((e) => e.day !== day), { day, status }].sort((a, b) =>
    a.day.localeCompare(b.day),
  );
}

export function consecutiveSkips(log: MedsEntry[]): number {
  let n = 0;
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].status !== 'skipped') break;
    n++;
  }
  return n;
}

// The one card: shown once, ever, after three skips in a row. Wording needs clinician sign-off.
export const shouldShowSkipCard = (log: MedsEntry[], alreadyShown: boolean) =>
  !alreadyShown && consecutiveSkips(log) >= SKIP_CARD_AFTER;
