import { Blur, Canvas, Circle, Rect } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { fields, lightColor, sky, type Light } from '../theme';

type Props = {
  kind: 'day' | 'night' | 'help';
  light: Light;
  strength?: number; // 0..1, how present the meaning-light is
  breathe?: boolean; // 4 s in, 6 s out — used by the safety kit
};

// The pane: a soft field of sunset light, one meaningful light, and frost over all of it.
export function Field({ kind, light, strength = 1, breathe = false }: Props) {
  const { width: w, height: h } = useWindowDimensions();
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = breathe
      ? withRepeat(
          withSequence(
            withTiming(1.25, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
            withTiming(0.85, { duration: 6000, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
        )
      : withRepeat(
          withSequence(
            withTiming(1.06, { duration: 5000, easing: Easing.inOut(Easing.sin) }),
            withTiming(0.96, { duration: 5000, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
        );
    return () => cancelAnimation(pulse);
  }, [breathe, pulse]);

  const lightR = useDerivedValue(() => Math.min(w, h) * 0.3 * pulse.value);
  const lc = lightColor[light];
  const base = kind === 'night' ? sky.night : sky.paper;
  const frost = kind === 'night' ? 0.06 : 0.22;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        <Rect x={0} y={0} width={w} height={h} color={base} />
        {fields[kind].map((b, i) => (
          <Circle key={i} cx={b.x * w} cy={b.y * h} r={b.r * w} color={b.color} opacity={b.opacity}>
            <Blur blur={b.r * w * 0.45} />
          </Circle>
        ))}
        {lc ? (
          <Circle cx={w * 0.45} cy={h * 0.36} r={lightR} color={lc} opacity={0.9 * strength}>
            <Blur blur={70} />
          </Circle>
        ) : null}
        <Rect x={0} y={0} width={w} height={h} color={sky.white} opacity={frost} />
      </Canvas>
    </View>
  );
}
