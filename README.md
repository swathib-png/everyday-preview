# Everyday

A window, not an app. Leave a short video for Future You, hear as much of Past You as you want,
and feel your way through the rest. Design: the Figma file "Everyday — Persona & IA".

Expo SDK 58 · React Native 0.88 · TypeScript · Skia · one codebase for iOS, Android and web.

## Running it without installing anything on your laptop

### 1. Preview on your phone with Expo Snack (fastest)
1. Put this folder on GitHub (a private repo is fine).
2. Go to <https://snack.expo.dev>, choose **Import git repository**, and paste the repo URL.
3. Install **Expo Go** on your phone, then scan the QR code shown in Snack (the "My Device" tab).

Everything in v1 runs inside Expo Go: Skia, camera recording, video, haptics, the accelerometer,
secure storage and local notifications. Use a real phone — the haptics and face-down sending
don't exist in a browser or simulator.

### 2. Real installable builds with EAS (cloud)
1. Create a free account at <https://expo.dev> and connect the GitHub repo
   (Project → GitHub → link repository).
2. Trigger a build from the expo.dev dashboard: profile `preview`.
   iOS needs an Apple Developer account ($99/yr); Android works without one.
3. Install from the link or QR code EAS gives you.

Builds run on Expo's servers, not on your laptop.

## How the app is organised

There are no screens, only one pane of glass in one of eleven states
(`src/core/machine.ts`). Gestures and timers send events; the reducer decides where the pane goes.

| Gesture | What it does | Feel |
| --- | --- | --- |
| touch + hold | hear Past You: word (1.5 s) → a line (4 s) → all (8 s) | heartbeat, tick |
| let go | stop; with nobody waiting, holding is how you start your turn | — |
| swipe up (your turn) | done talking → write | — |
| swipe down (your turn) | cancel, recording discarded | — |
| write with a finger | one word, then optionally a note for later | chalk |
| set the phone face-down | send | exhale |
| swipe a note up / away | i'll try / not today | soft tap |
| double tap after two taps | meds taken | two taps |
| three+ fingers held (palm) | help, from anywhere | breath |
| pull down from the top | the back of the glass (settings) | detents |

Every gesture is also a named VoiceOver / TalkBack action. Two-finger tap sends when there's no
accelerometer.

```
App.tsx                 the pane: wires gestures, moments and data together
src/core/               pure TypeScript rules — state machine, hold depth, doors, meds, waiting room
src/adapters/           platform edges — haptics, face-down, storage, keychain, notifications
src/pane/               the glass — light field (Skia), clearing, handwriting, touch surface
src/moments/            recorder, safety kit (cover), back of the glass, first minute
src/safety/             crisis lines by country, offline
```

Tests for the rules live in `src/core/__tests__` (`npm test` once dependencies are installed —
e.g. in a cloud dev environment or CI, not necessarily your laptop).

## Known gaps in this first version (on purpose, or for later)
- **Not compiled yet.** It was written without installing anything, so the first Snack / EAS run
  is the first compile. Expect a round of small fixes.
- **Encryption at rest:** videos and handwriting rely on the OS sandbox and iOS Data Protection.
  Encrypting with a key from the keychain is a TODO before launch.
- **Haptics:** composed from `expo-haptics` primitives. A Core Haptics (AHAP) /
  `VibrationEffect.Composition` adapter will make them richer. "Hum follows your voice" is a slow
  pulse for now — the camera API doesn't expose live audio levels.
- **Palm detection** is "three or more fingers held for 0.6 s" — React Native doesn't expose
  touch size.
- **Meds time** cycles through presets (off, 8 am, 12 pm, 9 pm) at the back of the glass.
- **Captions** for Past You's video need on-device transcription (v1.1).
- **Home-screen widget glow** needs a native module and a custom build (later).
- **Check on a real Android phone:** whether face-down sending fires (the accelerometer's z sign
  may differ from iOS — see `src/adapters/motion.ts`), and whether the frost blurs the camera
  preview (some Android camera surfaces can't be blurred).
- **Clinical review needed** before anyone uses this: crisis numbers, the three-skip meds card,
  and all safety wording.

This is a wellness companion, not a medical device or a treatment.
