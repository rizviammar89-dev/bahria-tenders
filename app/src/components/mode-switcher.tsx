// Dual-role: lets one account flip between hiring (resident view) and working (provider view).
// Provider accounts get a two-way segmented toggle; resident-only accounts get a "Offer my
// services" button that, on first use, collects trades and enables provider mode (open model:
// instant — see set_provider_trust_on_enable in 20260620120000_dual_role.sql).
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { fetchServices, type Service } from '@/lib/jobs';

export function ModeSwitcher() {
  const theme = useTheme();
  const { role, isProvider, switchMode, enableProvider } = useAuth();
  const [setupOpen, setSetupOpen] = useState(false);

  if (isProvider) {
    return (
      <View style={[styles.segment, { borderColor: Brand.primary }]}>
        {(['resident', 'provider'] as const).map((m) => {
          const selected = role === m;
          return (
            <Pressable
              key={m}
              onPress={() => switchMode(m)}
              style={[styles.segmentItem, selected && { backgroundColor: Brand.primary }]}>
              <ThemedText
                type="smallBold"
                style={selected ? styles.segmentSelected : { color: Brand.primary }}>
                {m === 'resident' ? 'Hire' : 'Work'}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    );
  }

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
            Pick the trade(s) you work in. You can switch between hiring and working anytime — your
            account keeps both.
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
              {busy ? 'Enabling…' : 'Start offering services'}
            </ThemedText>
          </Pressable>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  offerButton: {
    borderWidth: 1,
    borderRadius: Spacing.four,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'center',
  },
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
