// Handwriting is stored as SVG path data, one entry per finger stroke — never as text.
export type Stroke = string;

export interface Call {
  id: string;
  createdAt: number;
  videoUri: string | null; // null once the video has faded to save space
  word: Stroke[]; // the one word, in their own hand
  heard: boolean;
  pinned?: boolean;
}

export type DoorStatus = 'open' | 'tried' | 'expired';

export interface Door {
  id: string;
  createdAt: number;
  note: Stroke[]; // "a note for later", in their own hand
  status: DoorStatus;
  notTodayCount: number;
  lastNotTodayAt?: number;
  lastActionAt?: number;
}

export type MedsStatus = 'taken' | 'skipped' | 'unknown';

export interface MedsEntry {
  day: string; // YYYY-MM-DD, local
  status: MedsStatus;
}

export type ReminderLevel = 'glow' | 'whisper' | 'nudge';

export interface Settings {
  reminder: ReminderLevel;
  selfView: boolean;
  medsTime: { hour: number; minute: number } | null;
  keepCalls: number;
}

export interface SafetyPlan {
  personName: string;
  personPhone: string;
  lines: [string, string, string];
}

export interface EverydayData {
  version: 1;
  onboarded: boolean;
  lastOpenedAt: number | null;
  calls: Call[];
  doors: Door[];
  meds: MedsEntry[];
  skipCardShown: boolean;
  settings: Settings;
}

export const emptyData = (): EverydayData => ({
  version: 1,
  onboarded: false,
  lastOpenedAt: null,
  calls: [],
  doors: [],
  meds: [],
  skipCardShown: false,
  settings: { reminder: 'whisper', selfView: false, medsTime: null, keepCalls: 10 },
});

export const DAY_MS = 24 * 60 * 60 * 1000;

export const dayKey = (ts: number) => {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
