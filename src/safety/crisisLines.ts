import { getLocales } from 'expo-localization';

// Crisis lines by country. Works offline — nothing here needs a network.
// IMPORTANT: numbers must be re-verified by the clinical advisor before every release.
export interface CrisisLine {
  country: string;
  name: string;
  call?: string;
  text?: string;
  web?: string;
}

const LINES: Record<string, CrisisLine> = {
  US: { country: 'United States', name: '988 Suicide & Crisis Lifeline', call: '988', text: '988' },
  CA: { country: 'Canada', name: '9-8-8 Suicide Crisis Helpline', call: '988', text: '988' },
  GB: { country: 'United Kingdom', name: 'Samaritans', call: '116123' },
  IE: { country: 'Ireland', name: 'Samaritans', call: '116123' },
  AU: { country: 'Australia', name: 'Lifeline', call: '131114', text: '0477131114' },
  NZ: { country: 'New Zealand', name: 'Need to talk? 1737', call: '1737', text: '1737' },
  IN: { country: 'India', name: 'Tele-MANAS', call: '14416' },
};

const FALLBACK: CrisisLine = {
  country: 'Anywhere',
  name: 'Find A Helpline',
  web: 'https://findahelpline.com',
};

export function crisisLine(region = getLocales()[0]?.regionCode ?? undefined): CrisisLine {
  return (region && LINES[region]) || FALLBACK;
}
