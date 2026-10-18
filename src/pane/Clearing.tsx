import { Blur, Canvas, Circle, RadialGradient, vec } from '@shopify/react-native-skia';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ALL_MS, LINE_CLIP_SECONDS } from '../core/hold';
import type { Depth } from '../core/machine';
import type { Call } from '../core/types';
import { sky } from '../theme';
import { InkView } from './Ink';

type Props = { x: number; y: number; depth: Depth; past: Call | null };

const MIN_R = 46;

// Holding the glass clears it under your thumb. The longer you hold, the wider it opens:
// first their word, then a line of their video, then all of it.
export function Clearing({ x, y, depth, past }: Props) {
  const { width: w, height: h } = useWindowDimensions();
  const maxR = Math.min(w, h) * 0.46;
  // Keep the clearing on screen even if the thumb lands near an edge.
  const cx = Math.min(Math.max(x, maxR * 0.7), w - maxR * 0.7);
  const cy = Math.min(Math.max(y - 40, maxR), h - maxR);

  const r = useSharedValue(MIN_R);
  useEffect(() => {
    r.value = withTiming(maxR, { duration: ALL_MS, easing: Easing.out(Easing.cubic) });
  }, [maxR, r]);

  const lens = useAnimatedStyle(() => ({
    left: cx - r.value,
    top: cy - r.value,
    width: r.value * 2,
    height: r.value * 2,
    borderRadius: r.value,
  }));

  const rimR = useDerivedValue(() => r.value);
  const glowR = useDerivedValue(() => r.value * 1.25);
  const innerR = useDerivedValue(() => r.value * 0.7);

  const player = useVideoPlayer(past?.videoUri ?? null, (p) => {
    p.loop = false;
  });

  // Word: nothing plays. Line: the first ten seconds. All: keep going.
  useEffect(() => {
    if (!past?.videoUri) return;
    if (depth >= 2) player.play();
    if (depth !== 2) return;
    const id = setInterval(() => {
      if (player.currentTime >= LINE_CLIP_SECONDS) player.pause();
    }, 250);
    return () => clearInterval(id);
  }, [depth, past?.videoUri, player]);

  useEffect(
    () => () => {
      // The player may already be released by the time this cleanup runs.
      try {
        player.pause();
      } catch {
        // nothing to stop
      }
    },
    [player],
  );

  const showVideo = !!past?.videoUri && depth >= 2;
  const size = maxR * 1.4;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Soft halo where the frost thins out around the clearing */}
      <Canvas style={StyleSheet.absoluteFill}>
        <Circle cx={cx} cy={cy} r={glowR} color={sky.white} opacity={0.08}>
          <Blur blur={24} />
        </Circle>
      </Canvas>

      <Animated.View style={[styles.lens, lens]}>
        {showVideo ? (
          <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
        ) : (
          <Canvas style={StyleSheet.absoluteFill}>
            {/* Past You, out of focus: a warm presence at the centre of the lens */}
            <Circle cx={rimR} cy={rimR} r={innerR} color={past ? sky.skin : sky.peach} opacity={0.55}>
              <Blur blur={34} />
            </Circle>
          </Canvas>
        )}
      </Animated.View>

      {depth >= 1 && past && past.word.length > 0 && !showVideo ? (
        <View style={[styles.word, { left: cx - size / 2, top: cy - size / 4, width: size, height: size / 2 }]}>
          <InkView strokes={past.word} width={size} height={size / 2} />
        </View>
      ) : null}

      {/* The frosted rim: clear in the middle, softly white at the edge. Never a line. */}
      <Canvas style={StyleSheet.absoluteFill}>
        <Circle cx={cx} cy={cy} r={rimR}>
          <RadialGradient
            c={vec(cx, cy)}
            r={rimR}
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.35)']}
            positions={[0, 0.78, 1]}
          />
        </Circle>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  lens: { position: 'absolute', overflow: 'hidden', backgroundColor: 'rgba(30,26,43,0.55)' },
  word: { position: 'absolute' },
});
