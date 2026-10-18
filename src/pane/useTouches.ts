import { useMemo, useRef } from 'react';
import { PanResponder, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';

import { HOLD_START_MS } from '../core/hold';

export type Swipe = 'up' | 'down' | 'side';

export interface TouchHandlers {
  onHoldStart?: (x: number, y: number) => void;
  onHoldEnd?: () => void;
  onSwipe?: (dir: Swipe) => void;
  onPullDown?: () => void; // from the top edge
  onDoubleTap?: () => void;
  onTwoFingerTap?: () => void; // quiet fallback for "send" when there's no accelerometer
  onCover?: () => void; // palm: three or more fingers held
  ink?: { start: (x: number, y: number) => void; move: (x: number, y: number) => void; end: () => void };
}

const SWIPE = 70;
const TOP_EDGE = 90;
const PULL = 120;
const DOUBLE_TAP_MS = 350;
const COVER_TOUCHES = 3; // RN doesn't expose touch size, so a palm is "3+ fingers"
const COVER_MS = 600;

// One full-screen touch surface. No buttons: everything is a gesture you know from real glass.
export function usePaneTouches(handlers: TouchHandlers) {
  const h = useRef(handlers);
  h.current = handlers;

  const s = useRef({
    x: 0,
    y: 0,
    t: 0,
    holding: false,
    inking: false,
    covered: false,
    maxTouches: 0,
    lastTap: 0,
    holdTimer: null as ReturnType<typeof setTimeout> | null,
    coverTimer: null as ReturnType<typeof setTimeout> | null,
  });

  return useMemo(() => {
    const clearHold = () => {
      if (s.current.holdTimer) clearTimeout(s.current.holdTimer);
      s.current.holdTimer = null;
    };
    const clearCover = () => {
      if (s.current.coverTimer) clearTimeout(s.current.coverTimer);
      s.current.coverTimer = null;
    };

    const watchCover = (touches: number) => {
      const st = s.current;
      if (touches >= COVER_TOUCHES && !st.coverTimer && !st.covered) {
        st.coverTimer = setTimeout(() => {
          st.covered = true;
          clearHold();
          if (st.holding) {
            st.holding = false;
            h.current.onHoldEnd?.();
          }
          h.current.onCover?.();
        }, COVER_MS);
      } else if (touches < COVER_TOUCHES) {
        clearCover();
      }
    };

    const grant = (e: GestureResponderEvent, g: PanResponderGestureState) => {
      const st = s.current;
      const { pageX: x, pageY: y } = e.nativeEvent;
      Object.assign(st, { x, y, t: Date.now(), holding: false, covered: false, inking: false });
      st.maxTouches = g.numberActiveTouches;
      watchCover(g.numberActiveTouches);
      if (h.current.ink) {
        st.inking = true;
        h.current.ink.start(x, y);
        return;
      }
      st.holdTimer = setTimeout(() => {
        if (h.current.onHoldStart && st.maxTouches === 1) {
          st.holding = true;
          h.current.onHoldStart(st.x, st.y);
        }
      }, HOLD_START_MS);
    };

    const move = (e: GestureResponderEvent, g: PanResponderGestureState) => {
      const st = s.current;
      st.maxTouches = Math.max(st.maxTouches, g.numberActiveTouches);
      watchCover(g.numberActiveTouches);
      if (st.inking && g.numberActiveTouches === 1) {
        h.current.ink?.move(e.nativeEvent.pageX, e.nativeEvent.pageY);
        return;
      }
      if (!st.holding && (Math.abs(g.dx) > 12 || Math.abs(g.dy) > 12)) clearHold();
    };

    const finish = (_e: GestureResponderEvent, g: PanResponderGestureState) => {
      const st = s.current;
      clearHold();
      clearCover();
      if (st.covered) return;

      const still = Math.abs(g.dx) < 12 && Math.abs(g.dy) < 12;
      if (st.maxTouches === 2 && still && Date.now() - st.t < 500) {
        if (st.inking) h.current.ink?.end();
        h.current.onTwoFingerTap?.();
        return;
      }
      if (st.inking) {
        h.current.ink?.end();
        return;
      }
      if (st.holding) {
        st.holding = false;
        h.current.onHoldEnd?.();
        return;
      }
      if (st.y < TOP_EDGE && g.dy > PULL) {
        h.current.onPullDown?.();
        return;
      }
      if (Math.abs(g.dy) > SWIPE && Math.abs(g.dy) > Math.abs(g.dx)) {
        h.current.onSwipe?.(g.dy < 0 ? 'up' : 'down');
        return;
      }
      if (Math.abs(g.dx) > SWIPE) {
        h.current.onSwipe?.('side');
        return;
      }
      if (still) {
        const now = Date.now();
        if (now - st.lastTap < DOUBLE_TAP_MS) {
          st.lastTap = 0;
          h.current.onDoubleTap?.();
        } else {
          st.lastTap = now;
        }
      }
    };

    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      // Only claim a moving touch once it's clearly a swipe, so finger jitter
      // doesn't cancel a press on a word (call, text, let go of everything).
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 10 || Math.abs(g.dy) > 10,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: grant,
      onPanResponderMove: move,
      onPanResponderRelease: finish,
      onPanResponderTerminate: finish,
    }).panHandlers;
  }, []);
}
