// Google-only login/signup entry. One tap → Google account picker → session. New users are routed
// to profile setup afterward. No phone-OTP, no password — logins never cost an SMS.
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { signInWithGoogle } from '@/lib/auth-account';

export function LoginScreen() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onGoogle() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error: e } = await signInWithGoogle();
    if (e) setError(e);
    // On success the auth listener flips the session; the app (or profile setup) renders.
    setBusy(false);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Image
          source={require('@/assets/images/logo-horizontal.png')}
          style={styles.logo}
          contentFit="contain"
          accessibilityLabel="Bahria Tenders"
        />
        <ThemedText type="small" themeColor="textSecondary" style={styles.tagline}>
          Continue with Google to log in or sign up.
        </ThemedText>

        {error && (
          <ThemedText type="small" style={styles.error}>
            {error}
          </ThemedText>
        )}

        <Pressable
          onPress={onGoogle}
          disabled={busy}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <ThemedText type="default" style={styles.buttonLabel}>
            {busy ? 'Opening Google…' : 'Continue with Google'}
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, gap: Spacing.three, justifyContent: 'center' },
  logo: { width: '100%', height: 190, marginBottom: Spacing.two },
  tagline: { textAlign: 'center' },
  error: { color: '#c0392b', textAlign: 'center' },
  button: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  buttonLabel: { color: '#ffffff' },
  pressed: { opacity: 0.7 },
});
