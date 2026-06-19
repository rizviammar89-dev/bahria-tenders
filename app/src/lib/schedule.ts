// Scheduling labels for a job's preferred timing. Kept pure (today is passed in) so it's testable.
export type Slot = 'morning' | 'afternoon' | 'evening' | null;

function dayLabel(dateStr: string, today: Date): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((d.getTime() - t0.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Human label for a job's preferred timing. `date` is 'YYYY-MM-DD' or null (= as soon as possible). */
export function formatSchedule(date: string | null, slot: Slot, today: Date): string {
  const base = date ? dayLabel(date, today) : 'As soon as possible';
  return slot ? `${base} · ${slot}` : base;
}

/** Next `count` calendar days from `today` as { value: 'YYYY-MM-DD', label } for the day picker. */
export function nextDays(today: Date, count: number): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    out.push({ value, label });
  }
  return out;
}
