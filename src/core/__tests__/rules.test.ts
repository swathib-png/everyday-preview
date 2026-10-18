import { pickDoor, markNotToday, markTried, DOOR_LIFETIME_MS } from '../doors';
import { depthFor, WORD_MS, LINE_MS, ALL_MS } from '../hold';
import { consecutiveSkips, isDue, record, shouldShowSkipCard } from '../meds';
import { callsToFade, isWelcomeBack, waiting } from '../waitingRoom';
import { DAY_MS, type Call, type Door } from '../types';

const now = new Date(2026, 9, 17, 21, 0).getTime();
const door = (id: string, ageDays: number, patch: Partial<Door> = {}): Door => ({
  id,
  createdAt: now - ageDays * DAY_MS,
  note: ['M0 0 L10 10'],
  status: 'open',
  notTodayCount: 0,
  ...patch,
});

describe('hold depth', () => {
  it('maps hold time to word, line, all', () => {
    expect(depthFor(WORD_MS - 1)).toBe(0);
    expect(depthFor(WORD_MS)).toBe(1);
    expect(depthFor(LINE_MS)).toBe(2);
    expect(depthFor(ALL_MS + 5000)).toBe(3);
  });
});

describe('door picker', () => {
  it('shows the oldest open note', () => {
    expect(pickDoor([door('new', 1), door('old', 5)], now)?.id).toBe('old');
  });

  it('shows at most one door a day', () => {
    const doors = markTried([door('a', 2), door('b', 3)], 'b', now);
    expect(pickDoor(doors, now)).toBeNull();
  });

  it('rests a note for a week after three not-todays', () => {
    let doors = [door('a', 3)];
    for (let i = 0; i < 3; i++) doors = markNotToday(doors, 'a', now - (3 - i) * DAY_MS);
    expect(pickDoor(doors, now)).toBeNull();
    expect(pickDoor(doors, now + 8 * DAY_MS)?.id).toBe('a'); // the week of rest is over
  });

  it('lets notes fade after 14 days', () => {
    expect(pickDoor([door('a', DOOR_LIFETIME_MS / DAY_MS + 1)], now)).toBeNull();
  });
});

describe('meds rhythm', () => {
  const nine = { hour: 21, minute: 0 };
  it('is due once, inside the window', () => {
    expect(isDue(nine, [], now)).toBe(true);
    expect(isDue(nine, record([], now, 'taken'), now)).toBe(false);
    expect(isDue(nine, [], now - 60_000)).toBe(false);
    expect(isDue(null, [], now)).toBe(false);
  });

  it('shows the skip card once after three skips in a row', () => {
    let log = record([], now - 2 * DAY_MS, 'skipped');
    log = record(log, now - DAY_MS, 'skipped');
    log = record(log, now, 'skipped');
    expect(consecutiveSkips(log)).toBe(3);
    expect(shouldShowSkipCard(log, false)).toBe(true);
    expect(shouldShowSkipCard(log, true)).toBe(false);
  });
});

describe('waiting room', () => {
  const call = (id: string, ageDays: number, patch: Partial<Call> = {}): Call => ({
    id,
    createdAt: now - ageDays * DAY_MS,
    videoUri: `file:///${id}.mov`,
    word: [],
    heard: false,
    ...patch,
  });

  it('only the newest unheard call is waiting', () => {
    expect(waiting([call('a', 4), call('b', 2), call('c', 1, { heard: true })], now)?.id).toBe('b');
  });

  it('a call you just left does not reach you right away', () => {
    expect(waiting([call('fresh', 0.1)], now)).toBeNull();
  });

  it('welcomes you back after 14 days away', () => {
    expect(isWelcomeBack(now - 15 * DAY_MS, now)).toBe(true);
    expect(isWelcomeBack(now - 2 * DAY_MS, now)).toBe(false);
    expect(isWelcomeBack(null, now)).toBe(false);
  });

  it('fades older videos but keeps pinned ones', () => {
    const calls = [call('a', 1), call('b', 2), call('c', 3, { pinned: true }), call('d', 4)];
    expect(callsToFade(calls, 2).map((c) => c.id)).toEqual(['d']);
  });
});
