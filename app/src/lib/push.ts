// Story 1.1 (AC-6): minimal Expo push registration for the FCM-on-budget-Android spike.
// SDK 56: remote push needs a development build (NOT Expo Go on Android), and on
// Android 13+ a notification channel MUST be set before requesting a push token.
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { Brand } from '@/constants/theme';
import { currentUserId } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export type PushResult =
  | { ok: true; token: string }
  | { ok: false; reason: string };

/**
 * Registers the device for Expo push and returns the Expo push token.
 * Returns a structured failure (never throws) so the spike screen can render the reason.
 */
export async function registerForPushAsync(): Promise<PushResult> {
  if (!Device.isDevice) {
    return { ok: false, reason: 'Must use a physical device — emulators cannot receive remote push.' };
  }

  // Android 13+: channel must exist before getExpoPushTokenAsync.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Job alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: Brand.primary,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') {
    return { ok: false, reason: `Notification permission not granted (status: ${status}).` };
  }

  // projectId is required for the token to be attributed to this EAS project.
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    return {
      ok: false,
      reason: 'Missing EAS projectId — run `eas init` / `eas build` so it is set in app config.',
    };
  }

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { ok: true, token: data };
  } catch (e) {
    return { ok: false, reason: `getExpoPushTokenAsync failed: ${String(e)}` };
  }
}

/**
 * Story 2.5: register for push and persist the token so the broadcast dispatcher can reach this
 * device. Non-fatal — never throws, never blocks the app (residents store one too; harmless).
 */
export async function savePushToken(): Promise<void> {
  const result = await registerForPushAsync();
  if (!result.ok) return; // e.g. emulator / permission denied — silently skip
  const uid = await currentUserId();
  if (!uid) return;
  const { error } = await supabase
    .from('push_tokens')
    .upsert(
      { user_id: uid, expo_push_token: result.token, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  if (error) console.warn('savePushToken upsert failed:', error.message);
}
