import { Blur, Canvas, Group, Path, Skia } from '@shopify/react-native-skia';
import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { feel } from '../adapters/haptics';
import type { Stroke } from '../core/types';
import { sky } from '../theme';

type Pt = { x: number; y: number };

// Smooth a finger trail into SVG path data using midpoint quadratics.
export function toPath(points: Pt[]): Stroke {
  if (points.length === 0) return '';
  const [p0] = points;
  if (points.length === 1) return `M${p0.x} ${p0.y} L${p0.x + 0.1} ${p0.y + 0.1}`;
  let d = `M${p0.x} ${p0.y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    d += ` Q${a.x} ${a.y} ${(a.x + b.x) / 2} ${(a.y + b.y) / 2}`;
  }
  const last = points[points.length - 1];
  d += ` L${last.x} ${last.y}`;
  return d;
}

// Writing on the fog. The touch layer feeds start / move / end; this keeps the strokes.
export function useInk() {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [live, setLive] = useState<Stroke>('');
  const pts = useRef<Pt[]>([]);
  const lastChalk = useRef(0);

  const start = useCallback((x: number, y: number) => {
    pts.current = [{ x, y }];
    setLive(toPath(pts.current));
  }, []);

  const move = useCallback((x: number, y: number) => {
    const prev = pts.current[pts.current.length - 1];
    if (prev && Math.hypot(prev.x - x, prev.y - y) < 2) return;
    pts.current.push({ x, y });
    setLive(toPath(pts.current));
    // Chalk under your fingertip, at most ~30 ms apart.
    const now = Date.now();
    if (now - lastChalk.current > 30) {
      lastChalk.current = now;
      feel('chalk');
    }
  }, []);

  const end = useCallback(() => {
    if (pts.current.length > 0) {
      const d = toPath(pts.current);
      setStrokes((s) => [...s, d]);
    }
    pts.current = [];
    setLive('');
  }, []);

  const clear = useCallback(() => {
    pts.current = [];
    setLive('');
    setStrokes([]);
  }, []);

  return { strokes, live, start, move, end, clear };
}

// Live strokes in screen coordinates: a wiped trail through the fog, then the line itself.
export function InkLayer({ strokes, live, dark = true }: { strokes: Stroke[]; live: Stroke; dark?: boolean }) {
  const all = useMemo(() => [...strokes, live].filter(Boolean), [strokes, live]);
  const paths = useMemo(() => all.map((d) => Skia.Path.MakeFromSVGString(d)).filter(Boolean), [all]);
  const ink = dark ? sky.white : sky.ink;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        {paths.map((p, i) => (
          <Group key={i}>
            <Path path={p!} style="stroke" strokeWidth={30} strokeCap="round" strokeJoin="round" color={sky.white} opacity={dark ? 0.12 : 0.35}>
              <Blur blur={6} />
            </Path>
            <Path path={p!} style="stroke" strokeWidth={4.5} strokeCap="round" strokeJoin="round" color={ink} opacity={0.92} />
          </Group>
        ))}
      </Canvas>
    </View>
  );
}

// Saved handwriting, scaled to fit a box — Past You's word, or your note from days ago.
export function InkView({
  strokes,
  width,
  height,
  color = sky.white,
}: {
  strokes: Stroke[];
  width: number;
  height: number;
  color?: string;
}) {
  const fitted = useMemo(() => {
    const paths = strokes.map((d) => Skia.Path.MakeFromSVGString(d)).filter(Boolean);
    if (paths.length === 0) return null;
    // Skia 2 paths are immutable; combine them with a builder to measure the whole word.
    const builder = Skia.PathBuilder.Make();
    paths.forEach((p) => builder.addPath(p!));
    const b = builder.build().computeTightBounds();
    const bw = Math.max(b.width, 1);
    const bh = Math.max(b.height, 1);
    const scale = Math.min((width * 0.85) / bw, (height * 0.85) / bh, 1.6);
    const tx = (width - bw * scale) / 2 - b.x * scale;
    const ty = (height - bh * scale) / 2 - b.y * scale;
    return { paths, scale, tx, ty };
  }, [strokes, width, height]);

  if (!fitted) return null;
  return (
    <Canvas style={{ width, height }} pointerEvents="none">
      <Group transform={[{ translateX: fitted.tx }, { translateY: fitted.ty }, { scale: fitted.scale }]}>
        {fitted.paths.map((p, i) => (
          <Path
            key={i}
            path={p!}
            style="stroke"
            strokeWidth={4.5 / fitted.scale}
            strokeCap="round"
            strokeJoin="round"
            color={color}
            opacity={0.92}
          />
        ))}
      </Group>
    </Canvas>
  );
}
