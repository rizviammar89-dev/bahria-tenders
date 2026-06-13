// Story 2.3: Provider Job Discovery (FR-7). A verified provider sees open jobs in their
// trades. RLS jobs_select_visible is the security backstop; the query filters to relevance.
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

  const load = useCallback(async () => {
    const { jobs: rows, error } = await fetchOpenJobsForMyTrades();
    setNow(Date.now());
    setLoadError(error ? "Couldn't load jobs — pull to refresh." : null);
    if (!error) setJobs(rows);
    setLoaded(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchOpenJobsForMyTrades().then(({ jobs: rows, error }) => {
      if (cancelled) return;
      setNow(Date.now());
      setLoadError(error ? "Couldn't load jobs — pull to refresh." : null);
      if (!error) setJobs(rows);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
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
            </ThemedView>
          )}
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
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one, minHeight: 64 },
  empty: { padding: Spacing.four, borderRadius: Spacing.three, gap: Spacing.one },
  error: { color: '#c0392b' },
});
