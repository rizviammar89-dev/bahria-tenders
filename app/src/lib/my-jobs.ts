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
  precinct: string;
  status: 'open' | 'awarded' | 'completed' | 'cancelled';
  created_at: string;
  awarded_provider_id: string | null;
  service: { display_en: string; display_ur: string } | null;
  bids: BidWithProvider[];
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
      'id, description, precinct, status, created_at, awarded_provider_id, service:services(display_en, display_ur), bids!bids_job_id_fkey(id, price_pkr, note, provider:profiles(id, full_name, rating_sum, rating_count))',
    )
    .eq('resident_id', uid)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .order('created_at', { referencedTable: 'bids', ascending: true });
  if (error) return { jobs: [], error: error.message };
  return { jobs: (data ?? []) as unknown as MyJob[], error: null };
}

/** Award an open job to a provider who bid (SECURITY DEFINER RPC enforces the rules). */
export async function awardJob(jobId: string, providerId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('award_job', { p_job_id: jobId, p_provider_id: providerId });
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
