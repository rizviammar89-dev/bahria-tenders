// Shown after OTP verification when the user has no profile yet (i.e. they just signed up).
// Collects name + role + precinct (+ trades for providers); phone already came from the OTP step.
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useState, type ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { completeProfile } from '@/lib/auth-account';
import { fetchServices, type Service } from '@/lib/jobs';
import type { Role } from '@/lib/role-tabs';
import { supabase } from '@/lib/supabase';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
const TRADE_ICON: Record<string, IconName> = {
  ac_technician: 'air-conditioner',
  plumber: 'pipe-wrench',
  carpenter: 'hammer',
  electrician: 'flash',
  mason: 'wall',
  painter: 'format-paint',
  aluminium_glass: 'window-closed-variant',
  fumigation: 'spray',
  welding: 'fence',
};

export function ProfileSetupScreen() {
  const theme = useTheme();
  const { refreshRole, session } = useAuth();
  const [role, setRole] = useState<Exclude<Role, null>>('resident');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [precinct, setPrecinct] = useState('');
  const [services, setServices] = useState<Service[]>([]);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchServices().then(({ services: rows }) => {
      if (!cancelled) setServices(rows);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleService(id: string) {
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  async function onSubmit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error: e } = await completeProfile({
      userId: session?.user?.id ?? '',
      name,
      role,
      precinct,
      serviceIds,
      phone,
    });
    if (e) {
      setError(e);
      setBusy(false);
      return;
    }
    refreshRole(); // hasProfile flips true → the Gate swaps to the app
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="subtitle">Set up your profile</ThemedText>

          <ThemedText type="smallBold">I want to…</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            You can do both — switch between hiring and offering services anytime from the home
            screen.
          </ThemedText>
          <View style={styles.roleRow}>
            {(['resident', 'provider'] as const).map((r) => {
              const selected = role === r;
              return (
                <Pressable
                  key={r}
                  onPress={() => setRole(r)}
                  style={({ pressed }) => [
                    styles.roleButton,
                    {
                      backgroundColor: selected ? Brand.primary : theme.backgroundElement,
                      borderColor: selected ? Brand.primary : theme.backgroundSelected,
                    },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold" style={selected ? styles.selectedLabel : undefined}>
                    {r === 'resident' ? 'Hire a tradesman' : 'Offer my services'}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <ThemedText type="smallBold">Full name</ThemedText>
          <TextInput value={name} onChangeText={setName} placeholder="e.g. Ali Khan" style={styles.input} />

          <ThemedText type="smallBold">Phone number</ThemedText>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="0300 1234567"
            keyboardType="phone-pad"
            autoComplete="tel"
            style={styles.input}
          />

          <ThemedText type="smallBold">Precinct</ThemedText>
          <TextInput
            value={precinct}
            onChangeText={setPrecinct}
            placeholder="e.g. Precinct 10"
            style={styles.input}
          />

          {role === 'provider' && (
            <>
              <ThemedText type="smallBold">Your trade(s)</ThemedText>
              <View style={styles.grid}>
                {services.map((s) => {
                  const selected = serviceIds.includes(s.id);
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => toggleService(s.id)}
                      style={({ pressed }) => [
                        styles.tile,
                        {
                          backgroundColor: selected ? Brand.primary : theme.backgroundElement,
                          borderColor: selected ? Brand.primary : theme.backgroundSelected,
                        },
                        pressed && styles.pressed,
                      ]}>
                      <MaterialCommunityIcons
                        name={TRADE_ICON[s.slug] ?? 'toolbox-outline'}
                        size={26}
                        color={selected ? '#ffffff' : Brand.accent}
                      />
                      <ThemedText type="small" style={selected ? styles.selectedLabel : undefined}>
                        {s.display_en}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {error && (
            <ThemedText type="small" style={styles.error}>
              {error}
            </ThemedText>
          )}

          <Pressable
            onPress={onSubmit}
            disabled={busy}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
            <ThemedText type="default" style={styles.buttonLabel}>
              {busy ? 'Saving…' : 'Finish'}
            </ThemedText>
          </Pressable>

          <Pressable onPress={() => supabase.auth.signOut()} hitSlop={8} style={styles.backLink}>
            <ThemedText type="small" style={styles.backLabel}>
              Use a different account
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: { padding: Spacing.four, gap: Spacing.three },
  roleRow: { flexDirection: 'row', gap: Spacing.two },
  roleButton: {
    flex: 1,
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingVertical: Spacing.three,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedLabel: { color: '#ffffff' },
  input: {
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: Spacing.two,
    padding: Spacing.three,
    fontSize: 18,
    minHeight: 52,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tile: {
    width: '31%',
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.one,
    minHeight: 84,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
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
