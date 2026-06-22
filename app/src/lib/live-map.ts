// Story 6.4: data for the resident live map — the available providers in a trade with their latest
// positions, plus a realtime subscription so pins move as provider_locations change.
import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

// Re-export the pure distance/charge helpers (defined in distance.ts, no Supabase import → testable).
export {
  CHARGE_THRESHOLD_KM,
  VISITING_CHARGE_PKR,
  haversineKm,
  visitingChargeForKm,
} from '@/lib/distance';

const AVAILABILITY_WINDOW_MINS = 15; // mirrors provider_is_available's auto-expiry window

export type AvailableProvider = { id: string; fullName: string; lat: number; lng: number };

/** Available + fresh providers offering `serviceId`, with their latest published location. */
export async function fetchAvailableProviders(
  serviceId: string,
): Promise<{ providers: AvailableProvider[]; error: string | null }> {
  const cutoff = new Date(Date.now() - AVAILABILITY_WINDOW_MINS * 60 * 1000).toISOString();
  const { data: profs, error: pErr } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('is_provider', true)
    .gt('provider_access_until', new Date().toISOString()) // hide providers with an expired subscription
    .eq('is_available', true)
    .gt('availability_updated_at', cutoff)
    .contains('service_ids', [serviceId]);
  if (pErr) return { providers: [], error: pErr.message };
  const names = new Map((profs ?? []).map((p) => [p.id as string, p.full_name as string]));
  if (names.size === 0) return { providers: [], error: null };

  const { data: locs, error: lErr } = await supabase
    .from('provider_locations')
    .select('provider_id, lat, lng')
    .in('provider_id', [...names.keys()]);
  if (lErr) return { providers: [], error: lErr.message };

  const providers = (locs ?? []).map((l) => ({
    id: l.provider_id as string,
    fullName: names.get(l.provider_id as string) ?? 'Provider',
    lat: l.lat as number,
    lng: l.lng as number,
  }));
  return { providers, error: null };
}

/** Subscribe to any provider_locations change; caller refetches in `onChange` and unsubscribes. */
export function subscribeProviderLocations(onChange: () => void): RealtimeChannel {
  return supabase
    .channel('provider_locations_live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'provider_locations' }, onChange)
    .subscribe();
}
