// Story 2.1: data layer for posting a job. All access goes through the authed client;
// RLS (Story 1.3) enforces resident_id = auth.uid() on insert and row visibility.
import { uploadJobPhotos, type PickedPhoto } from '@/lib/job-photos';
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
  addressUnit: string; // Villa / Apartment number
  addressStreet: string; // Street / Building name
  precinct: string; // Precinct number
  // Story 6.1: optional resident coordinates for the distance/visiting-charge rule.
  lat?: number;
  lng?: number;
  // Quick-dev: problem photos picked in the UI, uploaded after the row is inserted.
  photos?: PickedPhoto[];
  // Scheduling: preferred day ('YYYY-MM-DD' or null = ASAP) + time-of-day window.
  preferredDate?: string | null;
  preferredSlot?: 'morning' | 'afternoon' | 'evening' | null;
}): Promise<{ error: string | null }> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return { error: 'You are not signed in.' };

  const { data, error } = await supabase
    .from('jobs')
    .insert({
      resident_id: uid,
      service_id: input.serviceId,
      description: input.description.trim(),
      address_unit: input.addressUnit.trim(),
      address_street: input.addressStreet.trim(),
      precinct: input.precinct.trim(),
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      preferred_date: input.preferredDate ?? null,
      preferred_slot: input.preferredSlot ?? null,
    })
    .select('id')
    .single();
  if (error) return { error: error.message };

  // Upload photos (if any) and record their paths BEFORE broadcasting, so providers who open the
  // push notification see the pictures. A failed upload is non-fatal — the job still posts.
  if (input.photos?.length) {
    const paths = await uploadJobPhotos(uid, data.id, input.photos);
    if (paths.length) {
      const { error: photoErr } = await supabase
        .from('jobs')
        .update({ photo_paths: paths })
        .eq('id', data.id);
      if (photoErr) console.warn('saving photo paths failed:', photoErr.message);
    }
  }

  // Story 2.5: broadcast to matching providers — FIRE-AND-FORGET. Must NOT block or fail the
  // resident's post; a broadcast error is logged only. notification_log + retry live server-side.
  void supabase.functions
    .invoke('broadcast-job', { body: { jobId: data.id } })
    .then(({ error: bErr }) => {
      if (bErr) console.warn('broadcast-job invoke failed:', bErr.message);
    })
    .catch((e) => console.warn('broadcast-job invoke error:', String(e)));

  return { error: null };
}

/**
 * Story 6.1: distance + Rs 250 visiting charge for a (job, provider) pair, via the DB rule.
 * Returns distanceKm null + chargePkr 0 when either location is unknown.
 */
export async function fetchVisitingCharge(
  jobId: string,
  providerId: string,
): Promise<{ distanceKm: number | null; chargePkr: number; error: string | null }> {
  const { data, error } = await supabase.rpc('visiting_charge', {
    p_job_id: jobId,
    p_provider_id: providerId,
  });
  if (error) return { distanceKm: null, chargePkr: 0, error: error.message };
  const row = (data as { distance_km: number | null; charge_pkr: number }[])?.[0];
  return { distanceKm: row?.distance_km ?? null, chargePkr: row?.charge_pkr ?? 0, error: null };
}

export type AwardedJob = {
  id: string;
  description: string;
  precinct: string;
  status: 'awarded' | 'completed';
  resident_id: string;
  scheduled_date: string | null;
  scheduled_slot: 'morning' | 'afternoon' | 'evening' | null;
  schedule_proposed_by: string | null;
  schedule_confirmed: boolean;
  service: { display_en: string; display_ur: string } | null;
};

/** Jobs the signed-in provider has won (awarded or completed) — so they can contact the resident. */
export async function fetchMyAwardedJobs(): Promise<{ jobs: AwardedJob[]; error: string | null }> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return { jobs: [], error: 'You are not signed in.' };

  const { data, error } = await supabase
    .from('jobs')
    .select('id, description, precinct, status, resident_id, scheduled_date, scheduled_slot, schedule_proposed_by, schedule_confirmed, service:services(display_en, display_ur)')
    .eq('awarded_provider_id', uid)
    .in('status', ['awarded', 'completed'])
    .order('created_at', { ascending: false });
  if (error) return { jobs: [], error: error.message };
  return { jobs: (data ?? []) as unknown as AwardedJob[], error: null };
}

export type OpenJob = {
  id: string;
  description: string;
  precinct: string;
  resident_id: string;
  preferred_date: string | null;
  preferred_slot: 'morning' | 'afternoon' | 'evening' | null;
  photo_paths: string[];
  created_at: string;
  service: { display_en: string; display_ur: string } | null;
  // The signed-in provider's own bid on this job, if any (RLS returns only the caller's bid).
  myBid: { id: string; pricePkr: number; note: string | null } | null;
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
    .select('id, description, precinct, resident_id, preferred_date, preferred_slot, photo_paths, created_at, service:services(display_en, display_ur), bids(id, price_pkr, note)')
    .eq('status', 'open')
    .in('service_id', profile.service_ids as string[])
    .neq('resident_id', uid)
    .order('created_at', { ascending: false });
  if (error) return { jobs: [], error: error.message };

  type Row = Omit<OpenJob, 'myBid'> & { bids: { id: string; price_pkr: number; note: string | null }[] };
  const jobs: OpenJob[] = ((data ?? []) as unknown as Row[]).map(({ bids, ...job }) => {
    // RLS limits the bids embed to the caller's own bid → 0 or 1 row.
    const b = bids?.[0];
    return { ...job, myBid: b ? { id: b.id, pricePkr: b.price_pkr, note: b.note } : null };
  });
  return { jobs, error: null };
}
