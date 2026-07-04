// Login/signup entry. Two paths: Google (compliant white "Continue with Google" button) and
// phone-number OTP (SMS or WhatsApp). New users are routed to profile setup afterward.
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { sendPhoneOtp, signInWithGoogle, verifyPhoneOtp } from '@/lib/auth-account';

type Step = 'choose' | 'phone' | 'otp';
type Channel = 'sms' | 'whatsapp';

export function LoginScreen() {
  const [step, setStep] = useState<Step>('choose');
  const [phone, setPhone] = useState('');
  const [channel, setChannel] = useState<Channel>('sms');
  const [sentTo, setSentTo] = useState(''); // normalized E.164 the code was sent to
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onGoogle() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error: e } = await signInWithGoogle();
    if (e) setError(e);
    setBusy(false);
  }

  async function onSendCode() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error: e, e164 } = await sendPhoneOtp(phone, channel);
    setBusy(false);
    if (e || !e164) {
      setError(e ?? 'Could not send the code.');
      return;
    }
    setSentTo(e164);
    setOtp('');
    setStep('otp');
  }

  async function onVerify() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error: e } = await verifyPhoneOtp(sentTo, otp);
    setBusy(false);
    if (e) setError(e);
    // On success the auth listener flips the session; the app (or profile setup) renders.
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.hero}>
          <Image
            source={require('@/assets/images/logo-horizontal.png')}
            style={styles.logo}
            contentFit="contain"
            accessibilityLabel="Bahria Tenders"
          />
          <ThemedText type="small" themeColor="textSecondary" style={styles.tagline}>
            Hire trusted tradesmen — or offer your services.
          </ThemedText>
        </View>

        <View style={styles.form}>
          {error && (
            <ThemedText type="small" style={styles.error}>
              {error}
            </ThemedText>
          )}

          {step === 'choose' && (
            <>
              <Pressable
                onPress={onGoogle}
                disabled={busy}
                style={({ pressed }) => [styles.googleButton, pressed && styles.pressed]}>
                <Image
                  source={require('@/assets/images/google-g.png')}
                  style={styles.googleG}
                  contentFit="contain"
                />
                <ThemedText type="default" style={styles.googleLabel}>
                  {busy ? 'Opening Google…' : 'Continue with Google'}
                </ThemedText>
              </Pressable>

              <View style={styles.divider}>
                <View style={styles.divLine} />
                <ThemedText type="small" themeColor="textSecondary">
                  or
                </ThemedText>
                <View style={styles.divLine} />
              </View>

              <Pressable
                onPress={() => {
                  setError(null);
                  setStep('phone');
                }}
                style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}>
                <MaterialCommunityIcons name="cellphone" size={20} color={Brand.primary} />
                <ThemedText type="default" style={styles.outlineLabel}>
                  Continue with phone number
                </ThemedText>
              </Pressable>
            </>
          )}

          {step === 'phone' && (
            <>
              <ThemedText type="smallBold">Enter your mobile number</ThemedText>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="03001234567"
                placeholderTextColor="#60646C"
                keyboardType="phone-pad"
                autoFocus
                style={styles.input}
              />
              <View style={styles.channelRow}>
                {(['sms', 'whatsapp'] as Channel[]).map((c) => {
                  const on = channel === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setChannel(c)}
                      style={[styles.chip, on ? styles.chipOn : styles.chipOff]}>
                      <MaterialCommunityIcons
                        name={c === 'whatsapp' ? 'whatsapp' : 'message-text-outline'}
                        size={16}
                        color={on ? '#ffffff' : Brand.primary}
                      />
                      <ThemedText type="smallBold" style={on ? styles.chipLabelOn : styles.chipLabelOff}>
                        {c === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                onPress={onSendCode}
                disabled={busy}
                style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
                <ThemedText type="default" numberOfLines={1} style={styles.buttonLabel}>
                  {busy ? 'Sending…' : 'Send code'}
                </ThemedText>
              </Pressable>
              <Pressable onPress={() => setStep('choose')} hitSlop={8} style={styles.link}>
                <ThemedText type="smallBold" style={{ color: Brand.primary }}>
                  Back
                </ThemedText>
              </Pressable>
            </>
          )}

          {step === 'otp' && (
            <>
              <ThemedText type="smallBold">Enter the code</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Sent to {sentTo} via {channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}.
              </ThemedText>
              <TextInput
                value={otp}
                onChangeText={setOtp}
                placeholder="123456"
                placeholderTextColor="#60646C"
                keyboardType="number-pad"
                autoFocus
                maxLength={6}
                style={styles.input}
              />
              <Pressable
                onPress={onVerify}
                disabled={busy}
                style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
                <ThemedText type="default" numberOfLines={1} style={styles.buttonLabel}>
                  {busy ? 'Verifying…' : 'Verify'}
                </ThemedText>
              </Pressable>
              <View style={styles.otpLinks}>
                <Pressable onPress={() => setStep('phone')} hitSlop={8}>
                  <ThemedText type="smallBold" style={{ color: Brand.primary }}>
                    Change number
                  </ThemedText>
                </Pressable>
                <Pressable onPress={onSendCode} hitSlop={8} disabled={busy}>
                  <ThemedText type="smallBold" style={{ color: Brand.primary }}>
                    Resend code
                  </ThemedText>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.four },
  hero: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', gap: Spacing.two },
  logo: { width: '100%', height: 180 },
  tagline: { textAlign: 'center' },
  form: { flex: 1, justifyContent: 'flex-start', gap: Spacing.three, paddingTop: Spacing.five },
  error: { color: '#c0392b', textAlign: 'center' },
  // Google-branding-compliant: white surface, neutral border, official 4-color "G", dark label.
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dadce0',
    borderRadius: Spacing.three,
    minHeight: 52,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
  googleG: { width: 20, height: 20 },
  googleLabel: { color: '#3c4043' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  divLine: { flex: 1, height: 1, backgroundColor: '#cfc8b6' },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: Brand.primary,
    minHeight: 52,
  },
  outlineLabel: { color: Brand.primary },
  input: {
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: Spacing.two,
    padding: Spacing.three,
    fontSize: 18,
    minHeight: 52,
  },
  channelRow: { flexDirection: 'row', gap: Spacing.two },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: Brand.primary,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: 44,
  },
  chipOn: { backgroundColor: Brand.primary },
  chipOff: { backgroundColor: 'transparent' },
  chipLabelOn: { color: '#ffffff' },
  chipLabelOff: { color: Brand.primary },
  button: {
    marginTop: Spacing.one,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  buttonLabel: { color: '#ffffff' },
  link: { alignItems: 'center', paddingVertical: Spacing.two },
  otpLinks: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: Spacing.two },
  pressed: { opacity: 0.7 },
});
