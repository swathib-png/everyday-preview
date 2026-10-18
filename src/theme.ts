// One sunset sky. Every colour in the app comes from here.
export const sky = {
  paper: '#F3EEEA',
  ink: '#2B2633',
  inkSoft: '#7B7286',
  night: '#1E1A2B',
  gold: '#FBD7A3',
  peach: '#F6B08F',
  blush: '#EE9AA2',
  mauve: '#B79BC9',
  dusk: '#6E5A9A',
  coral: '#D9787E',
  skin: '#F7C6B0',
  white: '#FFFFFF',
} as const;

export type Light = 'peach' | 'gold' | 'mauve' | 'blush' | 'none';

// A light field is three or four soft blobs behind the frost.
// x / y / r are fractions of the screen so it scales to any phone.
export type Blob = { x: number; y: number; r: number; color: string; opacity: number };

export const fields: Record<'day' | 'night' | 'help', Blob[]> = {
  day: [
    { x: 0.1, y: 0.18, r: 0.45, color: sky.mauve, opacity: 0.5 },
    { x: 0.85, y: 0.65, r: 0.42, color: sky.gold, opacity: 0.6 },
    { x: 0.2, y: 0.85, r: 0.36, color: sky.blush, opacity: 0.45 },
  ],
  night: [
    { x: 0.05, y: 0.12, r: 0.42, color: sky.dusk, opacity: 0.55 },
    { x: 0.9, y: 0.78, r: 0.4, color: sky.coral, opacity: 0.45 },
  ],
  help: [
    { x: 0.3, y: 0.3, r: 0.55, color: sky.blush, opacity: 0.85 },
    { x: 0.75, y: 0.7, r: 0.45, color: sky.peach, opacity: 0.65 },
    { x: 0.1, y: 0.85, r: 0.35, color: sky.mauve, opacity: 0.45 },
  ],
};

// The one light that carries meaning, drawn on top of the field.
export const lightColor: Record<Light, string | null> = {
  peach: sky.peach,
  gold: sky.gold,
  mauve: sky.mauve,
  blush: sky.blush,
  none: null,
};

export const typeScale = {
  // The app whispers: lowercase, few words, never more than four at once.
  whisper: { fontSize: 18, fontWeight: '300' as const, letterSpacing: -0.2 },
  word: { fontSize: 34, fontWeight: '200' as const, letterSpacing: -0.8 },
  hero: { fontSize: 44, fontWeight: '200' as const, letterSpacing: -1.2 },
};

export const isEvening = (d = new Date()) => d.getHours() >= 20 || d.getHours() < 6;
