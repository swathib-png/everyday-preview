import type { ReactNode } from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';

import { sky, typeScale } from '../theme';

type Props = {
  children: ReactNode;
  dark?: boolean; // on a night pane
  size?: 'whisper' | 'word' | 'hero';
  faint?: boolean;
  style?: TextStyle;
};

// The app's voice: a few lowercase words, never instructions in sentences.
export function Whisper({ children, dark, size = 'whisper', faint, style }: Props) {
  const color = dark ? sky.white : sky.ink;
  const opacity = faint ? 0.45 : size === 'whisper' ? 0.6 : 0.9;
  return (
    <Text
      style={[styles.base, typeScale[size], { color, opacity }, style]}
      accessibilityRole="text"
      allowFontScaling
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: { textAlign: 'center' },
});
