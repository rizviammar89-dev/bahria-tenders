// Two-way scheduling widget for an awarded job, used by both resident (My Jobs) and provider
// (feed). One party proposes a day + slot; the other accepts. Re-proposing resets confirmation.
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { acceptSchedule, proposeSchedule } from '@/lib/schedule-appointment';
import { formatSchedule, nextDays, type Slot } from '@/lib/schedule';

const SLOTS: { value: Slot; label: string }[] = [
  { value: null, label: 'Anytime' },
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
];

export function ScheduleCard({
  jobId,
  myUid,
  scheduledDate,
  scheduledSlot,
  proposedBy,
  confirmed,
  onChanged,
}: {
  jobId: string;
  myUid: string | null;
  scheduledDate: string | null;
  scheduledSlot: Slot;
  proposedBy: string | null;
  confirmed: boolean;
  onChanged: () => void;
}) {
  const theme = useTheme();
  const [proposing, setProposing] = useState(!scheduledDate);
  const [date, setDate] = useState<string | null>(scheduledDate);
  const [slot, setSlot] = useState<Slot>(scheduledSlot);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPropose() {
    if (!date) {
      setError('Pick a day.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: e } = await proposeSchedule(jobId, date, slot);
    setBusy(false);
    if (e) {
      setError(e);
      return;
    }
    setProposing(false);
    onChanged();
  }

  async function onAccept() {
    setBusy(true);
    setError(null);
    const { error: e } = await acceptSchedule(jobId);
    setBusy(false);
    if (e) {
      setError(e);
      return;
    }
    onChanged();
  }

  if (confirmed && scheduledDate) {
    return (
      <ThemedView type="background" style={styles.box}>
        <ThemedText type="smallBold">
          ✅ Scheduled · {formatSchedule(scheduledDate, scheduledSlot, new Date())}
        </ThemedText>
      </ThemedView>
    );
  }

  const proposalPending = scheduledDate && !proposing;

  return (
    <ThemedView type="background" style={styles.box}>
      {proposalPending ? (
        <>
          <ThemedText type="smallBold">
            Proposed · {formatSchedule(scheduledDate, scheduledSlot, new Date())}
          </ThemedText>
          {proposedBy === myUid ? (
            <ThemedText type="small" themeColor="textSecondary">
              Waiting for the other person to accept…
            </ThemedText>
          ) : (
            <Pressable
              onPress={onAccept}
              disabled={busy}
              style={({ pressed }) => [styles.acceptBtn, pressed && styles.pressed]}>
              <ThemedText type="default" style={styles.acceptLabel}>
                {busy ? 'Confirming…' : 'Accept this time'}
              </ThemedText>
            </Pressable>
          )}
          <Pressable onPress={() => setProposing(true)} hitSlop={6}>
            <ThemedText type="small" style={styles.link}>
              Propose a different time
            </ThemedText>
          </Pressable>
        </>
      ) : (
        <>
          <ThemedText type="smallBold">Propose a time</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {nextDays(new Date(), 14).map((d) => {
              const selected = date === d.value;
              return (
                <Pressable
                  key={d.value}
                  onPress={() => setDate(d.value)}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      backgroundColor: selected ? Brand.primary : theme.backgroundElement,
                      borderColor: selected ? Brand.primary : theme.backgroundSelected,
                    },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="small" style={selected ? styles.chipSelected : undefined}>
                    {d.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.chipRow}>
            {SLOTS.map((s) => {
              const selected = slot === s.value;
              return (
                <Pressable
                  key={s.label}
                  onPress={() => setSlot(s.value)}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      backgroundColor: selected ? Brand.primary : theme.backgroundElement,
                      borderColor: selected ? Brand.primary : theme.backgroundSelected,
                    },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="small" style={selected ? styles.chipSelected : undefined}>
                    {s.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            onPress={onPropose}
            disabled={busy}
            style={({ pressed }) => [styles.acceptBtn, pressed && styles.pressed]}>
            <ThemedText type="default" style={styles.acceptLabel}>
              {busy ? 'Sending…' : 'Send proposal'}
            </ThemedText>
          </Pressable>
          {scheduledDate && (
            <Pressable onPress={() => setProposing(false)} hitSlop={6}>
              <ThemedText type="small" style={styles.link}>
                Cancel
              </ThemedText>
            </Pressable>
          )}
        </>
      )}
      {error && (
        <ThemedText type="small" style={styles.error}>
          {error}
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  box: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two, marginTop: Spacing.two },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, paddingVertical: Spacing.one },
  chip: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    minHeight: 40,
    justifyContent: 'center',
  },
  chipSelected: { color: '#ffffff' },
  acceptBtn: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    backgroundColor: Brand.primary,
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  acceptLabel: { color: '#ffffff' },
  link: { color: Brand.primary, textDecorationLine: 'underline' },
  error: { color: '#c0392b' },
  pressed: { opacity: 0.7 },
});
