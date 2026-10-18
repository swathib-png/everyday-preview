import { BlurTargetView, BlurView } from 'expo-blur';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useEffect, useRef, type RefObject } from 'react';
import { StyleSheet, View, type ViewInstance } from 'react-native';

export type Recording = Promise<{ uri: string } | undefined>;
export type RecordingHandle = { promise: Recording | null };

const MAX_SECONDS = 5 * 60;

type Props = {
  selfView: boolean;
  handle: RefObject<RecordingHandle>;
  onUnavailable: () => void;
};

// Your turn. The camera records, but you only ever see yourself as a blur behind frost —
// a window, never a mirror — unless you turn self-view on at the back of the glass.
// Recording stops when this unmounts (leaving "your turn" for any reason).
export function Recorder({ selfView, handle, onUnavailable }: Props) {
  const [cam, requestCam] = useCameraPermissions();
  const [mic, requestMic] = useMicrophonePermissions();
  const camera = useRef<CameraView>(null);
  // React clears `camera` before unmount cleanups run, so keep the recording camera separately.
  const active = useRef<CameraView | null>(null);
  const target = useRef<ViewInstance>(null);
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current || !cam || !mic) return;
    asked.current = true;
    (async () => {
      const c = cam.granted ? cam : await requestCam();
      const m = mic.granted ? mic : await requestMic();
      if (!c.granted || !m.granted) onUnavailable();
    })();
  }, [cam, mic, requestCam, requestMic, onUnavailable]);

  useEffect(() => () => active.current?.stopRecording(), []);

  const start = () => {
    if (!camera.current || !handle.current || handle.current.promise) return;
    active.current = camera.current;
    handle.current.promise = camera.current
      .recordAsync({ maxDuration: MAX_SECONDS })
      .catch(() => undefined);
  };

  if (!cam?.granted || !mic?.granted) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <BlurTargetView ref={target} style={StyleSheet.absoluteFill}>
        <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="front" mode="video" onCameraReady={start} />
      </BlurTargetView>
      {selfView ? null : (
        <BlurView
          intensity={95}
          tint="dark"
          blurTarget={target}
          blurMethod="dimezisBlurViewSdk31Plus"
          style={StyleSheet.absoluteFill}
        />
      )}
      <View style={[StyleSheet.absoluteFill, styles.dusk]} />
    </View>
  );
}

const styles = StyleSheet.create({
  dusk: { backgroundColor: 'rgba(30,26,43,0.35)' },
});
