// Dual-role + subscription control on the home screen. Three states:
//  1. Active provider (trial/subscription current) → Hire ⇄ Work toggle + access countdown.
//  2. Expired provider → renew paywall (Rs 2500/month). Provider features are locked until they pay.
//  3. Not a provider → "Offer my services" → pick trades → start the 2-month free trial.
import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { fetchServices, type Service } from '@/lib/jobs';
import { startSubscriptionCheckout, SUBSCRIPTION_PKR } from '@/lib/subscription';

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function ModeSwitcher() {
  const theme = useTheme();
  const { role, isProvider, providerActive, providerAccessUntil, switchMode, enableProvider } =
    useAuth();
  const [setupOpen, setSetupOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

  // Provider (active OR expired) → show the Hire/Work toggle. Tapping Work switches if access is
  // current; if expired, it opens the paywall instead of switching.
  if (isProvider) {
    const days = daysUntil(providerAccessUntil);
    const onWork = () => {
      if (role === 'provider') return; // already in Work mode
      if (!providerActive) {
        setPaywallOpen(true);
        return;
      }
      Alert.alert(
        'Go online as a provider?',
        'While you’re in Work mode, residents looking for your trade can see your location on the map and contact you directly. Switch back to Hire mode anytime to hide yourself.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Go online', onPress: () => switchMode('provider') },
        ],
      );
    };
    return (
      <View style={styles.wrap}>
        <View style={[styles.segment, { borderColor: Brand.primary }]}>
          <Pressable
            onPress={() => switchMode('resident')}
            style={[styles.segmentItem, role === 'resident' && { backgroundColor: Brand.primary }]}>
            <ThemedText
              type="smallBold"
              style={role === 'resident' ? styles.segmentSelected : { color: Brand.primary }}>
              Hire
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={onWork}
            style={[styles.segmentItem, role === 'provider' && { backgroundColor: Brand.primary }]}>
            <ThemedText
              type="smallBold"
              style={role === 'provider' ? styles.segmentSelected : { color: Brand.primary }}>
              Work
            </ThemedText>
          </Pressable>
        </View>
        {providerActive && days != null && days <= 14 && (
          <Pressable onPress={() => setPaywallOpen(true)}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.countdown}>
              Provider access ends in {days} day{days === 1 ? '' : 's'} ·{' '}
              <ThemedText type="smallBold" style={{ color: Brand.primary }}>
                Renew
              </ThemedText>
            </ThemedText>
          </Pressable>
        )}
        <PaywallModal visible={paywallOpen} onClose={() => setPaywallOpen(false)} />
      </View>
    );
  }

  // Not a provider → offer to become one (starts the free trial).
  return (
    <>
      <Pressable
        onPress={() => setSetupOpen(true)}
        style={({ pressed }) => [
          styles.offerButton,
          { borderColor: Brand.primary },
          pressed && styles.pressed,
        ]}>
        <ThemedText type="smallBold" style={{ color: Brand.primary }}>
          Offer my services →
        </ThemedText>
      </Pressable>
      <BecomeProviderModal
        visible={setupOpen}
        onClose={() => setSetupOpen(false)}
        onEnable={enableProvider}
        theme={theme}
      />
    </>
  );
}

function PaywallModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { refreshRole } = useAuth();
  const [busy, setBusy] = useState(false);

  async function onPay() {
    if (busy) return;
    setBusy(true);
    const { error } = await startSubscriptionCheckout();
    setBusy(false);
    if (error) {
      Alert.alert('Payment', error);
      return;
    }
    // The webhook extends access asynchronously — refresh now and again shortly after so the UI
    // reflects the new access once Safepay's webhook lands.
    refreshRole();
    setTimeout(refreshRole, 4000);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.centerBackdrop}>
        <ThemedView style={styles.card}>
          <ThemedText type="subtitle" style={styles.cardTitle}>
            Provider subscription
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.cardBody}>
            Your free trial is over. Pay Rs {SUBSCRIPTION_PKR}/month to keep working — bidding on jobs,
            getting job alerts, and appearing on the map. You can still hire anytime.
          </ThemedText>
          <Pressable
            onPress={onPay}
            disabled={busy}
            style={({ pressed }) => [styles.payButton, pressed && styles.pressed]}>
            <ThemedText type="default" style={styles.payLabel}>
              {busy ? 'Opening…' : `Pay Rs ${SUBSCRIPTION_PKR} / month`}
            </ThemedText>
          </Pressable>
          <Pressable onPress={onClose} hitSlop={8} style={styles.cardClose}>
            <ThemedText type="smallBold" style={{ color: Brand.primary }}>
              Not now
            </ThemedText>
          </Pressable>
        </ThemedView>
      </View>
    </Modal>
  );
}

function BecomeProviderModal({
  visible,
  onClose,
  onEnable,
  theme,
}: {
  visible: boolean;
  onClose: () => void;
  onEnable: (serviceIds: string[]) => Promise<{ error: string | null }>;
  theme: ReturnType<typeof useTheme>;
}) {
  const [services, setServices] = useState<Service[]>([]);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    fetchServices().then(({ services: rows }) => {
      if (!cancelled) setServices(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  function toggle(id: string) {
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  async function onConfirm() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error: e } = await onEnable(serviceIds);
    setBusy(false);
    if (e) {
      setError(e);
      return;
    }
    onClose(); // enableProvider already switched the active view to provider
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ThemedView style={styles.sheet}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Offer your services</ThemedText>
            <Pressable onPress={onClose} hitSlop={8}>
              <ThemedText type="smallBold" style={{ color: Brand.primary }}>
                Close
              </ThemedText>
            </Pressable>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Pick the trade(s) you work in. You get a 2-month free trial, then Rs {SUBSCRIPTION_PKR}/month.
            You can switch between hiring and working anytime — your account keeps both.
          </ThemedText>

          <ScrollView contentContainerStyle={styles.grid}>
            {services.map((s) => {
              const selected = serviceIds.includes(s.id);
              return (
                <Pressable
                  key={s.id}
                  onPress={() => toggle(s.id)}
                  style={[
                    styles.tile,
                    {
                      backgroundColor: selected ? Brand.primary : theme.backgroundElement,
                      borderColor: selected ? Brand.primary : theme.backgroundSelected,
                    },
                  ]}>
                  <ThemedText type="small" style={selected ? styles.segmentSelected : undefined}>
                    {s.display_en}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>

          {error && (
            <ThemedText type="small" style={styles.error}>
              {error}
            </ThemedText>
          )}
          <Pressable
            onPress={onConfirm}
            disabled={busy}
            style={({ pressed }) => [styles.confirm, pressed && styles.pressed]}>
            <ThemedText type="default" style={styles.confirmLabel}>
              {busy ? 'Enabling…' : 'Start free trial'}
            </ThemedText>
          </Pressable>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: Spacing.one },
  segment: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: Spacing.four,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  segmentItem: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    minWidth: 84,
    alignItems: 'center',
  },
  segmentSelected: { color: '#ffffff' },
  countdown: { textAlign: 'center' },
  offerButton: {
    borderWidth: 1,
    borderRadius: Spacing.four,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'center',
  },
  paywall: {
    alignSelf: 'stretch',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  payButton: {
    backgroundColor: Brand.primary,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  payLabel: { color: '#ffffff' },
  centerBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  cardTitle: { textAlign: 'center' },
  cardBody: { textAlign: 'center', lineHeight: 22 },
  cardClose: { alignItems: 'center', paddingVertical: Spacing.two },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    maxHeight: '80%',
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  tile: {
    width: '31%',
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.one,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { color: '#c0392b' },
  confirm: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  confirmLabel: { color: '#ffffff' },
  pressed: { opacity: 0.7 },
});
