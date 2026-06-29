// Story 2.1: Post a Job (FR-6). Resident picks a trade, describes the problem, confirms
// precinct, and posts. Insert goes through the authed client under RLS jobs_insert_own.
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { validateJobDraft } from '@/lib/job-draft';
import { pickJobPhotos, type PickedPhoto } from '@/lib/job-photos';
import { createJob, fetchMyPrecinct, fetchServices, type Service } from '@/lib/jobs';
import { getCurrentPosition, requestForegroundPermission, reverseGeocode } from '@/lib/location';
import { nextDays, type Slot } from '@/lib/schedule';

// Map each trade slug to a Material Community icon for the tile grid.
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

export default function PostJobScreen() {
  const theme = useTheme();
  const myUid = useAuth().session?.user?.id ?? null;
  // Re-hire: Saved providers passes a trade to preselect (Story: favorites).
  const { serviceId: rehireServiceId } = useLocalSearchParams<{ serviceId?: string }>();
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState(rehireServiceId ?? '');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [addressUnit, setAddressUnit] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [precinct, setPrecinct] = useState('');
  const [preferredDate, setPreferredDate] = useState<string | null>(null); // null = ASAP
  const [preferredSlot, setPreferredSlot] = useState<Slot>(null); // null = anytime
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);
  const [busy, setBusy] = useState(false);

  // Re-hire can arrive while this tab is already mounted, so sync the preselected trade on change.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (rehireServiceId) setServiceId(rehireServiceId);
  }, [rehireServiceId]);

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

  const MAX_PHOTOS = 5;
  async function onAddPhotos() {
    const picked = await pickJobPhotos();
    if (picked.length) setPhotos((prev) => [...prev, ...picked].slice(0, MAX_PHOTOS));
  }
  function removePhoto(uri: string) {
    setPhotos((prev) => prev.filter((p) => p.uri !== uri));
  }

  async function onUseLocation() {
    if (locating) return;
    setLocating(true);
    setLocationNote(null);
    const granted = await requestForegroundPermission();
    if (!granted) {
      setLocationNote('Location permission denied. Enable it in Settings to use GPS.');
      setLocating(false);
      return;
    }
    const pos = await getCurrentPosition();
    if (!pos) {
      setLocationNote("Couldn't get your location — make sure GPS is on, then try again.");
      setLocating(false);
      return;
    }
    setCoords(pos);
    // Best-effort: pre-fill the street (and precinct if still blank) from the GPS fix. The user
    // can edit; the captured coordinates are what drive the distance/visiting-charge rule.
    const geo = await reverseGeocode(pos.lat, pos.lng);
    if (geo?.street) setAddressStreet(geo.street);
    if (geo?.district && !precinct.trim()) setPrecinct(geo.district);
    setLocationNote('📍 Location captured — review the address below and edit if needed.');
    setLocating(false);
  }

  async function onPost() {
    if (busy) return; // guard against a double-tap before the disabled state renders
    setBusy(true);
    setError(null);
    setPosted(false);
    const draft = { serviceId, description, addressUnit, addressStreet, precinct };
    const check = validateJobDraft(draft);
    if (!check.ok) {
      setError(check.error);
      setBusy(false);
      return;
    }
    const { error: postError } = await createJob({
      ...draft,
      userId: myUid ?? '',
      lat: coords?.lat,
      lng: coords?.lng,
      photos,
      preferredDate,
      preferredSlot,
    });
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
    setPhotos([]);
    setPreferredDate(null);
    setPreferredSlot(null);
    setCoords(null);
    setLocationNote(null);
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
            returnKeyType="done"
            submitBehavior="blurAndSubmit"
            style={[styles.input, styles.multiline]}
          />

          <Pressable
            onPress={onAddPhotos}
            disabled={photos.length >= MAX_PHOTOS}
            style={({ pressed }) => [
              styles.locationButton,
              photos.length >= MAX_PHOTOS && styles.disabledButton,
              pressed && styles.pressed,
            ]}>
            <MaterialCommunityIcons name="camera-plus-outline" size={20} color={Brand.primary} />
            <ThemedText type="default" style={styles.locationLabel}>
              {photos.length ? `Add more photos (${photos.length}/${MAX_PHOTOS})` : 'Add photos'}
            </ThemedText>
          </Pressable>
          {photos.length > 0 && (
            <View style={styles.thumbRow}>
              {photos.map((p) => (
                <View key={p.uri} style={styles.thumbWrap}>
                  <Image source={{ uri: p.uri }} style={styles.thumb} contentFit="cover" />
                  <Pressable
                    onPress={() => removePhoto(p.uri)}
                    hitSlop={8}
                    style={styles.thumbRemove}>
                    <MaterialCommunityIcons name="close-circle" size={22} color="#c0392b" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <ThemedText type="smallBold">Address</ThemedText>
          <Pressable
            onPress={onUseLocation}
            disabled={locating}
            style={({ pressed }) => [styles.locationButton, pressed && styles.pressed]}>
            <MaterialCommunityIcons name="crosshairs-gps" size={20} color={Brand.primary} />
            <ThemedText type="default" style={styles.locationLabel}>
              {locating ? 'Getting location…' : coords ? 'Update current location' : 'Use current location'}
            </ThemedText>
          </Pressable>
          {locationNote && (
            <ThemedText type="small" themeColor="textSecondary">
              {locationNote}
            </ThemedText>
          )}

          <ThemedText type="smallBold">Villa / Apartment Number</ThemedText>
          <TextInput
            value={addressUnit}
            onChangeText={setAddressUnit}
            placeholder="e.g. Villa 123 / Apartment 4B"
            returnKeyType="done"
            style={styles.input}
          />

          <ThemedText type="smallBold">Street / Building Name & Number</ThemedText>
          <TextInput
            value={addressStreet}
            onChangeText={setAddressStreet}
            placeholder="e.g. Rose Street 12 / Sapphire Tower"
            returnKeyType="done"
            style={styles.input}
          />

          <ThemedText type="smallBold">Precinct Number</ThemedText>
          <TextInput
            value={precinct}
            onChangeText={setPrecinct}
            placeholder="e.g. Precinct 10"
            returnKeyType="done"
            style={styles.input}
          />

          <ThemedText type="smallBold">When do you need it?</ThemedText>
          <View style={styles.chipRow}>
            {[{ value: null as string | null, label: 'ASAP' }, ...nextDays(new Date(), 4)].map((d) => {
              const selected = preferredDate === d.value;
              return (
                <Pressable
                  key={d.label}
                  onPress={() => setPreferredDate(d.value)}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      backgroundColor: selected ? Brand.primary : theme.backgroundElement,
                      borderColor: selected ? Brand.primary : theme.backgroundSelected,
                    },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="small" style={selected ? styles.chipSelected : undefined}>
                    {d.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.chipRow}>
            {([
              { value: null as Slot, label: 'Anytime' },
              { value: 'morning' as Slot, label: 'Morning' },
              { value: 'afternoon' as Slot, label: 'Afternoon' },
              { value: 'evening' as Slot, label: 'Evening' },
            ]).map((s) => {
              const selected = preferredSlot === s.value;
              return (
                <Pressable
                  key={s.label}
                  onPress={() => setPreferredSlot(s.value)}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      backgroundColor: selected ? Brand.primary : theme.backgroundElement,
                      borderColor: selected ? Brand.primary : theme.backgroundSelected,
                    },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="small" style={selected ? styles.chipSelected : undefined}>
                    {s.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

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
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: Brand.primary,
    minHeight: 48,
  },
  locationLabel: { color: Brand.primary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingVertical: Spacing.one },
  chip: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    minHeight: 40,
    justifyContent: 'center',
  },
  chipSelected: { color: '#ffffff' },
  thumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  thumbWrap: { position: 'relative' },
  thumb: { width: 72, height: 72, borderRadius: Spacing.two, backgroundColor: '#eee' },
  thumbRemove: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 11,
  },
  disabledButton: { opacity: 0.5 },
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
