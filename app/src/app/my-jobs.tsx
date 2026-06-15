// Story 2.8: the resident's My Jobs — compare bids (NOT cheapest-sorted), award on merit,
// then reveal contact details. Award + contacts go through SECURITY DEFINER RPCs.
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  awardJob,
  completeJob,
  fetchMyJobs,
  getJobContacts,
  submitRating,
  type JobContacts,
  type MyJob,
} from '@/lib/my-jobs';
import { isValidStars } from '@/lib/rating';
import { reputationLabel } from '@/lib/reputation';

const STATUS_LABEL: Record<MyJob['status'], string> = {
  open: 'Open · taking bids',
  awarded: 'Awarded',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function MyJobsScreen() {
  const [jobs, setJobs] = useState<MyJob[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [awardingBidId, setAwardingBidId] = useState<string | null>(null); // only this bid's button disables
  const [completingJobId, setCompletingJobId] = useState<string | null>(null); // only this job's button disables
  const [message, setMessage] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Record<string, JobContacts>>({});
  const [ratingJobId, setRatingJobId] = useState<string | null>(null); // only this job's submit disables
  const [starDraft, setStarDraft] = useState<Record<string, number>>({}); // per-job selected stars
  const [reviewDraft, setReviewDraft] = useState<Record<string, string>>({}); // per-job review text
  const mounted = useRef(true);

  const load = useCallback(async () => {
    const { jobs: rows, error } = await fetchMyJobs();
    if (!mounted.current) return;
    setLoadError(error ? "Couldn't load your jobs — pull to refresh." : null);
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

  async function onAward(jobId: string, bidId: string, providerId: string, providerName: string) {
    if (awardingBidId) return; // an award is already in flight
    setAwardingBidId(bidId);
    setMessage(null);
    const { error } = await awardJob(jobId, providerId);
    if (!mounted.current) return;
    if (error) {
      console.warn('awardJob failed:', error);
      setMessage("Couldn't award the job — please refresh and try again.");
      setAwardingBidId(null);
      return;
    }
    setMessage(`Awarded to ${providerName}. Tap "Show contact details" to coordinate.`);
    setAwardingBidId(null);
    load();
  }

  async function onComplete(jobId: string) {
    if (completingJobId) return; // a completion is already in flight
    setCompletingJobId(jobId);
    setMessage(null);
    const { error } = await completeJob(jobId);
    if (!mounted.current) return;
    if (error) {
      console.warn('completeJob failed:', error);
      setMessage("Couldn't mark the job complete — please refresh and try again.");
      setCompletingJobId(null);
      return;
    }
    setMessage('Job marked complete.');
    // Keep the in-flight lock until the refresh lands, so the stale (still-awarded) row never
    // re-enables the button and a fast re-tap can't trigger a spurious "couldn't complete" error.
    await load();
    if (mounted.current) setCompletingJobId(null);
  }

  async function onSubmitRating(jobId: string, providerId: string) {
    const stars = starDraft[jobId] ?? 0;
    if (!isValidStars(stars)) {
      setMessage('Please choose 1–5 stars first.');
      return;
    }
    if (ratingJobId) return; // a rating submit is already in flight
    setRatingJobId(jobId);
    setMessage(null);
    const { error } = await submitRating({ jobId, providerId, stars, review: reviewDraft[jobId] });
    if (!mounted.current) return;
    if (error) {
      console.warn('submitRating failed:', error);
      setMessage("Couldn't submit your rating — please try again.");
      setRatingJobId(null);
      return;
    }
    setMessage('Thanks — your rating was saved.');
    // Keep the lock until the refresh lands so the embedded rating renders the rated state.
    await load();
    if (mounted.current) setRatingJobId(null);
  }

  async function onShowContacts(jobId: string) {
    const { contacts: c, error } = await getJobContacts(jobId);
    if (!mounted.current) return;
    if (error || !c) {
      setMessage("Couldn't load contact details — please try again.");
      return;
    }
    setContacts((prev) => ({ ...prev, [jobId]: c }));
  }

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
              <ThemedText type="subtitle">My Jobs</ThemedText>
              {message && (
                <ThemedView type="backgroundElement" style={styles.notice}>
                  <ThemedText type="smallBold">{message}</ThemedText>
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
                <ThemedText type="smallBold">You haven&apos;t posted any jobs yet</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Post a job and providers will bid — you&apos;ll compare and choose here.
                </ThemedText>
              </ThemedView>
            ) : null
          }
          renderItem={({ item }) => (
            <ThemedView type="backgroundElement" style={styles.jobCard}>
              <ThemedText type="smallBold">
                {item.service ? `${item.service.display_en} · ${item.service.display_ur}` : 'Job'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {item.precinct} · {STATUS_LABEL[item.status]}
              </ThemedText>
              <ThemedText type="default">{item.description}</ThemedText>

              {item.status === 'open' &&
                (item.bids.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    No bids yet — providers are being notified.
                  </ThemedText>
                ) : (
                  item.bids.map((bid) => (
                    <ThemedView key={bid.id} style={styles.bidRow}>
                      <ThemedView style={styles.bidInfo}>
                        <ThemedText type="smallBold">
                          {bid.provider?.full_name ?? 'Provider'} · Rs{' '}
                          {bid.price_pkr.toLocaleString('en-US')}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {reputationLabel({
                            ratingCount: bid.provider?.rating_count ?? 0,
                            ratingSum: bid.provider?.rating_sum ?? 0,
                          })}
                          {bid.note ? ` · ${bid.note}` : ''}
                        </ThemedText>
                      </ThemedView>
                      <Pressable
                        onPress={() =>
                          bid.provider &&
                          onAward(item.id, bid.id, bid.provider.id, bid.provider.full_name)
                        }
                        disabled={awardingBidId !== null}
                        style={({ pressed }) => [styles.awardButton, pressed && styles.pressed]}>
                        <ThemedText type="default" style={styles.awardLabel}>
                          {awardingBidId === bid.id ? 'Awarding…' : 'Award'}
                        </ThemedText>
                      </Pressable>
                    </ThemedView>
                  ))
                ))}

              {item.status === 'awarded' && (
                <>
                  {contacts[item.id] ? (
                    <ThemedView type="background" style={styles.contactBox}>
                      <ThemedText type="smallBold">{contacts[item.id].providerName}</ThemedText>
                      <ThemedText type="default" selectable>
                        {contacts[item.id].providerPhone}
                      </ThemedText>
                    </ThemedView>
                  ) : (
                    <Pressable
                      onPress={() => onShowContacts(item.id)}
                      style={({ pressed }) => [styles.awardButton, pressed && styles.pressed]}>
                      <ThemedText type="default" style={styles.awardLabel}>
                        Show contact details
                      </ThemedText>
                    </Pressable>
                  )}
                  {/* Story 2.9: once the work is done (paid offline in cash), the resident closes
                      the job out — which unlocks rating (Story 3.1). */}
                  <Pressable
                    onPress={() => onComplete(item.id)}
                    disabled={completingJobId !== null}
                    style={({ pressed }) => [styles.completeButton, pressed && styles.pressed]}>
                    <ThemedText type="default" style={styles.awardLabel}>
                      {completingJobId === item.id ? 'Completing…' : 'Mark complete'}
                    </ThemedText>
                  </Pressable>
                </>
              )}

              {item.status === 'completed' &&
                (item.rating ? (
                  // Story 3.1: rated state — read-only (ratings are write-once).
                  <ThemedView type="background" style={styles.contactBox}>
                    <ThemedText type="smallBold">
                      {'★'.repeat(item.rating.stars)}
                      {'☆'.repeat(5 - item.rating.stars)} · You rated this {item.rating.stars}/5
                    </ThemedText>
                    {item.rating.review ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        “{item.rating.review}”
                      </ThemedText>
                    ) : null}
                  </ThemedView>
                ) : (
                  // Story 3.1: rate control — 1–5 stars + optional review.
                  <ThemedView type="background" style={styles.contactBox}>
                    <ThemedText type="smallBold">Rate this job</ThemedText>
                    <ThemedView type="background" style={styles.starRow}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Pressable
                          key={n}
                          onPress={() => setStarDraft((prev) => ({ ...prev, [item.id]: n }))}
                          hitSlop={8}
                          style={styles.star}>
                          <ThemedText type="title">
                            {(starDraft[item.id] ?? 0) >= n ? '★' : '☆'}
                          </ThemedText>
                        </Pressable>
                      ))}
                    </ThemedView>
                    <TextInput
                      value={reviewDraft[item.id] ?? ''}
                      onChangeText={(t) =>
                        setReviewDraft((prev) => ({ ...prev, [item.id]: t }))
                      }
                      placeholder="Add a short review (optional)"
                      multiline
                      style={styles.reviewInput}
                    />
                    <Pressable
                      onPress={() =>
                        item.awarded_provider_id &&
                        onSubmitRating(item.id, item.awarded_provider_id)
                      }
                      disabled={!isValidStars(starDraft[item.id] ?? 0) || ratingJobId !== null}
                      style={({ pressed }) => [
                        styles.completeButton,
                        (!isValidStars(starDraft[item.id] ?? 0) || ratingJobId !== null) &&
                          styles.disabledButton,
                        pressed && styles.pressed,
                      ]}>
                      <ThemedText type="default" style={styles.awardLabel}>
                        {ratingJobId === item.id ? 'Submitting…' : 'Submit rating'}
                      </ThemedText>
                    </Pressable>
                  </ThemedView>
                ))}
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
  notice: { padding: Spacing.three, borderRadius: Spacing.three },
  empty: { padding: Spacing.four, borderRadius: Spacing.three, gap: Spacing.one },
  error: { color: '#c0392b' },
  jobCard: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  bidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  bidInfo: { flex: 1, gap: Spacing.half },
  awardButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    backgroundColor: '#208AEF',
    minHeight: 44,
    justifyContent: 'center',
  },
  awardLabel: { color: '#ffffff' },
  completeButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    backgroundColor: '#1B9E5A',
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  contactBox: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  starRow: { flexDirection: 'row', gap: Spacing.two },
  star: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  reviewInput: {
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: Spacing.two,
    padding: Spacing.three,
    fontSize: 16,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  disabledButton: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
});
