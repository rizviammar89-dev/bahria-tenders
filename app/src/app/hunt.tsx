// Hunt: browse providers by trade. Default is a directory LIST of every provider in the selected
// trade (always populated), with an optional live MAP toggle showing those currently online. Tap a
// provider to view their profile; "Get a quote" posts a job for that trade, "Call" dials them.
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
import {
  fetchProviderPhone,
  fetchProvidersDirectory,
  fetchProvidersForTrade,
  type AvailableProvider,
  type DirectoryProvider,
} from '@/lib/live-map';
import { getCurrentPosition, requestForegroundPermission } from '@/lib/location';

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

const DEFAULT_REGION: Region = {
  latitude: 24.8607,
  longitude: 67.0011,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function HuntScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [directory, setDirectory] = useState<DirectoryProvider[]>([]);
  const [loadingDir, setLoadingDir] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [viewProviderId, setViewProviderId] = useState<string | null>(null);
  const [calling, setCalling] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [region, setRegion] = useState<Region | null>(null);
  const [mapProviders, setMapProviders] = useState<AvailableProvider[]>([]);

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

  // Directory list for the selected trade.
  const loadDirectory = useCallback(async (serviceId: string) => {
    setLoadingDir(true);
    const { providers } = await fetchProvidersDirectory(serviceId);
    setDirectory(providers);
    setLoadingDir(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (selectedId) loadDirectory(selectedId);
  }, [selectedId, loadDirectory]);

  // Map mode: center on the resident and load the online providers as pins.
  useEffect(() => {
    if (!showMap || !selectedId) return;
    let active = true;
    (async () => {
      if (!region) {
        const granted = await requestForegroundPermission();
        const pos = granted ? await getCurrentPosition() : null;
        if (active) {
          setRegion(
            pos
              ? { latitude: pos.lat, longitude: pos.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
              : DEFAULT_REGION,
          );
        }
      }
      const { providers } = await fetchProvidersForTrade(selectedId);
      if (active) setMapProviders(providers);
    })();
    return () => {
      active = false;
    };
  }, [showMap, selectedId, region]);

  async function onCall(providerId: string) {
    if (calling) return;
    setCalling(true);
    const phone = await fetchProviderPhone(providerId);
    setCalling(false);
    if (phone) callNumber(phone);
    else Alert.alert('Call', "Couldn't get this provider's number — please try again.");
  }

  function onQuote() {
    if (selectedId) router.navigate({ pathname: '/post-job', params: { serviceId: selectedId } });
  }

  const selectedService = services.find((s) => s.id === selectedId) ?? null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <ThemedText type="subtitle">Find a provider</ThemedText>
          <Pressable
            onPress={() => setShowMap((m) => !m)}
            style={({ pressed }) => [styles.modeToggle, pressed && styles.pressed]}>
            <MaterialCommunityIcons
              name={showMap ? 'view-list' : 'map-marker-radius'}
              size={18}
              color={Brand.primary}
            />
            <ThemedText type="smallBold" style={styles.modeLabel}>
              {showMap ? 'List' : 'Map'}
            </ThemedText>
          </Pressable>
        </View>

        <Pressable
          onPress={() => setPickerOpen(true)}
          style={({ pressed }) => [styles.filterBtn, pressed && styles.pressed]}>
          <MaterialCommunityIcons name="filter-variant" size={18} color={Brand.primary} />
          <ThemedText type="smallBold" numberOfLines={1} style={styles.filterLabel}>
            {selectedService ? selectedService.display_en : 'Pick a trade'}
          </ThemedText>
          <MaterialCommunityIcons name="chevron-down" size={18} color={Brand.primary} />
        </Pressable>

        {showMap ? (
          <View style={styles.mapWrap}>
            {region ? (
              <AppMap region={region} style={styles.map}>
                {mapProviders.map((p) => (
                  <Marker
                    key={p.id}
                    coordinate={{ latitude: p.lat, longitude: p.lng }}
                    title={p.fullName}
                    onPress={() => setViewProviderId(p.id)}
                  />
                ))}
              </AppMap>
            ) : (
              <View style={styles.center}>
                <ActivityIndicator color={Brand.primary} />
              </View>
            )}
            {mapProviders.length === 0 && region && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.mapHint}>
                No providers are online right now — switch to List to browse everyone.
              </ThemedText>
            )}
          </View>
        ) : (
          <FlatList
            data={directory}
            keyExtractor={(p) => p.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
                {loadingDir ? 'Loading providers…' : 'No providers in this trade yet.'}
              </ThemedText>
            }
            renderItem={({ item }) => (
              <ThemedView type="backgroundElement" style={styles.card}>
                <Pressable onPress={() => setViewProviderId(item.id)} style={styles.cardTop}>
                  <View style={styles.cardInfo}>
                    <View style={styles.nameRow}>
                      <ThemedText type="smallBold">{item.fullName}</ThemedText>
                      {item.online && (
                        <ThemedText type="small" style={styles.onlineBadge}>
                          ● Online
                        </ThemedText>
                      )}
                    </View>
                    <ThemedText type="small" themeColor="textSecondary">
                      {item.precinct ?? 'Area not set'} ·{' '}
                      {item.ratingCount
                        ? `★ ${(item.ratingSum / item.ratingCount).toFixed(1)} (${item.ratingCount})`
                        : 'New'}
                    </ThemedText>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={22} color={theme.textSecondary} />
                </Pressable>
                <View style={styles.cardActions}>
                  <Pressable
                    onPress={onQuote}
                    style={({ pressed }) => [styles.quoteBtn, pressed && styles.pressed]}>
                    <ThemedText type="smallBold" style={styles.quoteLabel}>
                      Get a quote
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => onCall(item.id)}
                    disabled={calling}
                    style={({ pressed }) => [styles.callBtn, pressed && styles.pressed]}>
                    <ThemedText type="smallBold" style={styles.callLabel}>
                      Call
                    </ThemedText>
                  </Pressable>
                </View>
              </ThemedView>
            )}
          />
        )}
      </SafeAreaView>

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
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  modeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: 1,
    borderColor: Brand.primary,
    borderRadius: Spacing.four,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  modeLabel: { color: Brand.primary },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: Brand.primary,
    borderRadius: Spacing.four,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    marginHorizontal: Spacing.four,
    marginTop: Spacing.two,
  },
  filterLabel: { color: Brand.ink, flex: 1 },
  list: { padding: Spacing.four, gap: Spacing.three },
  empty: { textAlign: 'center', padding: Spacing.four },
  card: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  cardInfo: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  onlineBadge: { color: '#1B9E5A' },
  cardActions: { flexDirection: 'row', gap: Spacing.two },
  quoteBtn: {
    flex: 1,
    backgroundColor: Brand.primary,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  quoteLabel: { color: '#ffffff' },
  callBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: Brand.primary,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  callLabel: { color: Brand.primary },
  mapWrap: { flex: 1, margin: Spacing.four, borderRadius: Spacing.three, overflow: 'hidden' },
  map: { flex: 1, width: '100%', height: '100%' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mapHint: {
    position: 'absolute',
    bottom: Spacing.three,
    left: Spacing.three,
    right: Spacing.three,
    textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: Spacing.two,
    borderRadius: Spacing.two,
    overflow: 'hidden',
  },
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
