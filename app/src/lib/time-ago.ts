// Story 2.3: calm relative-time label for the job feed. `now` is injected (no Date.now()
// inside) so it stays pure + unit-testable. Western Arabic numerals only (localization lock).
export function timeAgo(iso: string, now: number): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return ''; // bad/missing timestamp → render nothing rather than "NaN days ago"
  const diffMs = Math.max(0, now - parsed); // clamp clock-skew/future timestamps to "just now"
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const days = Math.floor(hr / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}
