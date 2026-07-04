// Edge Function: an awarded provider backs out of a job. Verifies the caller IS the awarded provider,
// reopens the job for other providers, drops the caller's bid, hides the job from the caller's own
// feed, and notifies the resident. Called by the provider's app with { jobId }.
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Not signed in.' }, 401);

    const { jobId } = await req.json().catch(() => ({}) as Record<string, unknown>);
    if (!jobId) return json({ error: 'Missing jobId.' }, 400);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: job } = await admin
      .from('jobs')
      .select('id, status, awarded_provider_id, resident_id, service:services(display_en)')
      .eq('id', jobId)
      .maybeSingle();
    if (!job) return json({ error: 'Job not found.' }, 404);
    // Only the currently-awarded provider can decline, and only while it's still awarded.
    if (job.status !== 'awarded' || job.awarded_provider_id !== user.id) {
      return json({ error: 'This job can no longer be declined.' }, 403);
    }

    // Reopen for other providers and clear the award + any negotiated schedule.
    const { error: upErr } = await admin
      .from('jobs')
      .update({
        status: 'open',
        awarded_provider_id: null,
        scheduled_date: null,
        scheduled_slot: null,
        schedule_proposed_by: null,
        schedule_confirmed: false,
      })
      .eq('id', jobId);
    if (upErr) return json({ error: upErr.message }, 500);

    // Drop the declining provider's bid, and hide the job from their own feed so it doesn't reappear.
    await admin.from('bids').delete().eq('job_id', jobId).eq('provider_id', user.id).then(() => {}, () => {});
    await admin
      .from('job_dismissals')
      .upsert({ provider_id: user.id, job_id: jobId }, { onConflict: 'provider_id,job_id', ignoreDuplicates: true })
      .then(() => {}, () => {});

    // Best-effort push to the resident.
    const { data: tokenRow } = await admin
      .from('push_tokens')
      .select('expo_push_token')
      .eq('user_id', job.resident_id)
      .maybeSingle();
    const to = tokenRow?.expo_push_token as string | undefined;
    if (to) {
      const trade = (job.service as { display_en?: string } | null)?.display_en ?? 'your';
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          {
            to,
            title: 'Your job is open again',
            body: `A provider stepped back from your ${trade} job — it's open for new bids.`,
            channelId: 'default',
            priority: 'high',
            data: { jobId },
          },
        ]),
      }).catch(() => {});
    }

    return json({ ok: true });
  } catch (e) {
    console.error('decline-job error', e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
