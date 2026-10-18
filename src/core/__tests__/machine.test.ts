import { initialPane, paneReducer, type PaneEvent, type PaneState } from '../machine';

const run = (events: PaneEvent[], start: PaneState = initialPane) => events.reduce(paneReducer, start);

describe('paneReducer', () => {
  it('boots into the first minute until onboarded', () => {
    expect(run([{ type: 'BOOT', onboarded: false, welcome: false }]).mode).toBe('first');
    expect(run([{ type: 'BOOT', onboarded: true, welcome: true }]).mode).toBe('welcome');
    expect(run([{ type: 'BOOT', onboarded: true, welcome: false }]).mode).toBe('rest');
  });

  it('runs the whole call: hold → turn → write → sent → rest', () => {
    const s = run([
      { type: 'HOLD_START' },
      { type: 'HOLD_DEPTH', depth: 2 },
      { type: 'HOLD_END', hasPast: true },
      { type: 'TURN_DONE' },
      { type: 'SEND' },
    ]);
    expect(s.mode).toBe('sent');
    expect(run([{ type: 'SENT_SETTLED' }], s).mode).toBe('rest');
  });

  it('treats letting go before the first word as a change of mind', () => {
    const s = run([{ type: 'HOLD_START' }, { type: 'HOLD_END', hasPast: true }]);
    expect(s.mode).toBe('rest');
  });

  it('goes straight to your turn when nobody is waiting', () => {
    const s = run([{ type: 'HOLD_START' }, { type: 'HOLD_END', hasPast: false }]);
    expect(s.mode).toBe('turn');
  });

  it('never lowers the depth while holding', () => {
    const s = run([
      { type: 'HOLD_START' },
      { type: 'HOLD_DEPTH', depth: 2 },
      { type: 'HOLD_DEPTH', depth: 1 },
    ]);
    expect(s.depth).toBe(2);
  });

  it('opens help from any state and returns safely', () => {
    const midCall = run([{ type: 'HOLD_START' }, { type: 'HOLD_END', hasPast: false }]);
    const covered = paneReducer(midCall, { type: 'COVER' });
    expect(covered.mode).toBe('cover');
    expect(paneReducer(covered, { type: 'UNCOVER' }).mode).toBe('rest');

    const note = run([{ type: 'NOTE_SHOW' }, { type: 'COVER' }, { type: 'UNCOVER' }]);
    expect(note.mode).toBe('note');
  });

  it('can still close settings after opening help from them', () => {
    const s = run([{ type: 'PULL_DOWN' }, { type: 'COVER' }, { type: 'UNCOVER' }]);
    expect(s.mode).toBe('back');
    expect(paneReducer(s, { type: 'CLOSE_BACK' }).mode).toBe('rest');
  });

  it('ignores events that do not belong to the current state', () => {
    expect(run([{ type: 'SEND' }]).mode).toBe('rest');
    expect(run([{ type: 'TURN_DONE' }]).mode).toBe('rest');
  });
});
