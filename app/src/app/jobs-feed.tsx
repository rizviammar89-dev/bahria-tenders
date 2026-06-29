// Story 2.3: Provider Job Discovery (FR-7). A verified provider sees open jobs in their
// trades. RLS jobs_select_visible is the security backstop; the query filters to relevance.
import { useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BidModal } from '@/components/bid-modal';
import { ChatModal, type ChatThread } from '@/components/chat-modal';
import { RateResidentCard } from '@/components/rate-resident-card';
import { ScheduleCard } from '@/components/schedule-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import {
  availabilityIsFresh,
  fetchMyAvailability,
  publishLocation,
  setAvailability,
  shouldPublish,
} from '@/lib/availability';
import { callNumber } from '@/lib/call';
import { jobPhotoUrl } from '@/lib/job-photos';
import { useAuth } from '@/lib/auth';
import { fetchMyAwardedJobs, fetchOpenJobsForMyTrades, type AwardedJob, type OpenJob } from '@/lib/jobs';
import { getCurrentPosition, requestForegroundPermission } from '@/lib/location';
import { getJobContacts } from '@/lib/my-jobs';
import { formatSchedule } from '@/lib/schedule';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/lib/time-ago';

const PUBLISH_THROTTLE_MS = 20_000; // Story 6.2: bound battery — publish at most every ~20s
const AVAILABILITY_WINDOW_MINS = 15; // mirrors provider_is_available's auto-expiry window

export default function JobsFeedScreen() {
  const [jobs, setJobs] = useState<OpenJob[]>([]);
  const [awardedJobs, setAwardedJobs] = useState<AwardedJob[]>([]);
  const [callingJobId, setCallingJobId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(0); // stamped at load time (Date.now() is impure → keep it out of render)
  const [bidJob, setBidJob] = useState<OpenJob | null>(null); // open the bid modal for this job
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [available, setAvailable] = useState(false); // Story 6.2: provider availability
  const [availMsg, setAvailMsg] = useState<string | null>(null);
  const [chatThread, setChatThread] = useState<ChatThread | null>(null);
  const myUid = useAuth().session?.user?.id ?? null;
  const lastPublishRef = useRef<number | null>(null);
  const mounted = useRef(true);

  // Single fetch path, used by both the initial load and pull-to-refresh.
  const load = useCallback(async () => {
    const [{ jobs: rows, error }, { jobs: awarded }] = await Promise.all([
      fetchOpenJobsForMyTrades(),
      fetchMyAwardedJobs(),
    ]);
    if (!mounted.current) return; // unmounted mid-fetch → don't setState
    setNow(Date.now());
    setLoadError(error ? "Couldn't load jobs — pull to refresh." : null);
    if (!error) setJobs(rows);
    setAwardedJobs(awarded);
    setLoaded(true);
  }, []);

  // Reach the resident of a won job — fetch contacts then open the dialer (number never shown).
  async function onCallResident(jobId: string) {
    if (callingJobId) return;
    setCallingJobId(jobId);
    const { contacts, error } = await getJobContacts(jobId);
    if (!mounted.current) return;
    if (error || !contacts) setAvailMsg("Couldn't get the resident's contact — please try again.");
    else callNumber(contacts.residentPhone);
    setCallingJobId(null);
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Refetch whenever the Jobs tab regains focus, so switching to it is always current.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Live updates: a new/changed job streams in via Realtime → refetch so it appears without a manual
  // pull. RLS on the stream means only visible (open) jobs trigger this. fetchOpenJobsForMyTrades
  // re-applies the trade/own-job filters, so we just re-run it on any change.
  useEffect(() => {
    const channel = supabase
      .channel('jobs_feed_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
        load();
      })
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [load]);

  // Story 6.2: hydrate the toggle from the DB on mount, so the UI matches server state (and the
  // publisher resumes) if the provider was still Available + fresh after an app restart.
  useEffect(() => {
    (async () => {
      const { isAvailable, updatedAt } = await fetchMyAvailability();
      if (!mounted.current) return;
      if (isAvailable && availabilityIsFresh(updatedAt, Date.now(), AVAILABILITY_WINDOW_MINS)) {
        setAvailable(true);
      }
    })();
  }, []);

  // Story 6.2: toggle availability. Turning ON first asks for location permission (consent).
  async function onToggleAvailable() {
    const next = !available;
    setAvailMsg(null);
    if (next) {
      const granted = await requestForegroundPermission();
      if (!mounted.current) return;
      if (!granted) {
        setAvailMsg('Location permission is needed to go Available — enable it to share your position.');
        return;
      }
    }
    const { error } = await setAvailability(next);
    if (!mounted.current) return;
    if (error) {
      console.warn('setAvailability failed:', error);
      setAvailMsg("Couldn't update availability — please try again.");
      return;
    }
    setAvailable(next);
    setAvailMsg(
      next
        ? 'You are Available — residents can see you on the map while this screen is open.'
        : 'You are Unavailable — your location is no longer shared.',
    );
  }

  // Story 6.2: while Available + foregrounded, publish throttled location. Guarded getCurrentPosition
  // returns null on a build without expo-location (pre-6.3) → inert, no crash. Stops on Unavailable/unmount.
  useEffect(() => {
    if (!available) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled || AppState.currentState !== 'active') return;
      const ts = Date.now();
      if (!shouldPublish(lastPublishRef.current, ts, PUBLISH_THROTTLE_MS)) return;
      const pos = await getCurrentPosition();
      if (cancelled || !pos) return;
      lastPublishRef.current = ts;
      await publishLocation(pos.lat, pos.lng);
    };
    tick();
    const id = setInterval(tick, PUBLISH_THROTTLE_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [available]);

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
              <Pressable
                onPress={onToggleAvailable}
                style={({ pressed }) => [
                  styles.availToggle,
                  { backgroundColor: available ? Brand.primary : Brand.sand },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={{ color: available ? '#ffffff' : Brand.ink }}>
                  {available ? '● Available' : '○ Unavailable — tap to go online'}
                </ThemedText>
              </Pressable>
              {availMsg && (
                <ThemedText type="small" themeColor="textSecondary">
                  {availMsg}
                </ThemedText>
              )}
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

              {awardedJobs.length > 0 && (
                <ThemedView style={styles.awardedSection}>
                  <ThemedText type="smallBold">Your awarded jobs</ThemedText>
                  {awardedJobs.map((aj) => (
                    <ThemedView key={aj.id} type="backgroundElement" style={styles.awardedCard}>
                      <ThemedText type="smallBold">
                        {aj.service ? `${aj.service.display_en} · ${aj.service.display_ur}` : 'Job'}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {aj.precinct} · {aj.status === 'completed' ? 'Completed' : 'Awarded to you'}
                      </ThemedText>
                      <ThemedText type="default">{aj.description}</ThemedText>
                      <View style={styles.awardedActions}>
                        <Pressable
                          onPress={() => onCallResident(aj.id)}
                          disabled={callingJobId !== null}
                          style={({ pressed }) => [styles.callButton, pressed && styles.pressed]}>
                          <ThemedText type="default" style={styles.callLabel}>
                            {callingJobId === aj.id ? 'Connecting…' : '📞 Call'}
                          </ThemedText>
                        </Pressable>
                        {myUid && (
                          <Pressable
                            onPress={() =>
                              setChatThread({
                                jobId: aj.id,
                                providerId: myUid,
                                otherPartyId: aj.resident_id,
                                title: 'Resident',
                              })
                            }
                            style={({ pressed }) => [styles.chatButton, pressed && styles.pressed]}>
                            <ThemedText type="default" style={styles.chatLabel}>
                              💬 Chat
                            </ThemedText>
                          </Pressable>
                        )}
                      </View>
                      {aj.status === 'awarded' && (
                        <ScheduleCard
                          jobId={aj.id}
                          myUid={myUid}
                          scheduledDate={aj.scheduled_date}
                          scheduledSlot={aj.scheduled_slot}
                          proposedBy={aj.schedule_proposed_by}
                          confirmed={aj.schedule_confirmed}
                          onChanged={load}
                        />
                      )}
                      {aj.status === 'completed' &&
                        (aj.ratedResident ? (
                          <ThemedText type="small" themeColor="textSecondary">
                            ✓ You reviewed this resident
                          </ThemedText>
                        ) : (
                          <RateResidentCard jobId={aj.id} residentId={aj.resident_id} onRated={load} />
                        ))}
                    </ThemedView>
                  ))}
                </ThemedView>
              )}

              {jobs.length > 0 && <ThemedText type="smallBold">Open jobs</ThemedText>}
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
              <ThemedText type="small" themeColor="textSecondary">
                👤 Resident:{' '}
                {item.residentRating.count > 0
                  ? `★ ${(item.residentRating.sum / item.residentRating.count).toFixed(1)} (${item.residentRating.count})`
                  : 'New customer'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                🗓 Needed: {formatSchedule(item.preferred_date, item.preferred_slot, now ? new Date(now) : new Date())}
              </ThemedText>
              <ThemedText type="default">{item.description}</ThemedText>
              {item.photo_paths.length > 0 && (
                <View style={styles.thumbRow}>
                  {item.photo_paths.map((path) => (
                    <Image
                      key={path}
                      source={{ uri: jobPhotoUrl(path) }}
                      style={styles.thumb}
                      contentFit="cover"
                    />
                  ))}
                </View>
              )}
              <View style={styles.openActions}>
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
                {item.myBid && myUid && (
                  <Pressable
                    onPress={() =>
                      setChatThread({
                        jobId: item.id,
                        providerId: myUid,
                        otherPartyId: item.resident_id,
                        title: 'Resident',
                      })
                    }
                    style={({ pressed }) => [styles.chatButton, pressed && styles.pressed]}>
                    <ThemedText type="default" style={styles.chatLabel}>
                      💬 Chat
                    </ThemedText>
                  </Pressable>
                )}
              </View>
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
        <ChatModal thread={chatThread} onClose={() => setChatThread(null)} />
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
  availToggle: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two, minHeight: 64 },
  awardedSection: { gap: Spacing.two, marginTop: Spacing.one },
  awardedCard: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  callButton: {
    marginTop: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    backgroundColor: '#1B9E5A',
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  callLabel: { color: '#ffffff' },
  awardedActions: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  openActions: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap', alignItems: 'center' },
  chatButton: {
    marginTop: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: Brand.primary,
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  chatLabel: { color: Brand.primary },
  thumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  thumb: { width: 72, height: 72, borderRadius: Spacing.two, backgroundColor: '#eee' },
  empty: { padding: Spacing.four, borderRadius: Spacing.three, gap: Spacing.one },
  error: { color: '#c0392b' },
  bidButton: {
    marginTop: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    backgroundColor: Brand.primary,
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  bidButtonLabel: { color: '#ffffff' },
  pressed: { opacity: 0.7 },
});
