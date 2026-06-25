// Story 6.2: provider availability + location publishing data layer (Supabase). Pure helpers live
// in ./availability-logic (jest-testable); re-exported here so call sites import from one place.
import { currentUserId } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export { availabilityIsFresh, shouldPublish } from '@/lib/availability-logic';

/** The signed-in provider's current availability state (for hydrating the toggle on mount). */
export async function fetchMyAvailability(): Promise<{
  isAvailable: boolean;
  updatedAt: string | null;
}> {
  const uid = await currentUserId();
  if (!uid) return { isAvailable: false, updatedAt: null };
  const { data } = await supabase
    .from('profiles')
    .select('is_available, availability_updated_at')
    .eq('id', uid)
    .single();
  return {
    isAvailable: Boolean(data?.is_available),
    updatedAt: (data?.availability_updated_at as string | null) ?? null,
  };
}

/** Toggle the signed-in provider's availability (stamps the heartbeat). */
export async function setAvailability(on: boolean): Promise<{ error: string | null }> {
  const uid = await currentUserId();
  if (!uid) return { error: 'You are not signed in.' };
  const { error } = await supabase
    .from('profiles')
    .update({ is_available: on, availability_updated_at: new Date().toISOString() })
    .eq('id', uid);
  return { error: error ? error.message : null };
}

/** Upsert the provider's current location and refresh the availability heartbeat. */
export async function publishLocation(lat: number, lng: number): Promise<{ error: string | null }> {
  const uid = await currentUserId();
  if (!uid) return { error: 'You are not signed in.' };
  const nowIso = new Date().toISOString();
  const { error: locErr } = await supabase
    .from('provider_locations')
    .upsert({ provider_id: uid, lat, lng, updated_at: nowIso }, { onConflict: 'provider_id' });
  if (locErr) return { error: locErr.message };
  // Heartbeat: keep availability fresh while actively publishing (FR-19 auto-expiry).
  await supabase.from('profiles').update({ availability_updated_at: nowIso }).eq('id', uid);
  return { error: null };
}
