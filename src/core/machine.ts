// The whole app is one pane of glass in one of these states.
// Gestures and timers send events; this reducer decides where the pane goes.
// Pure and synchronous, so it is easy to test.

export type Mode =
  | 'first' // the first minute: learn by touching
  | 'rest' // light behind frost, nothing to do
  | 'hold' // holding the glass, hearing Past You
  | 'turn' // your turn: just talk
  | 'write' // trace a word (and maybe a note for later)
  | 'sent' // a glow drifts up; it'll wait
  | 'note' // one of your own notes is on the glass
  | 'taps' // meds: the phone tapped twice
  | 'cover' // palm over the glass: help
  | 'back' // the back of the glass: five settings
  | 'welcome'; // 14+ days away

export type Depth = 0 | 1 | 2 | 3; // touch, word, line, all

export interface PaneState {
  mode: Mode;
  depth: Depth;
  // Where to return when an overlay (cover, back) closes.
  underlying: Mode;
}

export type PaneEvent =
  | { type: 'BOOT'; onboarded: boolean; welcome: boolean }
  | { type: 'FIRST_DONE' }
  | { type: 'HOLD_START' }
  | { type: 'HOLD_DEPTH'; depth: Depth }
  | { type: 'HOLD_END'; hasPast: boolean }
  | { type: 'TURN_DONE' }
  | { type: 'TURN_CANCEL' }
  | { type: 'SEND' }
  | { type: 'SENT_SETTLED' }
  | { type: 'NOTE_SHOW' }
  | { type: 'NOTE_DONE' }
  | { type: 'TAPS_DUE' }
  | { type: 'TAPS_DONE' }
  | { type: 'COVER' }
  | { type: 'UNCOVER' }
  | { type: 'PULL_DOWN' }
  | { type: 'CLOSE_BACK' }
  | { type: 'WELCOME_FRESH' };

export const initialPane: PaneState = { mode: 'rest', depth: 0, underlying: 'rest' };

// Modes that can't survive an interruption: a cover or close drops back to rest.
const fragile: Mode[] = ['hold', 'turn', 'write', 'sent'];

const to = (s: PaneState, mode: Mode, patch: Partial<PaneState> = {}): PaneState => ({
  ...s,
  mode,
  depth: 0,
  ...patch,
});

export function paneReducer(s: PaneState, e: PaneEvent): PaneState {
  // Help is reachable from everywhere, always.
  if (e.type === 'COVER') {
    if (s.mode === 'cover') return s;
    return to(s, 'cover', { underlying: fragile.includes(s.mode) ? 'rest' : s.mode });
  }

  switch (s.mode) {
    case 'first':
      if (e.type === 'FIRST_DONE') return to(s, 'rest');
      break;

    case 'rest':
      if (e.type === 'BOOT') return boot(s, e);
      if (e.type === 'HOLD_START') return to(s, 'hold');
      if (e.type === 'NOTE_SHOW') return to(s, 'note');
      if (e.type === 'TAPS_DUE') return to(s, 'taps');
      if (e.type === 'PULL_DOWN') return to(s, 'back', { underlying: 'rest' });
      break;

    case 'welcome':
      if (e.type === 'HOLD_START') return to(s, 'hold');
      if (e.type === 'WELCOME_FRESH') return to(s, 'rest');
      break;

    case 'hold':
      if (e.type === 'HOLD_DEPTH') return { ...s, depth: Math.max(s.depth, e.depth) as typeof s.depth };
      if (e.type === 'HOLD_END') {
        // Let go before hearing anything from Past You? That's a change of mind — back to rest.
        // With nobody waiting, holding is how you pick up: straight to your turn.
        if (e.hasPast && s.depth === 0) return to(s, 'rest');
        return to(s, 'turn');
      }
      break;

    case 'turn':
      if (e.type === 'TURN_DONE') return to(s, 'write');
      if (e.type === 'TURN_CANCEL') return to(s, 'rest');
      if (e.type === 'SEND') return to(s, 'sent');
      break;

    case 'write':
      if (e.type === 'SEND') return to(s, 'sent');
      break;

    case 'sent':
      if (e.type === 'SENT_SETTLED') return to(s, 'rest');
      break;

    case 'note':
      if (e.type === 'NOTE_DONE') return to(s, 'rest');
      if (e.type === 'HOLD_START') return to(s, 'hold');
      break;

    case 'taps':
      if (e.type === 'TAPS_DONE') return to(s, 'rest');
      break;

    case 'cover':
      // Reset `underlying` so an overlay we return to (e.g. settings) can close normally.
      if (e.type === 'UNCOVER') return to(s, s.underlying, { underlying: 'rest' });
      break;

    case 'back':
      // The back of the glass is only reachable from rest.
      if (e.type === 'CLOSE_BACK') return to(s, 'rest', { underlying: 'rest' });
      break;
  }
  if (e.type === 'BOOT') return boot(s, e);
  return s;
}

function boot(s: PaneState, e: Extract<PaneEvent, { type: 'BOOT' }>): PaneState {
  if (!e.onboarded) return to(s, 'first');
  if (e.welcome) return to(s, 'welcome');
  return to(s, 'rest');
}
