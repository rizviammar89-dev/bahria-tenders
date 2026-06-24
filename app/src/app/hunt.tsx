// Hunt: a resident-facing map of providers, filterable by trade. Shows every provider in the
// selected trade that has a published location; tapping a pin opens their profile to view & hire.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Marker, type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppMap } from '@/components/app-map';
import { ProviderProfileModal } from '@/components/provider-profile-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { callNumber } from '@/lib/call';
import { fetchServices, type Service } from '@/lib/jobs';
import { fetchProvidersForTrade, fetchProviderPhone, type AvailableProvider } from '@/lib/live-map';
import { getCurrentPosition, requestForegroundPermission } from '@/lib/location';

// Bahria Town Karachi-ish fallback if the resident's location isn't available.
const DEFAULT_REGION: Region = {
  latitude: 24.8607,
  longitude: 67.0011,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function HuntScreen() {
  const theme = useTheme();
  const [services, setServices] = useState<Service[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [providers, setProviders] = useState<AvailableProvider[]>([]);
  const [region, setRegion] = useState<Region | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewProviderId, setViewProviderId] = useState<string | null>(null);
  const [selected, setSelected] = useState<AvailableProvider | null>(null); // pin tapped → action card
  const [calling, setCalling] = useState(false);

  async function onCall(providerId: string) {
    if (calling) return;
    setCalling(true);
    const phone = await fetchProviderPhone(providerId);
    setCalling(false);
    if (phone) callNumber(phone);
    else Alert.alert('Call', "Couldn't get this provider's number — please try again.");
  }

  // Center the map on the resident's location if permitted, else the default region.
  useEffect(() => {
    let active = true;
    (async () => {
      const granted = await requestForegroundPermission();
      const pos = granted ? await getCurrentPosition() : null;
      if (!active) return;
      setRegion(
        pos
          ? { latitude: pos.lat, longitude: pos.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
          : DEFAULT_REGION,
      );
    })();
    return () => {
      active = false;
    };
  }, []);

  // Load trades; default to the first one.
  useEffect(() => {
    let active = true;
    fetchServices().then(({ services: rows }) => {
      if (!active) return;
      setServices(rows);
      setSelectedId((prev) => prev ?? rows[0]?.id ?? null);
    });
    return () => {
      active = false;
    };
  }, []);

  const loadProviders = useCallback(async (serviceId: string) => {
    setLoading(true);
    const { providers: rows } = await fetchProvidersForTrade(serviceId);
    setProviders(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    // loadProviders only setStates after its await (plus a leading setLoading) — safe here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (selectedId) loadProviders(selectedId);
  }, [selectedId, loadProviders]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <ThemedText type="subtitle">Hunt</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Find providers near you — pick a trade.
          </ThemedText>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}>
          {services.map((s) => {
            const selected = s.id === selectedId;
            return (
              <Pressable
                key={s.id}
                onPress={() => setSelectedId(s.id)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? Brand.primary : theme.backgroundElement,
                    borderColor: selected ? Brand.primary : theme.backgroundSelected,
                  },
                ]}>
                <ThemedText type="smallBold" style={selected ? styles.chipSelected : undefined}>
                  {s.display_en}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.mapWrap}>
          {region ? (
            <AppMap region={region} style={styles.map}>
              {providers.map((p) => (
                <Marker
                  key={p.id}
                  coordinate={{ latitude: p.lat, longitude: p.lng }}
                  title={p.fullName}
                  onPress={() => setSelected(p)}
                />
              ))}
            </AppMap>
          ) : (
            <View style={styles.center}>
              <ActivityIndicator color={Brand.primary} />
            </View>
          )}
        </View>

        {selected ? (
          <ThemedView type="backgroundElement" style={styles.actionCard}>
            <View style={styles.actionHeader}>
              <ThemedText type="smallBold">{selected.fullName}</ThemedText>
              <Pressable onPress={() => setSelected(null)} hitSlop={8}>
                <ThemedText type="smallBold" style={{ color: Brand.primary }}>
                  ✕
                </ThemedText>
              </Pressable>
            </View>
            <View style={styles.actionRow}>
              <Pressable
                onPress={() => onCall(selected.id)}
                disabled={calling}
                style={({ pressed }) => [styles.callButton, pressed && styles.pressed]}>
                <ThemedText type="default" style={styles.callLabel}>
                  {calling ? 'Connecting…' : '📞 Call'}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setViewProviderId(selected.id)}
                style={({ pressed }) => [styles.profileButton, pressed && styles.pressed]}>
                <ThemedText type="default" style={styles.profileLabel}>
                  View profile
                </ThemedText>
              </Pressable>
            </View>
          </ThemedView>
        ) : (
          <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
            {loading
              ? 'Loading providers…'
              : providers.length === 0
                ? 'No providers with a location in this trade yet.'
                : `${providers.length} provider${providers.length === 1 ? '' : 's'} — tap a pin to call or view`}
          </ThemedText>
        )}
      </SafeAreaView>

      <ProviderProfileModal providerId={viewProviderId} onClose={() => setViewProviderId(null)} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, gap: Spacing.one },
  chips: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, gap: Spacing.two },
  chip: {
    borderWidth: 1,
    borderRadius: Spacing.four,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    minHeight: 40,
    justifyContent: 'center',
  },
  chipSelected: { color: '#ffffff' },
  mapWrap: { flex: 1, marginHorizontal: Spacing.four, borderRadius: Spacing.three, overflow: 'hidden' },
  map: { flex: 1, width: '100%', height: '100%' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { textAlign: 'center', padding: Spacing.three },
  actionCard: {
    margin: Spacing.four,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  actionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actionRow: { flexDirection: 'row', gap: Spacing.two },
  callButton: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    backgroundColor: '#1B9E5A',
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  callLabel: { color: '#ffffff' },
  profileButton: {
    flex: 1,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: Brand.primary,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  profileLabel: { color: Brand.primary },
  pressed: { opacity: 0.7 },
});
