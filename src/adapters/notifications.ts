import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { ReminderLevel, Settings } from '../core/types';

// Reminders whisper. Nothing on the lock screen says "meds" or "depression":
// the text is deliberately vague so a glance over your shoulder reveals nothing.
const MEDS_ID = 'everyday-meds';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('quiet', {
    name: 'Quiet',
    importance: Notifications.AndroidImportance.LOW,
    sound: null,
    enableVibrate: false,
    showBadge: false,
  });
}

export async function scheduleMeds(time: Settings['medsTime'], level: ReminderLevel) {
  await Notifications.cancelScheduledNotificationAsync(MEDS_ID).catch(() => undefined);
  // "Glow" means the app never notifies at all — the glass just turns warm when you open it.
  if (!time || level === 'glow') return;

  const perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return;
  await ensureChannel();

  await Notifications.scheduleNotificationAsync({
    identifier: MEDS_ID,
    content: {
      title: 'Everyday',
      body: 'whenever you’re ready',
      sound: false,
      interruptionLevel: level === 'nudge' ? 'active' : 'passive',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: time.hour,
      minute: time.minute,
      channelId: 'quiet',
    },
  });
}
