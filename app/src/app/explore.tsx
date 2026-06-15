// Story 1.1 (AC-6): the push spike screen.
// On the dev build, tap "Register for push", copy the Expo push token, then send a
// test push via `https://exp.host/--/api/v2/push/send`. Background the app ~12h and confirm delivery.
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { registerForPushAsync } from '@/lib/push';

export default function PushSpikeScreen() {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onRegister() {
    setBusy(true);
    setError(null);
    const result = await registerForPushAsync();
    if (result.ok) {
      setToken(result.token);
    } else {
      setError(result.reason);
    }
    setBusy(false);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="subtitle">Push Spike</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Story 1.1 · FCM-on-budget-Android gate. Remote push requires a dev build (not Expo Go on
            Android).
          </ThemedText>

          <Pressable
            onPress={onRegister}
            disabled={busy}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
            <ThemedText type="default" style={styles.buttonLabel}>
              {busy ? 'Registering…' : 'Register for push'}
            </ThemedText>
          </Pressable>

          {token && (
            <ThemedView type="backgroundElement" style={styles.box}>
              <ThemedText type="smallBold">Expo push token</ThemedText>
              <ThemedText type="code" selectable>
                {token}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Long-press to select &amp; copy, then send a test push to this token.
              </ThemedText>
            </ThemedView>
          )}

          {error && (
            <ThemedView type="backgroundElement" style={styles.box}>
              <ThemedText type="smallBold">Not registered</ThemedText>
              <ThemedText type="small">{error}</ThemedText>
            </ThemedView>
          )}

          {Platform.OS !== 'android' && (
            <ThemedText type="small" themeColor="textSecondary">
              Note: this gate targets budget Android. Run it on the Android dev build.
            </ThemedText>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: { padding: Spacing.four, gap: Spacing.three },
  button: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    backgroundColor: Brand.primary,
    alignItems: 'center',
  },
  buttonLabel: { color: '#ffffff' },
  pressed: { opacity: 0.7 },
  box: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
});
