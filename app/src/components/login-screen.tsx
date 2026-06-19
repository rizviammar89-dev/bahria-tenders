// Phone-OTP login/signup entry. Enter your number → get a one-time code → verify. Same flow for
// new and returning users; new users are routed to profile setup afterward (no PIN).
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { sendPhoneOtp, verifyPhoneOtp } from '@/lib/auth-otp';

export function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false); // false = entering phone, true = entering the code
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSendCode() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error: e } = await sendPhoneOtp(phone);
    if (e) setError(e);
    else setSent(true);
    setBusy(false);
  }

  async function onVerify() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error: e } = await verifyPhoneOtp(phone, code);
    if (e) {
      setError(e);
      setBusy(false);
      return;
    }
    // Success: the auth listener flips the session; the app (or profile setup) renders.
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
          {sent
            ? `Enter the code sent to ${phone}.`
            : 'Enter your phone number to log in or sign up.'}
        </ThemedText>

        {!sent ? (
          <>
            <ThemedText type="smallBold">Phone number</ThemedText>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="0300 1234567"
              keyboardType="phone-pad"
              autoComplete="tel"
              style={styles.input}
            />
            {error && (
              <ThemedText type="small" style={styles.error}>
                {error}
              </ThemedText>
            )}
            <Pressable
              onPress={onSendCode}
              disabled={busy}
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
              <ThemedText type="default" style={styles.buttonLabel}>
                {busy ? 'Sending…' : 'Send code'}
              </ThemedText>
            </Pressable>
          </>
        ) : (
          <>
            <ThemedText type="smallBold">Verification code</ThemedText>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="123456"
              keyboardType="number-pad"
              style={styles.input}
            />
            {error && (
              <ThemedText type="small" style={styles.error}>
                {error}
              </ThemedText>
            )}
            <Pressable
              onPress={onVerify}
              disabled={busy}
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
              <ThemedText type="default" style={styles.buttonLabel}>
                {busy ? 'Verifying…' : 'Verify & continue'}
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => {
                setSent(false);
                setCode('');
                setError(null);
              }}
              hitSlop={8}
              style={styles.backLink}>
              <ThemedText type="small" style={styles.backLabel}>
                Use a different number
              </ThemedText>
            </Pressable>
          </>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, gap: Spacing.three, justifyContent: 'center' },
  logo: { width: '100%', height: 190, marginBottom: Spacing.two },
  tagline: { textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: Spacing.two,
    padding: Spacing.three,
    fontSize: 18,
    minHeight: 52,
  },
  error: { color: '#c0392b' },
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
  backLink: { alignItems: 'center', paddingVertical: Spacing.two },
  backLabel: { color: Brand.primary, textDecorationLine: 'underline' },
  pressed: { opacity: 0.7 },
});
