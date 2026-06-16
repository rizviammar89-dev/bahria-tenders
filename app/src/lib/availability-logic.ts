// Story 6.2: pure availability/publish logic — no Supabase/native imports, so it's unit-testable
// in jest (kept separate from availability.ts, which pulls in the Supabase client).

/** Client mirror of provider_is_available: true iff the heartbeat is within the window. */
export function availabilityIsFresh(
  updatedAtIso: string | null,
  nowMs: number,
  windowMins: number,
): boolean {
  if (!updatedAtIso) return false;
  const t = Date.parse(updatedAtIso);
  if (Number.isNaN(t)) return false;
  return nowMs - t < windowMins * 60_000;
}

/** Throttle gate for the foreground publisher: publish if never published or throttle elapsed. */
export function shouldPublish(lastPublishMs: number | null, nowMs: number, throttleMs: number): boolean {
  return lastPublishMs == null || nowMs - lastPublishMs >= throttleMs;
}
