import * as Haptics from 'expo-haptics';

// The haptic vocabulary: eight feelings, never a buzz.
// v1 composes them from expo-haptics primitives so it runs in Expo Go.
// A Core Haptics (AHAP) / VibrationEffect.Composition adapter can replace this file
// later without the rest of the app noticing.

export type Feeling = 'heartbeat' | 'tick' | 'chalk' | 'exhale' | 'twoTaps' | 'softTap' | 'detent';

const quiet = (p: Promise<void>) => p.catch(() => undefined);
const soft = () => quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft));
const light = () => quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
const rigid = () => quiet(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid));
const select = () => quiet(Haptics.selectionAsync());

type Stop = () => void;

const after = (ms: number, fn: () => void) => {
  const t = setTimeout(fn, ms);
  return () => clearTimeout(t);
};

export function feel(f: Feeling): Stop {
  switch (f) {
    case 'heartbeat': {
      soft();
      return after(140, light);
    }
    case 'tick':
      rigid();
      return () => undefined;
    case 'chalk':
      select();
      return () => undefined;
    case 'softTap':
      soft();
      return () => undefined;
    case 'detent':
      select();
      return () => undefined;
    case 'twoTaps': {
      light();
      return after(180, light);
    }
    case 'exhale': {
      // A long fade: strong to faint, spread over ~900 ms.
      const steps = [0, 120, 260, 420, 600, 820];
      const fns = [rigid, light, light, soft, soft, select];
      const stops = steps.map((ms, i) => after(ms, fns[i]));
      return () => stops.forEach((s) => s());
    }
  }
}

// A slow heartbeat while you hold the glass.
export function heartbeatLoop(): Stop {
  let stopInner: Stop = feel('heartbeat');
  const id = setInterval(() => {
    stopInner = feel('heartbeat');
  }, 1100);
  return () => {
    clearInterval(id);
    stopInner();
  };
}

// Breathe with me: gentle taps quicken over 4 s in, then slow and fade over 6 s out.
export function breathLoop(): Stop {
  const timers: ReturnType<typeof setTimeout>[] = [];
  let alive = true;
  const cycle = () => {
    if (!alive) return;
    const inhale = [0, 900, 1600, 2200, 2700, 3100, 3450, 3750];
    const exhale = [4300, 5000, 5900, 7000, 8300];
    inhale.forEach((ms) => timers.push(setTimeout(soft, ms)));
    exhale.forEach((ms) => timers.push(setTimeout(select, ms)));
    timers.push(setTimeout(cycle, 10000));
  };
  cycle();
  return () => {
    alive = false;
    timers.forEach(clearTimeout);
  };
}

// "I'm listening": expo-camera doesn't expose live audio levels, so v1 uses a slow, faint
// pulse while recording instead of a hum that follows your voice. Replace once we have levels.
export function listeningLoop(): Stop {
  const id = setInterval(select, 3200);
  return () => clearInterval(id);
}
