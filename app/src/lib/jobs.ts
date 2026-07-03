// Story 2.1: data layer for posting a job. All access goes through the authed client;
// RLS (Story 1.3) enforces resident_id = auth.uid() on insert and row visibility.
import { uploadJobPhotos, type PickedPhoto } from '@/lib/job-photos';
import { currentUserId } from '@/lib/session';
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
  const uid = await currentUserId();
  if (!uid) return null;
  const { data, error } = await supabase.from('profiles').select('precinct').eq('id', uid).single();
  if (error || !data) return null;
  return data.precinct as string;
}

/** Inserts a job for the signed-in resident. status defaults to 'open' in the DB. */
export async function createJob(input: {
  userId: string; // from the caller's live session — avoids supabase.auth.getUser() (RN auth-lock deadlock)
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
  const uid = input.userId;
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
  ratedResident: boolean; // has the provider already reviewed the resident for this job?
};

/** Jobs the signed-in provider has won (awarded or completed) — so they can contact the resident. */
export async function fetchMyAwardedJobs(): Promise<{ jobs: AwardedJob[]; error: string | null }> {
  const uid = await currentUserId();
  if (!uid) return { jobs: [], error: 'You are not signed in.' };

  const { data, error } = await supabase
    .from('jobs')
    .select('id, description, precinct, status, resident_id, scheduled_date, scheduled_slot, schedule_proposed_by, schedule_confirmed, service:services(display_en, display_ur)')
    .eq('awarded_provider_id', uid)
    .in('status', ['awarded', 'completed'])
    .order('created_at', { ascending: false });
  if (error) return { jobs: [], error: error.message };
  const rows = (data ?? []) as unknown as Omit<AwardedJob, 'ratedResident'>[];

  // Which of these jobs the provider has already reviewed the resident on (write-once).
  let ratedJobIds = new Set<string>();
  if (rows.length) {
    const { data: rated } = await supabase
      .from('ratings')
      .select('job_id')
      .eq('provider_id', uid)
      .eq('author_role', 'provider')
      .in('job_id', rows.map((j) => j.id));
    ratedJobIds = new Set((rated ?? []).map((r) => r.job_id as string));
  }
  return { jobs: rows.map((j) => ({ ...j, ratedResident: ratedJobIds.has(j.id) })), error: null };
}

/** Provider reviews the resident after a completed job (write-once; RLS validates the match). */
export async function submitResidentRating(args: {
  jobId: string;
  residentId: string;
  stars: number;
  review?: string;
}): Promise<{ error: string | null }> {
  const uid = await currentUserId();
  if (!uid) return { error: 'You are not signed in.' };
  const { error } = await supabase.from('ratings').insert({
    job_id: args.jobId,
    provider_id: uid,
    resident_id: args.residentId,
    author_role: 'provider',
    stars: args.stars,
    review: args.review?.trim() || null,
  });
  return { error: error ? error.message : null };
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
  // The resident's reputation as a customer (two-way reviews).
  residentRating: { sum: number; count: number };
};

/**
 * Open jobs the signed-in provider should see: status 'open', in a trade they offer,
 * not their own. RLS is the security backstop; the trade/own filters are relevance.
 * A resident (or trade-less provider) gets an empty feed — benign, not an error.
 */
export async function fetchOpenJobsForMyTrades(): Promise<{ jobs: OpenJob[]; error: string | null }> {
  const uid = await currentUserId();
  if (!uid) return { jobs: [], error: 'You are not signed in.' };

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_provider, provider_access_until, service_ids')
    .eq('id', uid)
    .single();
  if (profileError || !profile) return { jobs: [], error: profileError?.message ?? null };
  const accessCurrent =
    profile.provider_access_until != null &&
    new Date(profile.provider_access_until as string).getTime() > Date.now();
  if (!profile.is_provider || !accessCurrent || !profile.service_ids?.length) {
    return { jobs: [], error: null }; // not a provider, expired subscription, or no trades → empty feed
  }

  const { data, error } = await supabase
    .from('jobs')
    .select('id, description, precinct, resident_id, preferred_date, preferred_slot, photo_paths, created_at, service:services(display_en, display_ur), resident:profiles!jobs_resident_id_fkey(resident_rating_sum, resident_rating_count), bids!bids_job_id_fkey(id, price_pkr, note)')
    .eq('status', 'open')
    .in('service_id', profile.service_ids as string[])
    .neq('resident_id', uid)
    .order('created_at', { ascending: false });
  if (error) return { jobs: [], error: error.message };

  type Row = Omit<OpenJob, 'myBid' | 'residentRating'> & {
    bids: { id: string; price_pkr: number; note: string | null }[];
    resident: { resident_rating_sum: number; resident_rating_count: number } | null;
  };
  const jobs: OpenJob[] = ((data ?? []) as unknown as Row[]).map(({ bids, resident, ...job }) => {
    // RLS limits the bids embed to the caller's own bid → 0 or 1 row.
    const b = bids?.[0];
    return {
      ...job,
      myBid: b ? { id: b.id, pricePkr: b.price_pkr, note: b.note } : null,
      residentRating: { sum: resident?.resident_rating_sum ?? 0, count: resident?.resident_rating_count ?? 0 },
    };
  });

  // Drop jobs the provider marked "not interested" so they stay hidden across refreshes.
  const { data: dismissed } = await supabase
    .from('job_dismissals')
    .select('job_id')
    .eq('provider_id', uid);
  const hidden = new Set((dismissed ?? []).map((d) => d.job_id as string));
  return { jobs: jobs.filter((j) => !hidden.has(j.id)), error: null };
}

/** Provider "not interested": hide this job from the caller's feed (persisted, provider-scoped). */
export async function dismissJob(jobId: string): Promise<{ error: string | null }> {
  const uid = await currentUserId();
  if (!uid) return { error: 'You are not signed in.' };
  const { error } = await supabase
    .from('job_dismissals')
    .upsert({ provider_id: uid, job_id: jobId }, { onConflict: 'provider_id,job_id', ignoreDuplicates: true });
  return { error: error ? error.message : null };
}
