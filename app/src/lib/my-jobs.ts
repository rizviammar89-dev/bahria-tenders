// Story 2.8: the resident's My-Jobs data layer. RLS lets a resident read their own jobs and
// ALL bids on them; the provider embed exposes public reputation (not phone). Award + contact
// reveal go through SECURITY DEFINER RPCs (award_job / get_job_contacts).
import { supabase } from '@/lib/supabase';

export type BidWithProvider = {
  id: string;
  price_pkr: number;
  note: string | null;
  provider: { id: string; full_name: string; rating_sum: number; rating_count: number } | null;
};

export type MyJob = {
  id: string;
  description: string;
  address_unit: string | null;
  address_street: string | null;
  precinct: string;
  photo_paths: string[];
  status: 'open' | 'awarded' | 'completed' | 'cancelled';
  created_at: string;
  awarded_provider_id: string | null;
  service_id: string;
  lat: number | null;
  lng: number | null;
  preferred_date: string | null;
  preferred_slot: 'morning' | 'afternoon' | 'evening' | null;
  service: { display_en: string; display_ur: string } | null;
  bids: BidWithProvider[];
  rating: { stars: number; review: string | null } | null;
};

export type JobContacts = {
  residentName: string;
  residentPhone: string;
  providerName: string;
  providerPhone: string;
};

/** The resident's own jobs with the bids on each (bids in arrival order — NOT cheapest-first, FR-9). */
export async function fetchMyJobs(): Promise<{ jobs: MyJob[]; error: string | null }> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return { jobs: [], error: 'You are not signed in.' };

  const { data, error } = await supabase
    .from('jobs')
    .select(
      'id, description, address_unit, address_street, precinct, photo_paths, status, created_at, awarded_provider_id, service_id, lat, lng, preferred_date, preferred_slot, service:services(display_en, display_ur), bids!bids_job_id_fkey(id, price_pkr, note, provider:profiles(id, full_name, rating_sum, rating_count)), rating:ratings(stars, review)',
    )
    .eq('resident_id', uid)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .order('created_at', { referencedTable: 'bids', ascending: true });
  if (error) return { jobs: [], error: error.message };
  // `rating:ratings(...)` may arrive as an array (PostgREST embed) even though ratings_one_per_job
  // makes it at most one — normalize to a single object|null so the screen can read it directly.
  const jobs = (data ?? []).map((j) => {
    const r = (j as { rating?: unknown }).rating;
    const rating = Array.isArray(r) ? (r[0] ?? null) : (r ?? null);
    return { ...j, rating };
  }) as unknown as MyJob[];
  return { jobs, error: null };
}

/**
 * "Delete" a job from the resident's list — a soft-cancel (the schema has no client DELETE by
 * design: `cancelled_at` + the consistency CHECK + the RLS "soft-cancel only" comment). Sets
 * status to 'cancelled' (+ cancelled_at to satisfy jobs_cancel_consistency_chk). fetchMyJobs
 * already excludes cancelled rows, so the job disappears from the list while bids/ratings/logs
 * persist. Completed jobs are excluded — they're historical (and may be rated), so can't be removed.
 */
export async function cancelJob(jobId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('jobs')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', jobId)
    .neq('status', 'completed');
  return { error: error ? error.message : null };
}

/** Award an open job to a provider who bid (SECURITY DEFINER RPC enforces the rules). */
export async function awardJob(jobId: string, providerId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('award_job', { p_job_id: jobId, p_provider_id: providerId });
  return { error: error ? error.message : null };
}

/**
 * Submit a one-time 1–5 rating (+ optional review) for a completed job.
 * No RPC: the plain insert rides RLS `ratings_insert_valid` (attribution + completed-gate +
 * awarded-provider match) and write-once (no update/delete grant + unique(job_id)).
 */
export async function submitRating(args: {
  jobId: string;
  providerId: string;
  stars: number;
  review?: string;
}): Promise<{ error: string | null }> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return { error: 'You are not signed in.' };
  const { error } = await supabase.from('ratings').insert({
    job_id: args.jobId,
    provider_id: args.providerId,
    resident_id: uid,
    stars: args.stars,
    review: args.review?.trim() || null,
  });
  return { error: error ? error.message : null };
}

/** Mark an awarded job completed (SECURITY DEFINER RPC enforces awarded→completed + ownership). */
export async function completeJob(jobId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('complete_job', { p_job_id: jobId });
  return { error: error ? error.message : null };
}

/** Reveal both parties' phones for an awarded job (caller must be a party). */
export async function getJobContacts(
  jobId: string,
): Promise<{ contacts: JobContacts | null; error: string | null }> {
  const { data, error } = await supabase.rpc('get_job_contacts', { p_job_id: jobId });
  if (error) return { contacts: null, error: error.message };
  const row = (data as { resident_name: string; resident_phone: string; provider_name: string; provider_phone: string }[])?.[0];
  if (!row) return { contacts: null, error: 'No contacts available.' };
  return {
    contacts: {
      residentName: row.resident_name,
      residentPhone: row.resident_phone,
      providerName: row.provider_name,
      providerPhone: row.provider_phone,
    },
    error: null,
  };
}
