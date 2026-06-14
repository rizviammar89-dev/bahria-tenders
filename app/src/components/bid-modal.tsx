// Story 2.4: bid form shown as a Modal over the feed (no routing change). Submits a single
// whole-rupee price (+ optional note); inserts a new bid or edits the provider's existing one.
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { validateBidInput } from '@/lib/bid-input';
import { submitBid } from '@/lib/bids';
import type { OpenJob } from '@/lib/jobs';

export function BidModal({
  job,
  onClose,
  onSubmitted,
}: {
  job: OpenJob | null;
  onClose: () => void;
  onSubmitted: (pricePkr: number) => void;
}) {
  // This component is keyed by job.id in the feed, so it remounts fresh on each open —
  // initializers safely pre-fill price + note from the current bid (no render-phase setState).
  const [priceText, setPriceText] = useState(() => (job?.myBid ? String(job.myBid.pricePkr) : ''));
  const [note, setNote] = useState(() => job?.myBid?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    if (busy || !job) return;
    setBusy(true);
    setError(null);
    const check = validateBidInput(priceText);
    if (!check.ok) {
      setError(check.error);
      setBusy(false);
      return;
    }
    const { error: submitError } = await submitBid({
      jobId: job.id,
      pricePkr: check.pricePkr,
      note,
      existingBidId: job.myBid?.id ?? null,
    });
    if (submitError) {
      console.warn('submitBid failed:', submitError);
      setError("Couldn't submit your bid — please try again.");
      setBusy(false);
      return;
    }
    setBusy(false);
    onSubmitted(check.pricePkr);
  }

  return (
    <Modal visible={job !== null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ThemedView style={styles.sheet}>
          {job && (
            <>
              <ThemedText type="subtitle">{job.myBid ? 'Edit your bid' : 'Place a bid'}</ThemedText>
              <ThemedText type="smallBold">
                {job.service ? `${job.service.display_en} · ${job.service.display_ur}` : 'Job'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {job.precinct}
              </ThemedText>
              <ThemedText type="default">{job.description}</ThemedText>

              <ThemedText type="smallBold">Your price</ThemedText>
              <View style={styles.priceRow}>
                <ThemedText type="default" style={styles.rs}>
                  Rs
                </ThemedText>
                <TextInput
                  value={priceText}
                  onChangeText={setPriceText}
                  placeholder="1500"
                  keyboardType="number-pad"
                  style={styles.priceInput}
                />
              </View>

              <ThemedText type="smallBold">Note (optional)</ThemedText>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="e.g. Can come tomorrow morning"
                style={styles.input}
              />

              {error && (
                <ThemedText type="small" style={styles.error}>
                  {error}
                </ThemedText>
              )}

              <View style={styles.actions}>
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
                  <ThemedText type="default">Cancel</ThemedText>
                </Pressable>
                <Pressable
                  onPress={onSubmit}
                  disabled={busy}
                  style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
                  <ThemedText type="default" style={styles.buttonLabel}>
                    {busy ? 'Submitting…' : job.myBid ? 'Update bid' : 'Submit bid'}
                  </ThemedText>
                </Pressable>
              </View>
            </>
          )}
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    padding: Spacing.four,
    gap: Spacing.three,
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  rs: { fontWeight: '700' },
  priceInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: Spacing.two,
    padding: Spacing.three,
    fontSize: 18,
    minHeight: 52,
  },
  input: {
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: Spacing.two,
    padding: Spacing.three,
    fontSize: 16,
    minHeight: 52,
  },
  error: { color: '#c0392b' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.three, marginTop: Spacing.two },
  secondary: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    minHeight: 52,
    justifyContent: 'center',
  },
  button: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    backgroundColor: '#208AEF',
    minHeight: 52,
    justifyContent: 'center',
  },
  buttonLabel: { color: '#ffffff' },
  pressed: { opacity: 0.7 },
});
