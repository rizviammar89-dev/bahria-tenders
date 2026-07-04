// Google Play "prominent disclosure" for location: before the OS permission prompt fires, we show an
// in-app screen explaining what location is used for — and, for providers, that it is SHARED with
// residents. Required by Play policy for location (and especially location shared with other users);
// the OS prompt + privacy policy alone are not sufficient.
//
// Usage: wrap the app in <LocationConsentProvider>, then in any screen:
//   const { requestLocationConsent } = useLocationConsent();
//   if (!(await requestLocationConsent('provider'))) return; // user declined
//   const granted = await requestForegroundPermission();     // now the OS prompt
// The disclosure is shown once per kind (persisted), then resolves true immediately thereafter.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';

type Kind = 'provider' | 'resident';
const seenKey = (k: Kind) => `locationDisclosureSeen.v1.${k}`;

const COPY: Record<Kind, { title: string; body: string }> = {
  provider: {
    title: 'Sharing your location',
    body:
      'When you turn on “Available”, Bahria Tenders shares your live location with nearby residents ' +
      'so they can find you on the map and contact you. Sharing stops the moment you go Unavailable, ' +
      'and we only access your location while the app is open.',
  },
  resident: {
    title: 'Using your location',
    body:
      'Bahria Tenders uses your device location to show providers near you and to attach an accurate ' +
      'location to the jobs you post. We only access your location while the app is open.',
  },
};

type ConsentApi = { requestLocationConsent: (kind: Kind) => Promise<boolean> };
const Ctx = createContext<ConsentApi>({ requestLocationConsent: async () => true });
export const useLocationConsent = () => useContext(Ctx);

export function LocationConsentProvider({ children }: { children: ReactNode }) {
  const [kind, setKind] = useState<Kind | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const requestLocationConsent = useCallback(async (k: Kind): Promise<boolean> => {
    const seen = await AsyncStorage.getItem(seenKey(k)).catch(() => null);
    if (seen) return true;
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setKind(k);
    });
  }, []);

  const finish = useCallback((accepted: boolean) => {
    const r = resolver.current;
    resolver.current = null;
    setKind((k) => {
      if (accepted && k) AsyncStorage.setItem(seenKey(k), '1').catch(() => {});
      return null;
    });
    r?.(accepted);
  }, []);

  const copy = kind ? COPY[kind] : null;

  return (
    <Ctx.Provider value={{ requestLocationConsent }}>
      {children}
      <Modal
        visible={kind !== null}
        transparent
        animationType="fade"
        onRequestClose={() => finish(false)}>
        <View style={styles.backdrop}>
          <ThemedView style={styles.card}>
            <ThemedText type="subtitle" style={styles.title}>
              {copy?.title}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
              {copy?.body}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
              See our Privacy Policy for details. You can change this anytime in your device settings.
            </ThemedText>
            <Pressable
              onPress={() => finish(true)}
              style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
              <ThemedText type="default" style={styles.primaryLabel}>
                Continue
              </ThemedText>
            </Pressable>
            <Pressable onPress={() => finish(false)} hitSlop={8} style={styles.secondary}>
              <ThemedText type="smallBold" style={{ color: Brand.primary }}>
                Not now
              </ThemedText>
            </Pressable>
          </ThemedView>
        </View>
      </Modal>
    </Ctx.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  card: { width: '100%', maxWidth: 420, borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.three },
  title: { textAlign: 'center' },
  body: { lineHeight: 22 },
  primary: {
    backgroundColor: Brand.primary,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  primaryLabel: { color: '#ffffff' },
  secondary: { alignItems: 'center', paddingVertical: Spacing.two },
  pressed: { opacity: 0.7 },
});
