// Data for the resident Hunt map — providers in a trade with their latest published positions.
import { supabase } from '@/lib/supabase';

// Re-export the pure distance/charge helpers (defined in distance.ts, no Supabase import → testable).
export {
  CHARGE_THRESHOLD_KM,
  VISITING_CHARGE_PKR,
  haversineKm,
  visitingChargeForKm,
} from '@/lib/distance';

export type AvailableProvider = { id: string; fullName: string; lat: number; lng: number };

/** Hunt page: ALL providers offering `serviceId` (with active access, not in Hire mode) that have a
 *  published location, regardless of whether they're currently online/available. */
export async function fetchProvidersForTrade(
  serviceId: string,
): Promise<{ providers: AvailableProvider[]; error: string | null }> {
  const { data: profs, error: pErr } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('is_provider', true)
    .eq('in_hire_mode', false) // hidden while the provider is in Hire mode
    .gt('provider_access_until', new Date().toISOString())
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

export type DirectoryProvider = {
  id: string;
  fullName: string;
  precinct: string | null;
  ratingSum: number;
  ratingCount: number;
  online: boolean;
};

/** Directory: every provider offering `serviceId` (active access, not in Hire mode) — regardless of
 *  whether they're online right now. `online` is a best-effort badge from a recent published location. */
export async function fetchProvidersDirectory(
  serviceId: string,
): Promise<{ providers: DirectoryProvider[]; error: string | null }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, precinct, rating_sum, rating_count')
    .eq('is_provider', true)
    .eq('in_hire_mode', false)
    .gt('provider_access_until', new Date().toISOString())
    .contains('service_ids', [serviceId]);
  if (error) return { providers: [], error: error.message };
  const rows = data ?? [];
  if (rows.length === 0) return { providers: [], error: null };

  // Best-effort "online now": a location published within the last 15 min. Failure → no badges.
  const online = new Set<string>();
  const { data: locs } = await supabase
    .from('provider_locations')
    .select('provider_id, updated_at')
    .in('provider_id', rows.map((p) => p.id as string));
  const freshBefore = Date.now() - 15 * 60 * 1000;
  for (const l of locs ?? []) {
    if (new Date(l.updated_at as string).getTime() > freshBefore) online.add(l.provider_id as string);
  }

  const rating = (p: DirectoryProvider) => (p.ratingCount ? p.ratingSum / p.ratingCount : 0);
  const providers: DirectoryProvider[] = rows
    .map((p) => ({
      id: p.id as string,
      fullName: (p.full_name as string) ?? 'Provider',
      precinct: (p.precinct as string | null) ?? null,
      ratingSum: (p.rating_sum as number) ?? 0,
      ratingCount: (p.rating_count as number) ?? 0,
      online: online.has(p.id as string),
    }))
    // Online first, then higher-rated.
    .sort((a, b) => Number(b.online) - Number(a.online) || rating(b) - rating(a));
  return { providers, error: null };
}

/** A provider's phone for a direct call from Hunt (server-gated to provider accounts). */
export async function fetchProviderPhone(providerId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_provider_phone', { p_provider_id: providerId });
  if (error) return null;
  return (data as string | null) ?? null;
}
