import { DAY_MS, type Call } from './types';

export const WELCOME_AFTER_MS = 14 * DAY_MS;
// A call has to travel a little before it reaches you — the relay is always across time.
export const MIN_AGE_MS = 12 * 60 * 60 * 1000;

// Past You waits until you touch the glass. Only the newest unheard call is waiting.
export function waiting(calls: Call[], now: number): Call | null {
  const unheard = calls
    .filter((c) => !c.heard && now - c.createdAt >= MIN_AGE_MS)
    .sort((a, b) => b.createdAt - a.createdAt);
  return unheard[0] ?? null;
}

export const isWelcomeBack = (lastOpenedAt: number | null, now: number) =>
  lastOpenedAt !== null && now - lastOpenedAt >= WELCOME_AFTER_MS;

// Keep the newest `keep` videos (plus anything pinned). Older ones fade to just their word.
export function callsToFade(calls: Call[], keep: number): Call[] {
  const withVideo = calls
    .filter((c) => c.videoUri && !c.pinned)
    .sort((a, b) => b.createdAt - a.createdAt);
  return withVideo.slice(keep);
}
