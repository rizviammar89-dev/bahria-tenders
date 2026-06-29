// Two-way reviews: a provider rates the resident after a completed job. Write-once; the parent
// refetches on success so the card flips to the "reviewed" state.
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { submitResidentRating } from '@/lib/jobs';

export function RateResidentCard({
  jobId,
  residentId,
  onRated,
}: {
  jobId: string;
  residentId: string;
  onRated: () => void;
}) {
  const [stars, setStars] = useState(0);
  const [review, setReview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (busy) return;
    if (stars < 1) {
      setError('Pick a star rating.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: e } = await submitResidentRating({ jobId, residentId, stars, review });
    setBusy(false);
    if (e) {
      setError(e);
      return;
    }
    onRated();
  }

  return (
    <View style={styles.wrap}>
      <ThemedText type="smallBold">Rate this resident</ThemedText>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setStars(n)} hitSlop={6}>
            <ThemedText style={[styles.star, { color: n <= stars ? Brand.accent : '#bbb' }]}>★</ThemedText>
          </Pressable>
        ))}
      </View>
      <TextInput
        value={review}
        onChangeText={setReview}
        placeholder="Optional comment (e.g. clear instructions, paid on time)"
        multiline
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
        style={styles.input}
      />
      {error && (
        <ThemedText type="small" style={styles.error}>
          {error}
        </ThemedText>
      )}
      <Pressable
        onPress={onSubmit}
        disabled={busy}
        style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
        <ThemedText type="default" style={styles.btnLabel}>
          {busy ? 'Submitting…' : 'Submit review'}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: Spacing.one, gap: Spacing.two },
  stars: { flexDirection: 'row', gap: Spacing.one },
  star: { fontSize: 28 },
  input: {
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: Spacing.two,
    padding: Spacing.three,
    fontSize: 16,
    minHeight: 64,
    textAlignVertical: 'top',
  },
  error: { color: '#c0392b' },
  btn: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
    backgroundColor: Brand.primary,
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  btnLabel: { color: '#ffffff' },
  pressed: { opacity: 0.7 },
});
