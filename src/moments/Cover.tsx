import { useEffect } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { breathLoop } from '../adapters/haptics';
import type { SafetyPlan } from '../core/types';
import { Field } from '../pane/Field';
import { Whisper } from '../pane/Whisper';
import { crisisLine } from '../safety/crisisLines';

type Props = { plan: SafetyPlan | null; top: number; bottom: number; onClose: () => void };

// Palm over the glass, from anywhere. The pane turns warm and breathes with you: 4 in, 6 out.
// Three words, nothing else. Swipe down to go back. Works with no internet.
export function Cover({ plan, top, bottom, onClose }: Props) {
  const line = crisisLine();
  useEffect(() => breathLoop(), []);

  const open = (url: string) => Linking.openURL(url).catch(() => undefined);
  const words: { label: string; url: string; a11y: string }[] = [];
  if (line.call) words.push({ label: 'call', url: `tel:${line.call}`, a11y: `Call ${line.name}` });
  if (line.text) words.push({ label: 'text', url: `sms:${line.text}`, a11y: `Text ${line.name}` });
  if (!line.call && line.web) words.push({ label: 'find help', url: line.web, a11y: line.name });
  if (plan?.personPhone)
    words.push({
      label: plan.personName.trim().toLowerCase() || 'my person',
      url: `sms:${plan.personPhone}`,
      a11y: `Message ${plan.personName}`,
    });

  return (
    <>
      <Field kind="help" light="blush" breathe />
      <View style={[StyleSheet.absoluteFill, { paddingTop: top + 72, paddingBottom: bottom + 32 }]} pointerEvents="box-none">
        <Whisper size="hero">breathe</Whisper>
        <Whisper faint style={styles.sub}>
          with it
        </Whisper>
        <View style={styles.spacer} pointerEvents="none" />
        <View style={styles.words} pointerEvents="box-none">
          {words.map((w) => (
            <Pressable key={w.label} onPress={() => open(w.url)} hitSlop={20} accessibilityRole="link" accessibilityLabel={w.a11y}>
              <Whisper size="word" style={styles.word}>
                {w.label}
              </Whisper>
            </Pressable>
          ))}
        </View>
        {plan ? (
          <View style={styles.plan} pointerEvents="none">
            {plan.lines.filter(Boolean).map((l, i) => (
              <Whisper key={i} faint>
                {l}
              </Whisper>
            ))}
          </View>
        ) : null}
        <Whisper faint style={styles.sub}>
          {line.name.toLowerCase()}
        </Whisper>
        {/* Swipe down also works; the words are here for screen readers and anyone unsure. */}
        <Pressable onPress={onClose} hitSlop={16} accessibilityRole="button" accessibilityLabel="Go back">
          <Whisper faint style={styles.sub}>
            swipe down to go back
          </Whisper>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  sub: { marginTop: 8 },
  spacer: { flex: 1 },
  words: { flexDirection: 'row', justifyContent: 'center', gap: 36, marginBottom: 28 },
  word: { fontSize: 26 },
  plan: { gap: 4, marginBottom: 20, paddingHorizontal: 32 },
});
