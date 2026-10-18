import { Accelerometer } from 'expo-sensors';

// Face-down is send. We read gravity on the z axis: lying screen-up z ≈ -1, screen-down z ≈ +1
// (expo-sensors reports both platforms in the iOS convention).
// The phone must stay face-down for `holdMs` so a wobble doesn't send anything.
export const FACE_DOWN_Z = 0.8;

export function watchFaceDown(onFaceDown: () => void, holdMs = 700): () => void {
  let since: number | null = null;
  let done = false;
  Accelerometer.setUpdateInterval(100);
  const sub = Accelerometer.addListener(({ z }) => {
    if (done) return;
    if (z > FACE_DOWN_Z) {
      since ??= Date.now();
      if (Date.now() - since >= holdMs) {
        done = true;
        onFaceDown();
      }
    } else {
      since = null;
    }
  });
  return () => sub.remove();
}
