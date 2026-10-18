import { Pressable, StyleSheet, Text, View } from 'react-native';

import { feel } from '../adapters/haptics';
import type { ReminderLevel, Settings } from '../core/types';
import { Field } from '../pane/Field';
import { crisisLine } from '../safety/crisisLines';
import { sky } from '../theme';

type Props = {
  settings: Settings;
  onChange: (s: Settings) => void;
  onLetGo: () => void;
  onClose: () => void;
  top: number;
};

const LEVELS: ReminderLevel[] = ['glow', 'whisper', 'nudge'];
const MEDS: Settings['medsTime'][] = [null, { hour: 8, minute: 0 }, { hour: 12, minute: 0 }, { hour: 21, minute: 0 }];
const KEEP = [5, 10, 20];

const fmtTime = (t: Settings['medsTime']) => {
  if (!t) return 'off';
  const h = t.hour % 12 || 12;
  return `${h}:${String(t.minute).padStart(2, '0')} ${t.hour < 12 ? 'am' : 'pm'}`;
};

const next = <T,>(list: T[], cur: T, eq: (a: T, b: T) => boolean = (a, b) => a === b) =>
  list[(list.findIndex((x) => eq(x, cur)) + 1) % list.length];

// The back of the glass: pulled down from the top edge. Six quiet rows; tap to change one.
// "Let go of everything" asks for a long press instead of an "are you sure?".
export function Back({ settings, onChange, onLetGo, onClose, top }: Props) {
  const set = (patch: Partial<Settings>) => {
    feel('detent');
    onChange({ ...settings, ...patch });
  };
  const sameTime = (a: Settings['medsTime'], b: Settings['medsTime']) =>
    a === b || (!!a && !!b && a.hour === b.hour && a.minute === b.minute);

  const rows = [
    { k: 'how it reaches you', v: settings.reminder, on: () => set({ reminder: next(LEVELS, settings.reminder) }) },
    { k: 'your face', v: settings.selfView ? 'shown' : 'hidden', on: () => set({ selfView: !settings.selfView }) },
    { k: 'two taps', v: fmtTime(settings.medsTime), on: () => set({ medsTime: next(MEDS, settings.medsTime, sameTime) }) },
    { k: 'where you are', v: crisisLine().country.toLowerCase(), on: undefined },
    { k: 'space', v: `keep ${settings.keepCalls}`, on: () => set({ keepCalls: next(KEEP, settings.keepCalls) }) },
  ];

  return (
    <>
      <Field kind="night" light="none" />
      <View style={[StyleSheet.absoluteFill, { paddingTop: top + 24 }]} pointerEvents="box-none">
        <View style={styles.handle} pointerEvents="none" />
        <View style={styles.list} pointerEvents="box-none">
          {rows.map((r) => (
            <Pressable key={r.k} onPress={r.on} disabled={!r.on} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${r.k}: ${r.v}`}>
              <Text style={styles.k}>{r.k}</Text>
              <Text style={styles.v}>{r.v}</Text>
            </Pressable>
          ))}
          <Pressable
            onLongPress={() => {
              feel('exhale');
              onLetGo();
            }}
            delayLongPress={2000}
            cancelable={false}
            accessibilityRole="button"
            accessibilityLabel="Let go of everything. Press and hold for two seconds to delete all your data."
          >
            <Text style={styles.k}>let go of everything</Text>
            <Text style={styles.v}>hold for two seconds. it really deletes it all.</Text>
          </Pressable>
        </View>
        <Pressable onPress={onClose} hitSlop={16} accessibilityRole="button" accessibilityLabel="Close settings">
          <Text style={styles.foot}>swipe up to close</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)' },
  list: { flex: 1, paddingHorizontal: 36, paddingTop: 64, gap: 30 },
  k: { color: sky.white, opacity: 0.9, fontSize: 22, fontWeight: '300', letterSpacing: -0.3 },
  v: { color: sky.white, opacity: 0.45, fontSize: 15, fontWeight: '300', marginTop: 4 },
  foot: { color: sky.white, opacity: 0.4, fontSize: 15, textAlign: 'center', marginBottom: 40 },
});
