// Story 2.8: humanized reputation label for a provider on the bid card.
// New providers get a deliberate zero-state ("New provider"), not "0 stars" (architecture FR-3).
// Western Arabic numerals. Pure + unit-tested.
export function reputationLabel(input: { ratingCount: number; ratingSum: number }): string {
  if (input.ratingCount <= 0) {
    return 'New provider';
  }
  const avg = (input.ratingSum / input.ratingCount).toFixed(1);
  const jobs = input.ratingCount === 1 ? 'job' : 'jobs';
  return `${avg} from ${input.ratingCount} ${jobs}`;
}
