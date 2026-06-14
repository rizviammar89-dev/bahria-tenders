// Story 2.3: Provider Job Discovery (FR-7). A verified provider sees open jobs in their
// trades. RLS jobs_select_visible is the security backstop; the query filters to relevance.
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BidModal } from '@/components/bid-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { fetchOpenJobsForMyTrades, type OpenJob } from '@/lib/jobs';
import { timeAgo } from '@/lib/time-ago';

export default function JobsFeedScreen() {
  const [jobs, setJobs] = useState<OpenJob[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(0); // stamped at load time (Date.now() is impure → keep it out of render)
  const [bidJob, setBidJob] = useState<OpenJob | null>(null); // open the bid modal for this job
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const mounted = useRef(true);

  // Single fetch path, used by both the initial load and pull-to-refresh.
  const load = useCallback(async () => {
    const { jobs: rows, error } = await fetchOpenJobsForMyTrades();
    if (!mounted.current) return; // unmounted mid-fetch → don't setState
    setNow(Date.now());
    setLoadError(error ? "Couldn't load jobs — pull to refresh." : null);
    if (!error) setJobs(rows);
    setLoaded(true);
  }, []);

  useEffect(() => {
    mounted.current = true;
    // Fetch-on-mount: load() only setStates after the await (in a callback), not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }, [load]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={jobs}
          keyExtractor={(j) => j.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            <ThemedView style={styles.header}>
              <ThemedText type="subtitle">Open Jobs</ThemedText>
              {confirmation && (
                <ThemedView type="backgroundElement" style={styles.confirm}>
                  <ThemedText type="smallBold">{confirmation}</ThemedText>
                </ThemedView>
              )}
              {loadError && (
                <ThemedText type="small" style={styles.error}>
                  {loadError}
                </ThemedText>
              )}
            </ThemedView>
          }
          ListEmptyComponent={
            loaded && !loadError ? (
              <ThemedView type="backgroundElement" style={styles.empty}>
                <ThemedText type="smallBold">No open jobs in your trades right now</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  We&apos;ll keep this updated — pull down to refresh.
                </ThemedText>
              </ThemedView>
            ) : null
          }
          renderItem={({ item }) => (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">
                {item.service ? `${item.service.display_en} · ${item.service.display_ur}` : 'Job'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {item.precinct} · {timeAgo(item.created_at, now)}
              </ThemedText>
              <ThemedText type="default">{item.description}</ThemedText>
              <Pressable
                onPress={() => {
                  setConfirmation(null);
                  setBidJob(item);
                }}
                style={({ pressed }) => [styles.bidButton, pressed && styles.pressed]}>
                <ThemedText type="default" style={styles.bidButtonLabel}>
                  {item.myBid ? `Edit bid · Rs ${item.myBid.pricePkr.toLocaleString('en-US')}` : 'Place bid'}
                </ThemedText>
              </Pressable>
            </ThemedView>
          )}
        />
        <BidModal
          key={bidJob?.id ?? 'none'} // remount per open → fresh form state, no stale price/busy
          job={bidJob}
          onClose={() => setBidJob(null)}
          onSubmitted={(pricePkr) => {
            setBidJob(null);
            setConfirmation(`Your bid is in — Rs ${pricePkr.toLocaleString('en-US')}`);
            load(); // refresh so the card flips to "Edit bid · Rs N"
          }}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  list: { padding: Spacing.four, gap: Spacing.three },
  header: { gap: Spacing.two, marginBottom: Spacing.one },
  confirm: { padding: Spacing.three, borderRadius: Spacing.three },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two, minHeight: 64 },
  empty: { padding: Spacing.four, borderRadius: Spacing.three, gap: Spacing.one },
  error: { color: '#c0392b' },
  bidButton: {
    marginTop: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    backgroundColor: '#208AEF',
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  bidButtonLabel: { color: '#ffffff' },
  pressed: { opacity: 0.7 },
});
