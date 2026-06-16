// Story 2.1: Post a Job (FR-6). Resident picks a trade, describes the problem, confirms
// precinct, and posts. Insert goes through the authed client under RLS jobs_insert_own.
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useState, type ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { validateJobDraft } from '@/lib/job-draft';
import { createJob, fetchMyPrecinct, fetchServices, type Service } from '@/lib/jobs';

// Map each trade slug to a Material Community icon for the tile grid.
type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
const TRADE_ICON: Record<string, IconName> = {
  ac_technician: 'air-conditioner',
  plumber: 'pipe-wrench',
  carpenter: 'hammer',
  electrician: 'flash',
  mason: 'wall',
  painter: 'format-paint',
};

export default function PostJobScreen() {
  const theme = useTheme();
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState('');
  const [description, setDescription] = useState('');
  const [precinct, setPrecinct] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchServices().then(({ services, error: servicesError }) => {
      if (cancelled) return;
      if (servicesError) {
        setLoadError("Couldn't load trades — please try again.");
      } else if (services.length === 0) {
        setLoadError('No trades are available right now.');
      } else {
        setServices(services);
      }
    });
    fetchMyPrecinct().then((p) => {
      if (!cancelled && p) setPrecinct(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onPost() {
    if (busy) return; // guard against a double-tap before the disabled state renders
    setBusy(true);
    setError(null);
    setPosted(false);
    const draft = { serviceId, description, precinct };
    const check = validateJobDraft(draft);
    if (!check.ok) {
      setError(check.error);
      setBusy(false);
      return;
    }
    const { error: postError } = await createJob(draft);
    if (postError) {
      console.warn('createJob failed:', postError); // keep the real cause for field debugging
      setError("Couldn't post your job — please try again.");
      setBusy(false);
      return;
    }
    // Reset for the next post; no list screen to navigate to yet (later stories).
    setPosted(true);
    setServiceId('');
    setDescription('');
    setBusy(false);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="subtitle">Post a Job</ThemedText>

          {posted && (
            <ThemedView type="backgroundElement" style={styles.notice}>
              <ThemedText type="smallBold">Your job is posted</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Providers nearby will be notified. You can post another below.
              </ThemedText>
            </ThemedView>
          )}

          <ThemedText type="smallBold">Trade</ThemedText>
          {loadError && (
            <ThemedText type="small" style={styles.error}>
              {loadError}
            </ThemedText>
          )}
          <ThemedView style={styles.grid}>
            {services.map((s) => {
              const selected = s.id === serviceId;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setServiceId(s.id)}
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
                    size={30}
                    color={selected ? '#ffffff' : Brand.accent}
                  />
                  <ThemedText type="smallBold" style={selected ? styles.tileLabelSelected : undefined}>
                    {s.display_en}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    themeColor={selected ? undefined : 'textSecondary'}
                    style={selected ? styles.tileLabelSelected : undefined}>
                    {s.display_ur}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ThemedView>

          <ThemedText type="smallBold">Describe the problem</ThemedText>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="e.g. Kitchen tap is leaking"
            multiline
            style={[styles.input, styles.multiline]}
          />

          <ThemedText type="smallBold">Precinct</ThemedText>
          <TextInput
            value={precinct}
            onChangeText={setPrecinct}
            placeholder="e.g. Precinct 10"
            style={styles.input}
          />

          {error && (
            <ThemedText type="small" style={styles.error}>
              {error}
            </ThemedText>
          )}

          <Pressable
            onPress={onPost}
            disabled={busy}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
            <ThemedText type="default" style={styles.buttonLabel}>
              {busy ? 'Posting…' : 'Post job'}
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
  notice: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tile: {
    width: '48%',
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    minHeight: 104,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  tileLabelSelected: { color: '#ffffff' },
  input: {
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: Spacing.two,
    padding: Spacing.three,
    fontSize: 16,
    minHeight: 52,
  },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
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
