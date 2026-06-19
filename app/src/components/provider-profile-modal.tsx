// Quick-dev: read-only provider profile shown to residents (e.g. tapping a bidder in My Jobs).
// Same data as the provider's own Profile tab — name, picture, trade(s), reviews, work gallery —
// but no editing. Modal over the screen, matching the BidModal pattern (no routing change).
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { addFavorite, fetchFavoriteIds, removeFavorite } from '@/lib/favorites';
import { fetchServices, type Service } from '@/lib/jobs';
import {
  fetchProviderProfile,
  fetchProviderReviews,
  providerPhotoUrl,
  type ProviderProfile,
  type ProviderReview,
} from '@/lib/provider-profile';
import { reputationLabel } from '@/lib/reputation';

export function ProviderProfileModal({
  providerId,
  onClose,
}: {
  providerId: string | null;
  onClose: () => void;
}) {
  const isResident = useAuth().role === 'resident';
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [reviews, setReviews] = useState<ProviderReview[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [favBusy, setFavBusy] = useState(false);

  useEffect(() => {
    if (!providerId || !isResident) return;
    let active = true;
    fetchFavoriteIds().then((ids) => {
      if (active) setIsFav(ids.has(providerId));
    });
    return () => {
      active = false;
    };
  }, [providerId, isResident]);

  async function onToggleFavorite() {
    if (!providerId || favBusy) return;
    setFavBusy(true);
    const next = !isFav;
    setIsFav(next); // optimistic
    const { error } = next ? await addFavorite(providerId) : await removeFavorite(providerId);
    if (error) setIsFav(!next); // revert on failure
    setFavBusy(false);
  }

  useEffect(() => {
    if (!providerId) return;
    let active = true;
    // Mark loading + clear any prior provider's data, then load. setState lives in the async
    // callbacks (not synchronously in the effect body) to satisfy react-hooks/set-state-in-effect.
    (async () => {
      setLoading(true);
      setProfile(null);
      const [{ profile: p }, { reviews: r }, { services: s }] = await Promise.all([
        fetchProviderProfile(providerId),
        fetchProviderReviews(providerId),
        fetchServices(),
      ]);
      if (!active) return;
      setProfile(p);
      setReviews(r);
      setServices(s);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [providerId]);

  const trades = profile
    ? profile.serviceIds
        .map((id) => services.find((s) => s.id === id)?.display_en)
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <Modal
      visible={providerId !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ThemedView style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.scroll}>
            {loading && <ActivityIndicator style={styles.loader} />}

            {profile && (
              <>
                <View style={styles.identity}>
                  {profile.avatarPath ? (
                    <Image
                      source={{ uri: providerPhotoUrl(profile.avatarPath) }}
                      style={styles.avatar}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <MaterialCommunityIcons name="account" size={40} color={Brand.accent} />
                    </View>
                  )}
                  <View style={styles.identityText}>
                    <ThemedText type="subtitle">{profile.fullName}</ThemedText>
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
                  {isResident && (
                    <Pressable onPress={onToggleFavorite} disabled={favBusy} hitSlop={8}>
                      <MaterialCommunityIcons
                        name={isFav ? 'heart' : 'heart-outline'}
                        size={28}
                        color={isFav ? '#c0392b' : Brand.accent}
                      />
                    </Pressable>
                  )}
                </View>

                {profile.workPhotoPaths.length > 0 && (
                  <>
                    <ThemedText type="smallBold">Work done</ThemedText>
                    <View style={styles.thumbRow}>
                      {profile.workPhotoPaths.map((path) => (
                        <Image
                          key={path}
                          source={{ uri: providerPhotoUrl(path) }}
                          style={styles.workThumb}
                          contentFit="cover"
                        />
                      ))}
                    </View>
                  </>
                )}

                <ThemedText type="smallBold">Reviews ({reviews.length})</ThemedText>
                {reviews.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    No reviews yet.
                  </ThemedText>
                ) : (
                  reviews.map((rev) => (
                    <ThemedView key={rev.id} type="backgroundElement" style={styles.reviewCard}>
                      <ThemedText type="smallBold">
                        {'★'.repeat(rev.stars)}
                        {'☆'.repeat(5 - rev.stars)}
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

            <Pressable
              onPress={onClose}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
              <ThemedText type="default" style={styles.closeLabel}>
                Close
              </ThemedText>
            </Pressable>
          </ScrollView>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
  },
  scroll: { padding: Spacing.four, gap: Spacing.three },
  loader: { marginVertical: Spacing.four },
  identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#eee' },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  identityText: { flex: 1, gap: Spacing.half },
  thumbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  workThumb: { width: 96, height: 96, borderRadius: Spacing.two, backgroundColor: '#eee' },
  reviewCard: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one },
  closeButton: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  closeLabel: { color: '#ffffff' },
  pressed: { opacity: 0.7 },
});
