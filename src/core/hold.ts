import type { Depth } from './machine';

// How long you hold decides how much of Past You you hear.
export const HOLD_START_MS = 250; // shorter than this is a tap, not a hold
export const WORD_MS = 1500;
export const LINE_MS = 4000;
export const ALL_MS = 8000;
export const LINE_CLIP_SECONDS = 10;

export function depthFor(heldMs: number): Depth {
  if (heldMs >= ALL_MS) return 3;
  if (heldMs >= LINE_MS) return 2;
  if (heldMs >= WORD_MS) return 1;
  return 0;
}

// The clearing under your thumb grows quickly at first, then settles —
// like frost melting, never linear.
export function clearRadius(heldMs: number, minR: number, maxR: number): number {
  const t = Math.min(1, heldMs / ALL_MS);
  const eased = 1 - Math.pow(1 - t, 3);
  return minR + (maxR - minR) * eased;
}
