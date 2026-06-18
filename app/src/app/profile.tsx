// Quick-dev: a provider's own profile — name, picture, trade(s), the reviews they've received,
// and a "work done" photo gallery they can add to. Picture/work uploads use expo-image-picker
// (native — needs the dev build) via the guarded job-photos helpers.
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { pickJobPhotos } from '@/lib/job-photos';
import { fetchServices, type Service } from '@/lib/jobs';
import {
  addWorkPhotos,
  fetchProviderProfile,
  fetchProviderReviews,
  providerPhotoUrl,
  removeWorkPhoto,
  uploadAvatar,
  type ProviderProfile,
  type ProviderReview,
} from '@/lib/provider-profile';
import { reputationLabel } from '@/lib/reputation';
import { timeAgo } from '@/lib/time-ago';
import { useAuth } from '@/lib/auth';

export default function ProfileScreen() {
  const uid = useAuth().session?.user?.id ?? null;
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [reviews, setReviews] = useState<ProviderReview[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false); // avatar/work upload in flight
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    if (!uid) return;
    const [{ profile: p }, { reviews: r }, { services: s }] = await Promise.all([
      fetchProviderProfile(uid),
      fetchProviderReviews(uid),
      fetchServices(),
    ]);
    if (!mounted.current) return;
    setNow(Date.now());
    if (p) setProfile(p);
    setReviews(r);
    setServices(s);
    setLoaded(true);
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      mounted.current = true;
      load();
      return () => {
        mounted.current = false;
      };
    }, [load]),
  );

  async function onChangeAvatar() {
    if (!uid || busy) return;
    const picked = await pickJobPhotos();
    if (!picked.length) return;
    setBusy(true);
    setMessage(null);
    const { path, error } = await uploadAvatar(uid, picked[0]);
    if (!mounted.current) return;
    if (error) setMessage("Couldn't update your picture — please try again.");
    else setProfile((prev) => (prev ? { ...prev, avatarPath: path } : prev));
    setBusy(false);
  }

  async function onAddWork() {
    if (!uid || !profile || busy) return;
    const picked = await pickJobPhotos();
    if (!picked.length) return;
    setBusy(true);
    setMessage(null);
    const { paths, error } = await addWorkPhotos(uid, profile.workPhotoPaths, picked);
    if (!mounted.current) return;
    if (error) setMessage("Couldn't add work photos — please try again.");
    else setProfile((prev) => (prev ? { ...prev, workPhotoPaths: paths } : prev));
    setBusy(false);
  }

  function onRemoveWork(path: string) {
    if (!uid || !profile || busy) return;
    Alert.alert('Remove this photo?', 'It will be removed from your work gallery.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          const { paths, error } = await removeWorkPhoto(uid, profile.workPhotoPaths, path);
          if (!mounted.current) return;
          if (error) setMessage("Couldn't remove the photo — please try again.");
          else setProfile((prev) => (prev ? { ...prev, workPhotoPaths: paths } : prev));
          setBusy(false);
        },
      },
    ]);
  }

  const trades = profile
    ? profile.serviceIds
        .map((id) => services.find((s) => s.id === id)?.display_en)
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedText type="subtitle">My Profile</ThemedText>

          {!loaded && <ActivityIndicator style={styles.loader} />}

          {message && (
            <ThemedView type="backgroundElement" style={styles.notice}>
              <ThemedText type="smallBold">{message}</ThemedText>
            </ThemedView>
          )}

          {profile && (
            <>
              {/* Identity: avatar + name + trade + reputation */}
              <ThemedView type="backgroundElement" style={styles.identityCard}>
                <Pressable onPress={onChangeAvatar} disabled={busy} style={styles.avatarWrap}>
                  {profile.avatarPath ? (
                    <Image
                      source={{ uri: providerPhotoUrl(profile.avatarPath) }}
                      style={styles.avatar}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <MaterialCommunityIcons name="account" size={44} color={Brand.accent} />
                    </View>
                  )}
                  <View style={styles.avatarBadge}>
                    <MaterialCommunityIcons name="camera" size={16} color="#ffffff" />
                  </View>
                </Pressable>
                <View style={styles.identityText}>
                  <ThemedText type="smallBold">{profile.fullName}</ThemedText>
                  {trades ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {trades}
                    </ThemedText>
                  ) : null}
                  <ThemedText type="small" themeColor="textSecondary">
                    {reputationLabel({
                      ratingCount: profile.ratingCount,
                      ratingSum: profile.ratingSum,
                    })}
                  </ThemedText>
                </View>
              </ThemedView>

              {/* Work gallery */}
              <View style={styles.sectionHeader}>
                <ThemedText type="smallBold">Work done</ThemedText>
                <Pressable onPress={onAddWork} disabled={busy} hitSlop={8}>
                  <ThemedText type="smallBold" style={styles.addLink}>
                    {busy ? '…' : '+ Add'}
                  </ThemedText>
                </Pressable>
              </View>
              {profile.workPhotoPaths.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Add photos of jobs you&apos;ve completed so residents can see your work.
                </ThemedText>
              ) : (
                <View style={styles.thumbRow}>
                  {profile.workPhotoPaths.map((path) => (
                    <View key={path} style={styles.thumbWrap}>
                      <Image
                        source={{ uri: providerPhotoUrl(path) }}
                        style={styles.workThumb}
                        contentFit="cover"
                      />
                      <Pressable
                        onPress={() => onRemoveWork(path)}
                        hitSlop={8}
                        style={styles.thumbRemove}>
                        <MaterialCommunityIcons name="close-circle" size={22} color="#c0392b" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              {/* Reviews */}
              <ThemedText type="smallBold" style={styles.reviewsHeader}>
                Reviews ({reviews.length})
              </ThemedText>
              {reviews.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  No reviews yet — they appear here after residents rate your completed jobs.
                </ThemedText>
              ) : (
                reviews.map((rev) => (
                  <ThemedView key={rev.id} type="backgroundElement" style={styles.reviewCard}>
                    <ThemedText type="smallBold">
                      {'★'.repeat(rev.stars)}
                      {'☆'.repeat(5 - rev.stars)} · {timeAgo(rev.created_at, now)}
                    </ThemedText>
                    {rev.review ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        “{rev.review}”
                      </ThemedText>
                    ) : null}
                  </ThemedView>
                ))
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: { padding: Spacing.four, gap: Spacing.three },
  loader: { marginTop: Spacing.four },
  notice: { padding: Spacing.three, borderRadius: Spacing.three },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  avatarWrap: { position: 'relative' },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#eee' },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Brand.primary,
    borderRadius: 14,
    padding: 5,
  },
  identityText: { flex: 1, gap: Spacing.half },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
  },
  addLink: { color: Brand.primary },
  thumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  thumbWrap: { position: 'relative' },
  workThumb: { width: 96, height: 96, borderRadius: Spacing.two, backgroundColor: '#eee' },
  thumbRemove: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 11,
  },
  reviewsHeader: { marginTop: Spacing.two },
  reviewCard: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one },
});
