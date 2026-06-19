// Story 6.4: resident live map. Shows the job location + pins for available providers in the trade,
// updating live via Supabase Realtime. Each provider pin shows distance + whether the Rs 250
// visiting charge applies (>3 km). Read-only; the authoritative charge is also on the bid cards.
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { AppMap } from '@/components/app-map';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { haversineKm, visitingChargeForKm } from '@/lib/distance';
import {
  fetchAvailableProviders,
  subscribeProviderLocations,
  type AvailableProvider,
} from '@/lib/live-map';

export type LiveMapJob = {
  id: string;
  lat: number | null;
  lng: number | null;
  serviceId: string;
  serviceName: string;
};

export function LiveMapModal({ job, onClose }: { job: LiveMapJob | null; onClose: () => void }) {
  const [providers, setProviders] = useState<AvailableProvider[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!job) return;
    let active = true;
    const refresh = async () => {
      const { providers: rows } = await fetchAvailableProviders(job.serviceId);
      if (active) setProviders(rows);
    };
    (async () => {
      setLoading(true);
      await refresh();
      if (active) setLoading(false);
    })();
    // Live updates: any provider_locations change → refetch this trade's available providers.
    const channel = subscribeProviderLocations(() => {
      refresh();
    });
    return () => {
      active = false;
      channel.unsubscribe();
    };
  }, [job]);

  const hasJobLocation = job?.lat != null && job?.lng != null;

  return (
    <Modal visible={job !== null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ThemedView style={styles.sheet}>
          <View style={styles.header}>
            <ThemedText type="subtitle">{job?.serviceName ?? 'Providers'} nearby</ThemedText>
            <Pressable onPress={onClose} hitSlop={8}>
              <ThemedText type="smallBold" style={styles.close}>
                Close
              </ThemedText>
            </Pressable>
          </View>

          {!hasJobLocation ? (
            <ThemedView type="backgroundElement" style={styles.calm}>
              <ThemedText type="smallBold">Job location unavailable</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                This job was posted without a GPS location, so the map and distance can&apos;t be
                shown. Re-post with “Use current location” to enable it.
              </ThemedText>
            </ThemedView>
          ) : (
            <>
              <AppMap
                style={styles.map}
                region={{
                  latitude: job!.lat!,
                  longitude: job!.lng!,
                  latitudeDelta: 0.08,
                  longitudeDelta: 0.08,
                }}>
                <Marker
                  coordinate={{ latitude: job!.lat!, longitude: job!.lng! }}
                  title="Your job"
                  pinColor="green"
                />
                {providers.map((p) => {
                  const dist = haversineKm(job!.lat!, job!.lng!, p.lat, p.lng);
                  const charge = visitingChargeForKm(dist);
                  return (
                    <Marker
                      key={p.id}
                      coordinate={{ latitude: p.lat, longitude: p.lng }}
                      title={p.fullName}
                      description={`${dist.toFixed(1)} km · ${
                        charge > 0 ? `Rs ${charge} visiting charge` : 'No visiting charge'
                      }`}
                    />
                  );
                })}
              </AppMap>

              <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
                {loading
                  ? 'Finding available providers…'
                  : providers.length === 0
                    ? 'No available providers in this trade right now.'
                    : `${providers.length} available · live — tap a pin for distance & charge`}
              </ThemedText>
            </>
          )}
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    height: '75%',
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { color: Brand.primary },
  map: { flex: 1, width: '100%', height: '100%', borderRadius: Spacing.three },
  calm: { padding: Spacing.four, borderRadius: Spacing.three, gap: Spacing.one },
  footer: { textAlign: 'center' },
});
