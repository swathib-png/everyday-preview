import { Directory, File, Paths } from 'expo-file-system';

import { emptyData, type EverydayData } from '../core/types';

// Everything lives on the phone, inside the app's own sandbox. Nothing is uploaded in v1.
// TODO before launch: encrypt videos and strokes at rest with a key from the vault
// (today we rely on the OS sandbox and iOS Data Protection).

const root = () => new Directory(Paths.document, 'everyday');
const callsDir = () => new Directory(root(), 'calls');
const dataFile = () => new File(root(), 'data.json');

function ensureDirs() {
  root().create({ idempotent: true, intermediates: true });
  callsDir().create({ idempotent: true, intermediates: true });
}

export function loadData(): EverydayData {
  try {
    ensureDirs();
    const f = dataFile();
    if (!f.exists) return emptyData();
    const parsed = JSON.parse(f.textSync()) as Partial<EverydayData>;
    const base = emptyData();
    return { ...base, ...parsed, settings: { ...base.settings, ...parsed.settings } };
  } catch {
    // A corrupted file should never lock someone out of their safety kit.
    return emptyData();
  }
}

export async function saveData(data: EverydayData): Promise<void> {
  ensureDirs();
  const f = dataFile();
  if (!f.exists) f.create();
  await f.write(JSON.stringify(data));
}

// Move a fresh recording out of the camera's cache into the app's own folder.
export async function keepVideo(tempUri: string, id: string): Promise<string> {
  ensureDirs();
  const src = new File(tempUri);
  const ext = src.extension || '.mov';
  const dest = new File(callsDir(), `${id}${ext.startsWith('.') ? ext : `.${ext}`}`);
  await src.move(dest);
  return dest.uri;
}

export function forgetVideo(uri: string) {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Already gone is fine.
  }
}

export function forgetEverything() {
  try {
    const r = root();
    if (r.exists) r.delete();
  } catch {
    // Nothing to delete.
  }
}
