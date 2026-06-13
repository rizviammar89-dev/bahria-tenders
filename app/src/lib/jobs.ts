// Story 2.1: data layer for posting a job. All access goes through the authed client;
// RLS (Story 1.3) enforces resident_id = auth.uid() on insert and row visibility.
import { supabase } from '@/lib/supabase';

export type Service = { id: string; slug: string; display_en: string; display_ur: string };

/** The 6 POC trades, ordered for display. */
export async function fetchServices(): Promise<{ services: Service[]; error: string | null }> {
  const { data, error } = await supabase
    .from('services')
    .select('id, slug, display_en, display_ur')
    .order('display_en');
  if (error) return { services: [], error: error.message };
  return { services: (data ?? []) as Service[], error: null };
}

/** The signed-in resident's saved precinct, to prefill the form. Null if unavailable. */
export async function fetchMyPrecinct(): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase.from('profiles').select('precinct').eq('id', uid).single();
  if (error || !data) return null;
  return data.precinct as string;
}

/** Inserts a job for the signed-in resident. status defaults to 'open' in the DB. */
export async function createJob(input: {
  serviceId: string;
  description: string;
  precinct: string;
}): Promise<{ error: string | null }> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return { error: 'You are not signed in.' };

  const { error } = await supabase.from('jobs').insert({
    resident_id: uid,
    service_id: input.serviceId,
    description: input.description.trim(),
    precinct: input.precinct.trim(),
  });
  return { error: error ? error.message : null };
}

export type OpenJob = {
  id: string;
  description: string;
  precinct: string;
  created_at: string;
  service: { display_en: string; display_ur: string } | null;
};

/**
 * Open jobs the signed-in provider should see: status 'open', in a trade they offer,
 * not their own. RLS is the security backstop; the trade/own filters are relevance.
 * A resident (or trade-less provider) gets an empty feed — benign, not an error.
 */
export async function fetchOpenJobsForMyTrades(): Promise<{ jobs: OpenJob[]; error: string | null }> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return { jobs: [], error: 'You are not signed in.' };

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, service_ids')
    .eq('id', uid)
    .single();
  if (profileError || !profile) return { jobs: [], error: profileError?.message ?? null };
  if (profile.role !== 'provider' || !profile.service_ids?.length) {
    return { jobs: [], error: null };
  }

  const { data, error } = await supabase
    .from('jobs')
    .select('id, description, precinct, created_at, service:services(display_en, display_ur)')
    .eq('status', 'open')
    .in('service_id', profile.service_ids as string[])
    .neq('resident_id', uid)
    .order('created_at', { ascending: false });
  if (error) return { jobs: [], error: error.message };
  return { jobs: (data ?? []) as unknown as OpenJob[], error: null };
}
