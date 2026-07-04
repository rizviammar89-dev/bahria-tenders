// Home tab: branded landing (brand mockup). Logo + hero + a role-aware Get Started CTA.
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EditProfileModal } from '@/components/edit-profile-modal';
import { ModeSwitcher } from '@/components/mode-switcher';
import { ProviderProfileModal } from '@/components/provider-profile-modal';
import { SavedProvidersModal } from '@/components/saved-providers-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function HomeScreen() {
  const router = useRouter();
  const { role, session } = useAuth();
  const isResident = role === 'resident';
  const [savedOpen, setSavedOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [viewProviderId, setViewProviderId] = useState<string | null>(null);
  const [customerRating, setCustomerRating] = useState<{ sum: number; count: number } | null>(null);

  // The resident's own reputation as a customer (two-way reviews) — shown below the hero.
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid || !isResident) return;
    let active = true;
    supabase
      .from('profiles')
      .select('resident_rating_sum, resident_rating_count')
      .eq('id', uid)
      .single()
      .then(({ data }) => {
        if (active && data)
          setCustomerRating({
            sum: (data.resident_rating_sum as number) ?? 0,
            count: (data.resident_rating_count as number) ?? 0,
          });
      });
    return () => {
      active = false;
    };
  }, [session?.user?.id, isResident]);

  function onSignOut() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Logo sits directly above the skyline watermark as one brand block. */}
        <View style={styles.brand}>
          <Image
            source={require('@/assets/images/logo-horizontal.png')}
            style={styles.logo}
            contentFit="cover"
            accessibilityLabel="Bahria Tenders"
          />
          <Image
            source={require('@/assets/images/watermark.png')}
            style={styles.watermark}
            contentFit="cover"
            tintColor={Brand.primary}
            pointerEvents="none"
            accessibilityElementsHidden
          />
        </View>

        <ModeSwitcher />

        <View style={styles.hero}>
          <ThemedText type="title" style={styles.heroTitle}>
            Reliable Services
          </ThemedText>
          <ThemedText type="title" style={[styles.heroTitle, styles.heroAccent]}>
            for Your Home
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={styles.heroSub}>
            {isResident
              ? 'Post a job and trusted providers in your precinct will send you a price.'
              : 'See jobs near you and send your price — get hired on your work, not the lowest bid.'}
          </ThemedText>
          {isResident && customerRating && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.heroSub}>
              {customerRating.count > 0
                ? `Your customer rating: ★ ${(customerRating.sum / customerRating.count).toFixed(1)} (${customerRating.count})`
                : 'No customer reviews yet'}
            </ThemedText>
          )}
        </View>

        <Pressable
          onPress={() => router.navigate(isResident ? '/post-job' : '/jobs-feed')}
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
          <ThemedText type="default" style={styles.ctaLabel}>
            {isResident ? 'Post a Job' : 'Find Jobs'}
          </ThemedText>
        </Pressable>

        {isResident && (
          <Pressable
            onPress={() => setSavedOpen(true)}
            style={({ pressed }) => [styles.saved, pressed && styles.pressed]}>
            <MaterialCommunityIcons name="heart" size={16} color={Brand.accent} />
            <ThemedText type="smallBold" style={styles.savedLabel}>
              Saved providers
            </ThemedText>
          </Pressable>
        )}

        <Pressable
          onPress={() => setEditOpen(true)}
          style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}>
          <ThemedText type="small" themeColor="textSecondary">
            Edit profile
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={onSignOut}
          style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}>
          <ThemedText type="small" themeColor="textSecondary">
            Sign out
          </ThemedText>
        </Pressable>
      </SafeAreaView>

      <SavedProvidersModal
        visible={savedOpen}
        onClose={() => setSavedOpen(false)}
        onViewProfile={(id) => {
          setSavedOpen(false);
          setViewProviderId(id);
        }}
        onRehire={(serviceId) => {
          setSavedOpen(false);
          router.navigate({ pathname: '/post-job', params: serviceId ? { serviceId } : {} });
        }}
      />
      <ProviderProfileModal providerId={viewProviderId} onClose={() => setViewProviderId(null)} />
      <EditProfileModal visible={editOpen} onClose={() => setEditOpen(false)} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  watermark: {
    width: '100%',
    height: 150,
    opacity: 0.5,
    marginTop: -24,
    transform: [{ scale: 1.25 }],
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  brand: { width: '100%', alignItems: 'center', marginTop: 120 },
  logo: { width: '100%', height: 150 },
  hero: { alignItems: 'center', gap: Spacing.one, marginTop: -4 },
  heroTitle: { fontSize: 26, lineHeight: 32, textAlign: 'center' },
  heroAccent: { color: Brand.accent },
  heroSub: { textAlign: 'center', marginTop: Spacing.three, paddingHorizontal: Spacing.two },
  cta: {
    backgroundColor: Brand.primary,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.six,
    borderRadius: Spacing.four,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  ctaLabel: { color: '#ffffff', fontSize: 18 },
  saved: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.four,
    borderWidth: 1,
    borderColor: Brand.primary,
    minHeight: 44,
    justifyContent: 'center',
  },
  savedLabel: { color: Brand.primary },
  signOut: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.four },
  pressed: { opacity: 0.7 },
});
