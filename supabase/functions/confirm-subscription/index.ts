// Edge Function: confirm a provider subscription payment when the user returns from Safepay checkout.
// Called by the app (authenticated) with the tracker from create-subscription-checkout. Extends the
// caller's provider access by one month for their matching pending payment.
//
// SANDBOX NOTE: this currently grants access for the user's own pending payment with the given
// tracker. Before PRODUCTION it MUST verify the payment with Safepay (redirect signature via the
// v1 secret, or a server-side status lookup) so access can't be self-granted without paying. The
// redirect URL is captured to webhook_debug so we can implement that verification next.
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Not signed in.' }, 401);

    const { tracker, redirectUrl } = await req.json().catch(() => ({}) as Record<string, unknown>);
    if (!tracker) return json({ error: 'Missing tracker.' }, 400);

    const admin = createClient(supabaseUrl, serviceKey);

    // Capture the redirect (params + signature) so we can implement real verification next.
    await admin
      .from('webhook_debug')
      .insert({ headers: { source: 'confirm', user: user.id, tracker }, body: String(redirectUrl ?? '') })
      .then(() => {}, () => {});

    const { data: payment } = await admin
      .from('payments')
      .select('id, provider_id, status, period_months')
      .eq('safepay_tracker', tracker)
      .eq('provider_id', user.id)
      .maybeSingle();
    if (!payment) return json({ error: 'Payment not found.' }, 404);
    if (payment.status === 'paid') return json({ ok: true, already: true });

    const { data: prof } = await admin
      .from('profiles')
      .select('provider_access_until')
      .eq('id', user.id)
      .single();
    const current = prof?.provider_access_until ? new Date(prof.provider_access_until as string) : null;
    const base = current && current > new Date() ? current : new Date();
    base.setMonth(base.getMonth() + (payment.period_months ?? 1));

    await admin
      .from('payments')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('id', payment.id);
    await admin
      .from('profiles')
      .update({ provider_access_until: base.toISOString() })
      .eq('id', user.id);

    return json({ ok: true, provider_access_until: base.toISOString() });
  } catch (e) {
    console.error('confirm-subscription error', e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
