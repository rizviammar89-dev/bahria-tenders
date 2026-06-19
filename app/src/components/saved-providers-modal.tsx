// Resident's saved providers — favorited tradesmen, with quick "View profile" and "Re-hire"
// (re-hire jumps to Post a Job pre-set to that provider's trade).
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { fetchFavorites, type FavoriteProvider } from '@/lib/favorites';
import { fetchServices, type Service } from '@/lib/jobs';
import { providerPhotoUrl } from '@/lib/provider-profile';
import { reputationLabel } from '@/lib/reputation';

export function SavedProvidersModal({
  visible,
  onClose,
  onViewProfile,
  onRehire,
}: {
  visible: boolean;
  onClose: () => void;
  onViewProfile: (providerId: string) => void;
  onRehire: (serviceId: string | null) => void;
}) {
  const [providers, setProviders] = useState<FavoriteProvider[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    (async () => {
      const [{ providers: p }, { services: s }] = await Promise.all([fetchFavorites(), fetchServices()]);
      if (!active) return;
      setProviders(p);
      setServices(s);
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, [visible]);

  function tradesOf(p: FavoriteProvider): string {
    return p.serviceIds
      .map((id) => services.find((s) => s.id === id)?.display_en)
      .filter(Boolean)
      .join(' · ');
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ThemedView style={styles.sheet}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Saved providers</ThemedText>
            <Pressable onPress={onClose} hitSlop={8}>
              <ThemedText type="smallBold" style={styles.close}>
                Close
              </ThemedText>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.list}>
            {loaded && providers.length === 0 && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
                No saved providers yet. Tap the heart on a provider&apos;s profile to save them.
              </ThemedText>
            )}
            {providers.map((p) => (
              <ThemedView key={p.id} type="backgroundElement" style={styles.card}>
                <View style={styles.row}>
                  {p.avatarPath ? (
                    <Image
                      source={{ uri: providerPhotoUrl(p.avatarPath) }}
                      style={styles.avatar}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <MaterialCommunityIcons name="account" size={28} color={Brand.accent} />
                    </View>
                  )}
                  <View style={styles.info}>
                    <ThemedText type="smallBold">{p.fullName}</ThemedText>
                    {tradesOf(p) ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        {tradesOf(p)}
                      </ThemedText>
                    ) : null}
                    <ThemedText type="small" themeColor="textSecondary">
                      {reputationLabel({ ratingCount: p.ratingCount, ratingSum: p.ratingSum })}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.actions}>
                  <Pressable onPress={() => onViewProfile(p.id)} hitSlop={6}>
                    <ThemedText type="small" style={styles.link}>
                      View profile
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => onRehire(p.serviceIds[0] ?? null)}
                    style={({ pressed }) => [styles.rehireBtn, pressed && styles.pressed]}>
                    <ThemedText type="small" style={styles.rehireLabel}>
                      Re-hire
                    </ThemedText>
                  </Pressable>
                </View>
              </ThemedView>
            ))}
          </ScrollView>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    maxHeight: '82%',
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { color: Brand.primary },
  list: { gap: Spacing.three, paddingBottom: Spacing.two },
  empty: { textAlign: 'center', marginTop: Spacing.four },
  card: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#eee' },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: Spacing.half },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { color: Brand.primary, textDecorationLine: 'underline' },
  rehireBtn: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    backgroundColor: Brand.primary,
    minHeight: 40,
    justifyContent: 'center',
  },
  rehireLabel: { color: '#ffffff' },
  pressed: { opacity: 0.7 },
});
