// Story 6.2: provider availability + location publishing data layer (Supabase). Pure helpers live
// in ./availability-logic (jest-testable); re-exported here so call sites import from one place.
import { supabase } from '@/lib/supabase';

export { availabilityIsFresh, shouldPublish } from '@/lib/availability-logic';

/** Toggle the signed-in provider's availability (stamps the heartbeat). */
export async function setAvailability(on: boolean): Promise<{ error: string | null }> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return { error: 'You are not signed in.' };
  const { error } = await supabase
    .from('profiles')
    .update({ is_available: on, availability_updated_at: new Date().toISOString() })
    .eq('id', uid);
  return { error: error ? error.message : null };
}

/** Upsert the provider's current location and refresh the availability heartbeat. */
export async function publishLocation(lat: number, lng: number): Promise<{ error: string | null }> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
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
