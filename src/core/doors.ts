import { DAY_MS, dayKey, type Door } from './types';

// Doors are only ever your own handwritten notes. Three rules decide which one shows:
// 1. You wrote it (nothing is generated for you).
// 2. One door a day, at most. If one was already answered today, none.
// 3. Three "not today"s on a note rests it for a week. Notes fade after 14 days.

export const DOOR_LIFETIME_MS = 14 * DAY_MS;
export const REST_AFTER_NOT_TODAYS = 3;
export const REST_MS = 7 * DAY_MS;

export function expireDoors(doors: Door[], now: number): Door[] {
  return doors.map((d): Door =>
    d.status === 'open' && now - d.createdAt > DOOR_LIFETIME_MS ? { ...d, status: 'expired' } : d,
  );
}

const resting = (d: Door, now: number) =>
  d.notTodayCount >= REST_AFTER_NOT_TODAYS &&
  d.lastNotTodayAt !== undefined &&
  now - d.lastNotTodayAt < REST_MS;

const answeredToday = (d: Door, now: number) =>
  d.lastActionAt !== undefined && dayKey(d.lastActionAt) === dayKey(now);

export function pickDoor(doors: Door[], now: number): Door | null {
  if (doors.some((d) => answeredToday(d, now))) return null;
  const eligible = expireDoors(doors, now)
    .filter((d) => d.status === 'open' && !resting(d, now))
    .sort((a, b) => a.createdAt - b.createdAt);
  return eligible[0] ?? null;
}

export function markTried(doors: Door[], id: string, now: number): Door[] {
  return doors.map((d): Door => (d.id === id ? { ...d, status: 'tried', lastActionAt: now } : d));
}

export function markNotToday(doors: Door[], id: string, now: number): Door[] {
  return doors.map((d): Door =>
    d.id === id
      ? { ...d, notTodayCount: d.notTodayCount + 1, lastNotTodayAt: now, lastActionAt: now }
      : d,
  );
}
