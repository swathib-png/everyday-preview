import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';

import { breathLoop, feel, heartbeatLoop } from '../adapters/haptics';
import type { SafetyPlan } from '../core/types';
import { Field } from '../pane/Field';
import { InkLayer, useInk } from '../pane/Ink';
import { usePaneTouches } from '../pane/useTouches';
import { Whisper } from '../pane/Whisper';
import { sky } from '../theme';

type Props = { onDone: (plan: SafetyPlan) => void; top: number; bottom: number };
type Step = 'hold' | 'write' | 'cover' | 'person';

// The first minute: four lessons, learned by touching. The person step is the only form in the app.
export function FirstMinute({ onDone, top, bottom }: Props) {
  const [step, setStep] = useState<Step>('hold');
  const [breathing, setBreathing] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [lines, setLines] = useState<[string, string, string]>(['', '', '']);
  const stopRef = useRef<() => void>(() => undefined);
  const ink = useInk();

  // Step 2 → 3: once something is written and the finger rests for a moment.
  useEffect(() => {
    if (step !== 'write' || ink.strokes.length === 0 || ink.live) return;
    const t = setTimeout(() => {
      feel('softTap');
      setStep('cover');
    }, 1500);
    return () => clearTimeout(t);
  }, [step, ink.strokes, ink.live]);

  useEffect(() => () => stopRef.current(), []);

  const touches = usePaneTouches({
    onHoldStart: () => {
      if (step !== 'hold') return;
      const stopBeat = heartbeatLoop();
      const t = setTimeout(() => {
        stopBeat();
        feel('tick');
        setStep('write');
      }, 2200);
      stopRef.current = () => {
        clearTimeout(t);
        stopBeat();
      };
    },
    onHoldEnd: () => stopRef.current(),
    ink: step === 'write' ? { start: ink.start, move: ink.move, end: ink.end } : undefined,
    onCover: () => {
      if (step !== 'cover') return;
      setBreathing(true);
      const stop = breathLoop();
      setTimeout(() => {
        stop();
        setBreathing(false);
        setStep('person');
      }, 4000);
    },
    onSwipe: (dir) => {
      if (step !== 'person' || dir !== 'up' || !phone.trim()) return;
      feel('exhale');
      onDone({ personName: name.trim(), personPhone: phone.trim(), lines });
    },
  });

  const prompt: Record<Step, [string, string]> = {
    hold: ['hold this.', 'you’ll feel a heartbeat'],
    write: ['write anything.', 'your first word for future you'],
    cover: ['cover the glass.', 'with your whole hand — this is how you find help, always'],
    person: ['who should be one tap away?', phone.trim() ? 'swipe up when you’re done' : 'the only form in the whole app'],
  };

  return (
    <View style={StyleSheet.absoluteFill} {...touches}>
      <Field
        kind={breathing ? 'help' : 'day'}
        light={breathing ? 'blush' : step === 'hold' ? 'peach' : 'none'}
        breathe={breathing}
      />
      {step === 'write' ? <InkLayer strokes={ink.strokes} live={ink.live} dark={false} /> : null}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[StyleSheet.absoluteFill, { paddingTop: top + 96, paddingBottom: bottom + 40 }]}
        pointerEvents="box-none"
      >
        <Whisper size="hero">{prompt[step][0]}</Whisper>
        <Whisper faint style={styles.sub}>
          {prompt[step][1]}
        </Whisper>
        {step === 'person' ? (
          <View style={styles.form} pointerEvents="box-none">
            <TextInput style={styles.input} placeholder="their name" placeholderTextColor={sky.inkSoft} value={name} onChangeText={setName} />
            <TextInput
              style={styles.input}
              placeholder="their number"
              placeholderTextColor={sky.inkSoft}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
            <Whisper faint style={styles.planLabel}>
              your plan, in three lines
            </Whisper>
            {(['what helps me…', 'who I can reach…', 'where I can go…'] as const).map((ph, i) => (
              <TextInput
                key={ph}
                style={styles.input}
                placeholder={ph}
                placeholderTextColor={sky.inkSoft}
                value={lines[i]}
                onChangeText={(v) => setLines((l) => l.map((x, j) => (j === i ? v : x)) as [string, string, string])}
              />
            ))}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  sub: { marginTop: 10, paddingHorizontal: 40 },
  form: { marginTop: 36, paddingHorizontal: 32, gap: 12 },
  planLabel: { marginTop: 12, textAlign: 'left' },
  input: {
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '300',
    color: sky.ink,
  },
});
