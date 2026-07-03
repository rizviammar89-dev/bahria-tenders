// Hunt: a resident-facing full-screen map of providers, filtered by trade. A floating filter button
// (top-left) opens a trade picker; tapping a pin opens an action card to call or view the provider.
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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

// Trade slug → Material Community icon (mirrors the Post a Job tiles).
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
  const [pickerOpen, setPickerOpen] = useState(false); // trade filter sheet

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

  const selectedService = services.find((s) => s.id === selectedId) ?? null;

  return (
    <ThemedView style={styles.container}>
      <View style={styles.mapArea}>
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

        {/* Top overlay: trade filter + a live count. box-none lets the map pan around them. */}
        <SafeAreaView edges={['top']} style={styles.topOverlay} pointerEvents="box-none">
          <Pressable
            onPress={() => setPickerOpen(true)}
            style={({ pressed }) => [styles.filterBtn, pressed && styles.pressed]}>
            <MaterialCommunityIcons name="filter-variant" size={18} color={Brand.primary} />
            <ThemedText type="smallBold" numberOfLines={1} style={styles.filterLabel}>
              {selectedService ? selectedService.display_en : 'Pick a trade'}
            </ThemedText>
            <MaterialCommunityIcons name="chevron-down" size={18} color={Brand.primary} />
          </Pressable>
          <ThemedText type="small" style={styles.countPill}>
            {loading ? 'Loading…' : providers.length === 0 ? 'None nearby' : `${providers.length} nearby`}
          </ThemedText>
        </SafeAreaView>

        {/* Bottom overlay: the tapped provider's actions. */}
        {selected && (
          <ThemedView type="backgroundElement" style={styles.actionCard}>
            <View style={styles.actionHeader}>
              <ThemedText type="smallBold">{selected.fullName}</ThemedText>
              <Pressable onPress={() => setSelected(null)} hitSlop={8}>
                <MaterialCommunityIcons name="close" size={20} color={Brand.primary} />
              </Pressable>
            </View>
            <View style={styles.actionRow}>
              <Pressable
                onPress={() => onCall(selected.id)}
                disabled={calling}
                style={({ pressed }) => [styles.callButton, pressed && styles.pressed]}>
                <ThemedText type="default" style={styles.callLabel}>
                  {calling ? 'Connecting…' : 'Call'}
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
        )}
      </View>

      {/* Trade picker sheet */}
      <Modal
        visible={pickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.sheetBackdrop}>
          <ThemedView style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <ThemedText type="subtitle">Pick a trade</ThemedText>
              <Pressable onPress={() => setPickerOpen(false)} hitSlop={8}>
                <ThemedText type="smallBold" style={{ color: Brand.primary }}>
                  Close
                </ThemedText>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.sheetGrid}>
              {services.map((s) => {
                const sel = s.id === selectedId;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => {
                      setSelectedId(s.id);
                      setSelected(null);
                      setPickerOpen(false);
                    }}
                    style={[
                      styles.tile,
                      {
                        backgroundColor: sel ? Brand.primary : theme.backgroundElement,
                        borderColor: sel ? Brand.primary : theme.backgroundSelected,
                      },
                    ]}>
                    <MaterialCommunityIcons
                      name={TRADE_ICON[s.slug] ?? 'toolbox-outline'}
                      size={26}
                      color={sel ? '#ffffff' : Brand.accent}
                    />
                    <ThemedText
                      type="smallBold"
                      numberOfLines={2}
                      style={[styles.tileLabel, sel ? styles.tileSelected : undefined]}>
                      {s.display_en}
                    </ThemedText>
                    <ThemedText
                      type="small"
                      numberOfLines={1}
                      themeColor={sel ? undefined : 'textSecondary'}
                      style={sel ? styles.tileSelected : undefined}>
                      {s.display_ur}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>

      <ProviderProfileModal providerId={viewProviderId} onClose={() => setViewProviderId(null)} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapArea: { flex: 1 },
  map: { flex: 1, width: '100%', height: '100%' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: '#ffffff',
    borderRadius: Spacing.four,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.two,
    maxWidth: '68%',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  filterLabel: { color: Brand.ink, flexShrink: 1 },
  countPill: {
    marginTop: Spacing.two,
    color: '#ffffff',
    backgroundColor: 'rgba(31,46,36,0.88)',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.four,
    overflow: 'hidden',
  },
  actionCard: {
    position: 'absolute',
    left: Spacing.four,
    right: Spacing.four,
    bottom: Spacing.four,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
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
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    maxHeight: '75%',
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, justifyContent: 'center' },
  tile: {
    width: '48%',
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    minHeight: 100,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  tileLabel: { textAlign: 'center' },
  tileSelected: { color: '#ffffff' },
  pressed: { opacity: 0.7 },
});
