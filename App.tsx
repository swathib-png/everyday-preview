import { Blur, Canvas, Circle } from '@shopify/react-native-skia';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View, type AccessibilityActionEvent } from 'react-native';
import { useDerivedValue, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { feel, heartbeatLoop, listeningLoop } from './src/adapters/haptics';
import { watchFaceDown } from './src/adapters/motion';
import { scheduleMeds } from './src/adapters/notifications';
import { forgetVideo, keepVideo } from './src/adapters/storage';
import { expireDoors, markNotToday, markTried, pickDoor } from './src/core/doors';
import { ALL_MS, LINE_MS, WORD_MS } from './src/core/hold';
import { initialPane, paneReducer, type Depth, type Mode } from './src/core/machine';
import { isDue, record, shouldShowSkipCard } from './src/core/meds';
import { DAY_MS, newId, type Call, type EverydayData, type Stroke } from './src/core/types';
import { callsToFade, isWelcomeBack, waiting } from './src/core/waitingRoom';
import { Back } from './src/moments/Back';
import { Cover } from './src/moments/Cover';
import { FirstMinute } from './src/moments/FirstMinute';
import { Recorder, type Recording, type RecordingHandle } from './src/moments/Recorder';
import { Clearing } from './src/pane/Clearing';
import { Field } from './src/pane/Field';
import { InkLayer, InkView, useInk } from './src/pane/Ink';
import { usePaneTouches, type TouchHandlers } from './src/pane/useTouches';
import { Whisper } from './src/pane/Whisper';
import { useEveryday } from './src/store/useEveryday';
import { isEvening, sky, type Light } from './src/theme';

export default function App() {
  return (
    <SafeAreaProvider>
      <Everyday />
    </SafeAreaProvider>
  );
}

const NIGHT_MODES: Mode[] = ['hold', 'turn', 'write', 'sent', 'back'];
const SENT_MS = 2600;
const TAPS_TIMEOUT_MS = 90_000;
const SKIP_CARD_MS = 7000;
const WEEKDAY = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const ago = (ts: number, now: number) => {
  const days = Math.floor((now - ts) / DAY_MS);
  if (days <= 0) return 'earlier today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
};

const withTimeout = (p: Recording, ms: number): Recording =>
  Promise.race([p, new Promise<undefined>((r) => setTimeout(() => r(undefined), ms))]);

function Everyday() {
  const { data, update, plan, setPlan, forgetAll } = useEveryday();
  const [pane, dispatch] = useReducer(paneReducer, initialPane);
  const insets = useSafeAreaInsets();
  const { width: w, height: h } = useWindowDimensions();
  const [now, setNow] = useState(() => Date.now());

  // Refs mirror state for callbacks that fire from timers and sensors.
  const paneRef = useRef(pane);
  paneRef.current = pane;
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const past = waiting(data.calls, now);
  const evening = isEvening(new Date(now));

  // ── Boot ────────────────────────────────────────────────────────────────
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const t = Date.now();
    dispatch({
      type: 'BOOT',
      onboarded: data.onboarded,
      welcome: isWelcomeBack(data.lastOpenedAt, t) && !!waiting(data.calls, t),
    });
    update((d) => ({ ...d, lastOpenedAt: t, doors: expireDoors(d.doors, t) }));
  }, [data, update]);

  useEffect(() => {
    scheduleMeds(data.settings.medsTime, data.settings.reminder).catch(() => undefined);
  }, [data.settings.medsTime, data.settings.reminder]);

  // ── Rest: a note or two taps may surface after a quiet moment ───────────
  useEffect(() => {
    if (pane.mode !== 'rest') return;
    const t = setTimeout(() => {
      const n = Date.now();
      const d = dataRef.current;
      if (isDue(d.settings.medsTime, d.meds, n)) dispatch({ type: 'TAPS_DUE' });
      else if (pickDoor(d.doors, n)) dispatch({ type: 'NOTE_SHOW' });
    }, 1800);
    return () => clearTimeout(t);
  }, [pane.mode, data.meds, data.doors, data.settings.medsTime, now]);

  // ── Hold: hear Past You ─────────────────────────────────────────────────
  const [holdAt, setHoldAt] = useState({ x: w / 2, y: h / 2 });
  const holdStops = useRef<(() => void)[]>([]);
  const holdPast = useRef<Call | null>(null);

  const startHold = useCallback(
    (x: number, y: number) => {
      setHoldAt({ x, y });
      holdPast.current = past;
      dispatch({ type: 'HOLD_START' });
      const stops = [heartbeatLoop()];
      if (past) {
        ([
          [WORD_MS, 1],
          [LINE_MS, 2],
          [ALL_MS, 3],
        ] as [number, Depth][]).forEach(([ms, depth]) => {
          const t = setTimeout(() => {
            dispatch({ type: 'HOLD_DEPTH', depth });
            feel('tick');
          }, ms);
          stops.push(() => clearTimeout(t));
        });
      }
      holdStops.current = stops;
    },
    [past],
  );

  const endHold = useCallback(() => {
    holdStops.current.forEach((s) => s());
    holdStops.current = [];
    const heard = holdPast.current;
    if (heard && paneRef.current.depth >= 1) {
      update((d) => ({ ...d, calls: d.calls.map((c) => (c.id === heard.id ? { ...c, heard: true } : c)) }));
    }
    dispatch({ type: 'HOLD_END', hasPast: !!heard });
  }, [update]);

  // ── Your turn and writing ───────────────────────────────────────────────
  const rec = useRef<RecordingHandle>({ promise: null });
  const ink = useInk();
  const inkRef = useRef(ink);
  inkRef.current = ink;
  const [stage, setStage] = useState<'word' | 'note'>('word');
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const wordDraft = useRef<Stroke[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const sending = useRef(false);

  const discardRecording = useCallback(() => {
    const p = rec.current.promise;
    rec.current.promise = null;
    p?.then((r) => r?.uri && forgetVideo(r.uri));
  }, []);

  useEffect(() => {
    if (pane.mode !== 'turn') return;
    rec.current = { promise: null };
    inkRef.current.clear();
    wordDraft.current = [];
    setStage('word');
    setElapsed(0);
    const start = Date.now();
    const id = setInterval(() => {
      const s = Math.floor((Date.now() - start) / 1000);
      setElapsed(s);
      if (s >= 300) dispatch({ type: 'TURN_DONE' });
    }, 1000);
    const stop = listeningLoop();
    return () => {
      clearInterval(id);
      stop();
    };
  }, [pane.mode]);

  // After a word is written and the finger rests, offer one more line: a note for later.
  useEffect(() => {
    if (pane.mode !== 'write' || stage !== 'word' || ink.strokes.length === 0 || ink.live) return;
    const t = setTimeout(() => {
      wordDraft.current = inkRef.current.strokes;
      inkRef.current.clear();
      setStage('note');
      feel('softTap');
    }, 1800);
    return () => clearTimeout(t);
  }, [pane.mode, stage, ink.strokes, ink.live]);

  const send = useCallback(async () => {
    const m = paneRef.current.mode;
    if ((m !== 'turn' && m !== 'write') || sending.current) return;
    sending.current = true;
    const word = stageRef.current === 'word' ? inkRef.current.strokes : wordDraft.current;
    const note = stageRef.current === 'note' ? inkRef.current.strokes : [];
    const pending = rec.current.promise;
    rec.current.promise = null;
    dispatch({ type: 'SEND' }); // unmounting the camera stops the recording
    feel('exhale');

    const result = pending ? await withTimeout(pending, 5000) : undefined;
    const id = newId();
    let videoUri: string | null = null;
    if (result?.uri) {
      try {
        videoUri = await keepVideo(result.uri, id);
      } catch {
        videoUri = result.uri;
      }
    }
    const createdAt = Date.now();
    const d: EverydayData = dataRef.current;
    let calls: Call[] = [...d.calls, { id, createdAt, videoUri, word, heard: false }];
    const fade = callsToFade(calls, d.settings.keepCalls);
    fade.forEach((c) => c.videoUri && forgetVideo(c.videoUri));
    calls = calls.map((c) => (fade.some((f) => f.id === c.id) ? { ...c, videoUri: null } : c));
    const doors = note.length
      ? [...d.doors, { id: newId(), createdAt, note, status: 'open' as const, notTodayCount: 0 }]
      : d.doors;
    update((cur) => ({ ...cur, calls, doors }));

    setTimeout(() => {
      dispatch({ type: 'SENT_SETTLED' });
      sending.current = false;
    }, SENT_MS);
  }, [update]);

  // Face-down is send.
  useEffect(() => {
    if (pane.mode !== 'turn' && pane.mode !== 'write') return;
    return watchFaceDown(() => {
      send();
    });
  }, [pane.mode, send]);

  const cancelTurn = useCallback(() => {
    discardRecording();
    dispatch({ type: 'TURN_CANCEL' });
  }, [discardRecording]);

  // ── A note on the glass ─────────────────────────────────────────────────
  const door = pickDoor(data.doors, now);
  const answerNote = useCallback(
    (tried: boolean) => {
      const dd = pickDoor(dataRef.current.doors, Date.now());
      if (dd) {
        const t = Date.now();
        update((d) => ({ ...d, doors: tried ? markTried(d.doors, dd.id, t) : markNotToday(d.doors, dd.id, t) }));
      }
      feel('softTap');
      dispatch({ type: 'NOTE_DONE' });
    },
    [update],
  );

  // ── Two taps (meds) ─────────────────────────────────────────────────────
  const [skipCard, setSkipCard] = useState(false);
  useEffect(() => {
    if (pane.mode !== 'taps') return;
    const stop = feel('twoTaps');
    const t = setTimeout(() => {
      update((d) => ({ ...d, meds: record(d.meds, Date.now(), 'unknown') }));
      dispatch({ type: 'TAPS_DONE' });
    }, TAPS_TIMEOUT_MS);
    return () => {
      stop();
      clearTimeout(t);
    };
  }, [pane.mode, update]);

  const answerTaps = useCallback(
    (taken: boolean) => {
      const t = Date.now();
      const meds = record(dataRef.current.meds, t, taken ? 'taken' : 'skipped');
      const card = !taken && shouldShowSkipCard(meds, dataRef.current.skipCardShown);
      update((d) => ({ ...d, meds, skipCardShown: d.skipCardShown || card }));
      feel(taken ? 'twoTaps' : 'softTap');
      if (card) {
        setSkipCard(true);
        setTimeout(() => {
          setSkipCard(false);
          dispatch({ type: 'TAPS_DONE' });
        }, SKIP_CARD_MS);
      } else {
        dispatch({ type: 'TAPS_DONE' });
      }
    },
    [update],
  );

  // ── Help, from anywhere ─────────────────────────────────────────────────
  const cover = useCallback(() => {
    const m = paneRef.current.mode;
    if (m === 'hold') {
      holdStops.current.forEach((s) => s());
      holdStops.current = [];
    }
    if (m === 'turn' || m === 'write') discardRecording();
    dispatch({ type: 'COVER' });
  }, [discardRecording]);

  const startFresh = useCallback(() => {
    update((d) => ({ ...d, calls: d.calls.map((c) => ({ ...c, heard: true })) }));
    feel('softTap');
    dispatch({ type: 'WELCOME_FRESH' });
  }, [update]);

  // ── Gestures, by moment ─────────────────────────────────────────────────
  const handlers: TouchHandlers = (() => {
    switch (pane.mode) {
      case 'rest':
        return {
          onHoldStart: startHold,
          onHoldEnd: endHold,
          onPullDown: () => {
            feel('detent');
            dispatch({ type: 'PULL_DOWN' });
          },
          onCover: cover,
        };
      case 'welcome':
        return { onHoldStart: startHold, onHoldEnd: endHold, onSwipe: (d) => d === 'up' && startFresh(), onCover: cover };
      case 'hold':
        return { onHoldEnd: endHold, onCover: cover };
      case 'turn':
        return {
          onSwipe: (d) => {
            if (d === 'up') dispatch({ type: 'TURN_DONE' });
            if (d === 'down') cancelTurn();
          },
          onTwoFingerTap: send,
          onCover: cover,
        };
      case 'write':
        return { ink: { start: ink.start, move: ink.move, end: ink.end }, onTwoFingerTap: send, onCover: cover };
      case 'note':
        return {
          onHoldStart: startHold,
          onHoldEnd: endHold,
          onSwipe: (d) => (d === 'up' ? answerNote(true) : answerNote(false)),
          onCover: cover,
        };
      case 'taps':
        return { onDoubleTap: () => answerTaps(true), onSwipe: () => answerTaps(false), onCover: cover };
      case 'cover':
        return { onSwipe: (d) => d === 'down' && dispatch({ type: 'UNCOVER' }) };
      case 'back':
        return { onSwipe: (d) => d === 'up' && dispatch({ type: 'CLOSE_BACK' }), onCover: cover };
      default:
        return { onCover: cover };
    }
  })();
  const touches = usePaneTouches(handlers);

  // Every gesture is also a named action for VoiceOver / TalkBack.
  const a11y = accessibilityFor(pane.mode);
  const onA11y = (e: AccessibilityActionEvent) => {
    switch (e.nativeEvent.actionName) {
      case 'help':
        return cover();
      case 'listen': {
        startHold(w / 2, h / 2);
        setTimeout(endHold, past ? ALL_MS + 1000 : 300);
        return;
      }
      case 'settings':
        return dispatch({ type: 'PULL_DOWN' });
      case 'done':
        return dispatch({ type: 'TURN_DONE' });
      case 'send':
        return send();
      case 'try':
        return answerNote(true);
      case 'notToday':
        return answerNote(false);
      case 'taken':
        return answerTaps(true);
      case 'skipped':
        return answerTaps(false);
      case 'close':
        return dispatch({ type: pane.mode === 'cover' ? 'UNCOVER' : 'CLOSE_BACK' });
      case 'startFresh':
        return startFresh();
    }
  };

  // ── The first minute is its own little world ────────────────────────────
  if (pane.mode === 'first') {
    return (
      <>
        <StatusBar style="dark" />
        <FirstMinute
          top={insets.top}
          bottom={insets.bottom}
          onDone={async (p) => {
            await setPlan(p);
            update((d) => ({ ...d, onboarded: true }));
            dispatch({ type: 'FIRST_DONE' });
          }}
        />
      </>
    );
  }

  const night = NIGHT_MODES.includes(pane.mode) || (evening && pane.mode === 'rest');
  const light: Light =
    pane.mode === 'note'
      ? 'gold'
      : pane.mode === 'hold' || pane.mode === 'welcome' || (pane.mode === 'rest' && past)
        ? 'peach'
        : pane.mode === 'rest' && evening
          ? 'mauve'
          : 'none';
  const pad = { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 36 };
  const m = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;

  return (
    <View
      style={styles.root}
      {...touches}
      // Cover and Back have their own tappable words, so the pane mustn't swallow them.
      accessible={pane.mode !== 'cover' && pane.mode !== 'back'}
      accessibilityLabel={a11y.label}
      accessibilityActions={a11y.actions}
      onAccessibilityAction={onA11y}
    >
      <StatusBar style={night || pane.mode === 'cover' ? 'light' : 'dark'} />

      {pane.mode === 'cover' ? (
        <Cover plan={plan} top={insets.top} bottom={insets.bottom} onClose={() => dispatch({ type: 'UNCOVER' })} />
      ) : pane.mode === 'back' ? (
        <Back
          top={insets.top}
          settings={data.settings}
          onChange={(settings) => update((d) => ({ ...d, settings }))}
          onClose={() => dispatch({ type: 'CLOSE_BACK' })}
          onLetGo={async () => {
            await forgetAll();
            dispatch({ type: 'CLOSE_BACK' });
            dispatch({ type: 'BOOT', onboarded: false, welcome: false });
          }}
        />
      ) : (
        <Field kind={night ? 'night' : 'day'} light={light} strength={pane.mode === 'rest' && !past ? 0.5 : 1} />
      )}

      {pane.mode === 'turn' ? (
        <Recorder selfView={data.settings.selfView} handle={rec} onUnavailable={() => dispatch({ type: 'TURN_DONE' })} />
      ) : null}
      {pane.mode === 'hold' ? <Clearing x={holdAt.x} y={holdAt.y} depth={pane.depth} past={holdPast.current} /> : null}
      {pane.mode === 'write' ? <InkLayer strokes={ink.strokes} live={ink.live} /> : null}
      {pane.mode === 'sent' ? <Drift /> : null}

      <View style={[StyleSheet.absoluteFill, pad]} pointerEvents="none">
        {pane.mode === 'rest' ? (
          <>
            <Whisper dark={night} faint>
              {WEEKDAY[new Date(now).getDay()]}
            </Whisper>
            <View style={styles.flex} />
            {past ? (
              <>
                <Whisper dark={night} size="word">
                  past you
                </Whisper>
                <Whisper dark={night} faint>
                  {ago(past.createdAt, now)} · hold the glass
                </Whisper>
              </>
            ) : (
              <Whisper dark={night} faint>
                hold the glass to leave a message
              </Whisper>
            )}
          </>
        ) : null}

        {pane.mode === 'welcome' ? (
          <>
            <View style={styles.flex} />
            <Whisper size="hero">it’s been a while.</Whisper>
            <Whisper faint style={styles.gap}>
              no catching up needed. nothing broke.
            </Whisper>
            <View style={styles.flex} />
            <Whisper faint>hold to hear past you · swipe up to start fresh</Whisper>
          </>
        ) : null}

        {pane.mode === 'hold' ? (
          <>
            <View style={styles.flex} />
            <Whisper dark>
              {holdPast.current ? (pane.depth === 0 ? 'keep holding' : 'let go anytime') : 'no one yet. let go to begin.'}
            </Whisper>
            {holdPast.current ? (
              <View style={[styles.dots, { top: h / 2 - 20 }]}>
                {[1, 2, 3].map((i) => (
                  <View key={i} style={[styles.dot, { opacity: pane.depth >= i ? 0.9 : 0.25 }]} />
                ))}
              </View>
            ) : null}
          </>
        ) : null}

        {pane.mode === 'turn' ? (
          <>
            <Whisper dark faint>
              {m}
            </Whisper>
            <View style={styles.flex} />
            <Whisper dark size="word">
              just talk.
            </Whisper>
            <Whisper dark faint style={styles.gap}>
              swipe up when you’re done
            </Whisper>
          </>
        ) : null}

        {pane.mode === 'write' ? (
          <>
            <Whisper dark>{stage === 'word' ? 'one word for future you' : 'a note for later?'}</Whisper>
            <View style={styles.flex} />
            <Whisper dark faint>
              set it face-down to send
            </Whisper>
          </>
        ) : null}

        {pane.mode === 'sent' ? (
          <>
            <View style={styles.flex} />
            <Whisper dark size="word">
              it’ll wait.
            </Whisper>
            <View style={styles.flex} />
          </>
        ) : null}

        {pane.mode === 'note' && door ? (
          <>
            <Whisper faint>↑</Whisper>
            <View style={styles.flex} />
            <View style={styles.center}>
              <InkView strokes={door.note} width={w * 0.8} height={h * 0.3} color={sky.ink} />
            </View>
            <View style={styles.flex} />
            <Whisper faint>up · i’ll try      away · not today</Whisper>
          </>
        ) : null}

        {pane.mode === 'taps' ? (
          <>
            <Whisper faint>
              {data.settings.medsTime
                ? `${data.settings.medsTime.hour % 12 || 12}:${String(data.settings.medsTime.minute).padStart(2, '0')}`
                : ''}
            </Whisper>
            <View style={styles.flex} />
            {skipCard ? (
              <Whisper style={styles.card}>
                you’ve skipped a few days in a row. stopping suddenly can feel rough — maybe a word with your prescriber.
              </Whisper>
            ) : (
              <>
                <View style={styles.taps}>
                  <View style={styles.tap} />
                  <View style={styles.tap} />
                </View>
                <Whisper style={styles.gap}>tap twice back</Whisper>
              </>
            )}
            <View style={styles.flex} />
          </>
        ) : null}
      </View>
    </View>
  );
}

// Sent: a small glow drifts up and fades. It'll wait.
function Drift() {
  const { width: w, height: h } = useWindowDimensions();
  const y = useSharedValue(h * 0.45);
  useEffect(() => {
    y.value = withTiming(h * 0.16, { duration: SENT_MS, easing: Easing.out(Easing.cubic) });
  }, [h, y]);
  const trail1 = useDerivedValue(() => y.value + 36);
  const trail2 = useDerivedValue(() => y.value + 64);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        <Circle cx={w / 2} cy={y} r={14} color={sky.peach}>
          <Blur blur={3} />
        </Circle>
        <Circle cx={w / 2} cy={trail1} r={8} color={sky.peach} opacity={0.5} />
        <Circle cx={w / 2} cy={trail2} r={5} color={sky.peach} opacity={0.25} />
      </Canvas>
    </View>
  );
}

function accessibilityFor(mode: Mode): { label: string; actions: { name: string; label: string }[] } {
  const help = { name: 'help', label: 'I’m not okay — get help' };
  switch (mode) {
    case 'rest':
      return { label: 'Everyday. The glass is quiet.', actions: [{ name: 'listen', label: 'Hear Past You, or leave a message' }, { name: 'settings', label: 'Settings' }, help] };
    case 'welcome':
      return { label: 'It’s been a while.', actions: [{ name: 'listen', label: 'Hear Past You' }, { name: 'startFresh', label: 'Start fresh' }, help] };
    case 'turn':
      return { label: 'Recording for Future You.', actions: [{ name: 'done', label: 'Done talking' }, { name: 'send', label: 'Send now' }, help] };
    case 'write':
      return { label: 'Write a word for Future You.', actions: [{ name: 'send', label: 'Send' }, help] };
    case 'note':
      return { label: 'A note from you is on the glass.', actions: [{ name: 'try', label: 'I’ll try' }, { name: 'notToday', label: 'Not today' }, help] };
    case 'taps':
      return { label: 'Time for your medication.', actions: [{ name: 'taken', label: 'Taken' }, { name: 'skipped', label: 'Skipped' }, help] };
    case 'cover':
      return { label: 'Help is here.', actions: [{ name: 'close', label: 'Go back' }] };
    case 'back':
      return { label: 'Settings.', actions: [{ name: 'close', label: 'Close settings' }, help] };
    default:
      return { label: 'Everyday.', actions: [help] };
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: sky.paper },
  flex: { flex: 1 },
  gap: { marginTop: 10 },
  center: { alignItems: 'center' },
  dots: { position: 'absolute', right: 14, gap: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: sky.white },
  taps: { flexDirection: 'row', justifyContent: 'center', gap: 22 },
  tap: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: sky.white,
    shadowColor: sky.white,
    shadowOpacity: 0.95,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  card: { paddingHorizontal: 40, fontSize: 20 },
});
