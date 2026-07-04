// Edit an existing profile after signup: name + precinct for everyone, plus trade(s) for providers.
// Writes only the client-updatable columns (RLS grants update on full_name, precinct, service_ids).
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useState, type ComponentProps } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { fetchServices, type Service } from '@/lib/jobs';
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

export function EditProfileModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const { session, role, refreshRole } = useAuth();
  const uid = session?.user?.id ?? null;
  const isProvider = role === 'provider';

  const [name, setName] = useState('');
  const [precinct, setPrecinct] = useState('');
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the current profile + the trade list each time the modal opens.
  useEffect(() => {
    if (!visible || !uid) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const [{ data }, { services: rows }] = await Promise.all([
        supabase.from('profiles').select('full_name, precinct, service_ids').eq('id', uid).single(),
        fetchServices(),
      ]);
      if (cancelled) return;
      setName((data?.full_name as string) ?? '');
      setPrecinct((data?.precinct as string) ?? '');
      setServiceIds(((data?.service_ids as string[]) ?? []).slice());
      setServices(rows);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, uid]);

  function toggleService(id: string) {
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  async function onSave() {
    if (busy || !uid) return;
    const trimmedName = name.trim();
    const trimmedPrecinct = precinct.trim();
    if (!trimmedName) return setError('Please enter your name.');
    if (!trimmedPrecinct) return setError('Please enter your precinct.');
    if (isProvider && serviceIds.length === 0) return setError('Pick at least one trade.');

    setBusy(true);
    setError(null);
    const updates: Record<string, unknown> = { full_name: trimmedName, precinct: trimmedPrecinct };
    if (isProvider) updates.service_ids = serviceIds;
    const { error: e } = await supabase.from('profiles').update(updates).eq('id', uid);
    setBusy(false);
    if (e) {
      setError("Couldn't save — please try again.");
      return;
    }
    refreshRole(); // nudge any auth-derived state; screens refetch precinct/trades on focus
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ThemedView style={styles.sheet}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Edit profile</ThemedText>
            <Pressable onPress={onClose} hitSlop={8}>
              <ThemedText type="smallBold" style={{ color: Brand.primary }}>
                Close
              </ThemedText>
            </Pressable>
          </View>

          {loading ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.loading}>
              Loading…
            </ThemedText>
          ) : (
            <ScrollView contentContainerStyle={styles.scroll}>
              <ThemedText type="smallBold">Full name</ThemedText>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Ali Khan"
                placeholderTextColor={theme.textSecondary}
                style={styles.input}
              />

              <ThemedText type="smallBold">Precinct</ThemedText>
              <TextInput
                value={precinct}
                onChangeText={setPrecinct}
                placeholder="e.g. Precinct 10"
                placeholderTextColor={theme.textSecondary}
                style={styles.input}
              />

              {isProvider && (
                <>
                  <ThemedText type="smallBold">Your trade(s)</ThemedText>
                  <View style={styles.grid}>
                    {services.map((s) => {
                      const selected = serviceIds.includes(s.id);
                      return (
                        <Pressable
                          key={s.id}
                          onPress={() => toggleService(s.id)}
                          style={[
                            styles.tile,
                            {
                              backgroundColor: selected ? Brand.primary : theme.backgroundElement,
                              borderColor: selected ? Brand.primary : theme.backgroundSelected,
                            },
                          ]}>
                          <MaterialCommunityIcons
                            name={TRADE_ICON[s.slug] ?? 'toolbox-outline'}
                            size={24}
                            color={selected ? '#ffffff' : Brand.accent}
                          />
                          <ThemedText type="small" style={selected ? styles.tileSelected : undefined}>
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
                onPress={onSave}
                disabled={busy}
                style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
                <ThemedText type="default" style={styles.buttonLabel}>
                  {busy ? 'Saving…' : 'Save changes'}
                </ThemedText>
              </Pressable>
            </ScrollView>
          )}
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  loading: { textAlign: 'center', padding: Spacing.four },
  scroll: { gap: Spacing.three, paddingBottom: Spacing.four },
  input: {
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: Spacing.two,
    padding: Spacing.three,
    fontSize: 16,
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
  tileSelected: { color: '#ffffff' },
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
  pressed: { opacity: 0.7 },
});
