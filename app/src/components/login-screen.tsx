// Story 1.4: phone + PIN login. Normalizes the phone, derives the synthetic auth email,
// and signs in. No self-signup, no OTP (POC: the founder provisions accounts).
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { normalizePkPhone, phoneToSyntheticEmail } from '@/lib/phone';
import { supabase } from '@/lib/supabase';

export function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onLogin() {
    setBusy(true);
    setError(null);
    const e164 = normalizePkPhone(phone);
    if (!e164) {
      setError('Please enter a valid mobile number, like 0300 1234567.');
      setBusy(false);
      return;
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: phoneToSyntheticEmail(e164),
      password: pin,
    });
    if (signInError) {
      setError('Phone or PIN is incorrect.');
    }
    // On success, the auth listener flips the session and the app renders.
    setBusy(false);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          Bahria Tenders
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Log in with your phone number and PIN.
        </ThemedText>

        <ThemedText type="smallBold">Phone number</ThemedText>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="0300 1234567"
          keyboardType="phone-pad"
          autoComplete="tel"
          style={styles.input}
        />

        <ThemedText type="smallBold">PIN</ThemedText>
        <TextInput
          value={pin}
          onChangeText={setPin}
          placeholder="••••"
          keyboardType="number-pad"
          secureTextEntry
          style={styles.input}
        />

        {error && (
          <ThemedText type="small" style={styles.error}>
            {error}
          </ThemedText>
        )}

        <Pressable
          onPress={onLogin}
          disabled={busy}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <ThemedText type="default" style={styles.buttonLabel}>
            {busy ? 'Logging in…' : 'Log in'}
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four, gap: Spacing.three, justifyContent: 'center' },
  title: { textAlign: 'center' },
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
    backgroundColor: '#208AEF',
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  buttonLabel: { color: '#ffffff' },
  pressed: { opacity: 0.7 },
});
