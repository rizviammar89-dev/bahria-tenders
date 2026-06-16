// Home tab: branded landing (brand mockup). Logo + hero + a role-aware Get Started CTA.
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function HomeScreen() {
  const router = useRouter();
  const { role } = useAuth();
  const isResident = role === 'resident';

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
        </View>

        <Pressable
          onPress={() => router.navigate(isResident ? '/post-job' : '/jobs-feed')}
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
          <ThemedText type="default" style={styles.ctaLabel}>
            {isResident ? 'Post a Job' : 'Find Jobs'}
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={() => supabase.auth.signOut()}
          style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}>
          <ThemedText type="small" themeColor="textSecondary">
            Sign out
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  watermark: {
    width: '100%',
    height: 180,
    opacity: 0.5,
    marginTop: -40,
    transform: [{ scale: 1.25 }],
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
  },
  brand: { width: '100%', alignItems: 'center', marginTop: 80 },
  logo: { width: '100%', height: 210 },
  hero: { alignItems: 'center', gap: Spacing.one, marginTop: -12 },
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
  signOut: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.four },
  pressed: { opacity: 0.7 },
});
