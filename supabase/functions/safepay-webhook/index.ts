// Edge Function: Safepay webhook → on a verified, successful payment, extend the provider's access by
// a month. Deployed with verify_jwt=false (Safepay calls it unauthenticated); we authenticate the
// request by its HMAC signature instead.
//
// SECURITY: every request must carry a valid Safepay signature —
//   x-sfpy-signature == HMAC-SHA512(SAFEPAY_WEBHOOK_SECRET, JSON.stringify(body.data))   (hex)
// (matches @sfpy/node-sdk `verify.webhook`). Unsigned or mismatched requests are rejected. We then
// grant access ONLY for a recognized success state and otherwise do nothing — the function fails
// CLOSED, so an unexpected event (cancel/failed/…) can never over-grant. The redirect path
// (confirm-subscription) is the primary grant; this webhook is a reliability backstop.
import { createClient } from 'npm:@supabase/supabase-js@2';

// Tracker/order states that mean "money captured". Failing closed on anything else is intentional;
// widen this set only against a real captured success payload.
const SUCCESS_STATES = new Set(['TRACKER_ENDED', 'PAID', 'COMPLETED', 'SUCCEEDED', 'CAPTURED']);

Deno.serve(async (req) => {
  const raw = await req.text();

  const webhookSecret = Deno.env.get('SAFEPAY_WEBHOOK_SECRET') ?? '';
  if (!webhookSecret) {
    console.error('safepay-webhook: SAFEPAY_WEBHOOK_SECRET is not set — rejecting');
    return new Response('not configured', { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response('bad json', { status: 400 });
  }

  // 1. Authenticate: HMAC-SHA512 over the stringified `data` object, keyed by the webhook secret.
  const data = (body.data ?? {}) as Record<string, unknown>;
  const expected = await hmacHex(webhookSecret, JSON.stringify(data));
  const provided = (req.headers.get('x-sfpy-signature') ?? '').toLowerCase();
  if (!provided || !timingSafeEqual(provided, expected)) {
    console.warn('safepay-webhook: signature verification failed');
    return new Response('invalid signature', { status: 401 });
  }

  // 2. Extract tracker + state from the verified payload.
  const token = (data.tracker ?? data.token ?? body.tracker ?? body.token) as string | undefined;
  const state = String(data.state ?? data.type ?? body.type ?? '').toUpperCase();
  if (!token) return new Response('no tracker', { status: 200 });

  // 3. Fail closed: only a recognized success state grants access.
  if (!SUCCESS_STATES.has(state)) {
    console.log('safepay-webhook: ignoring non-success state', state, 'for tracker', token);
    return new Response('ignored', { status: 200 });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: payment } = await admin
    .from('payments')
    .select('id, provider_id, status, period_months')
    .eq('safepay_tracker', token)
    .maybeSingle();
  if (!payment) return new Response('unknown payment', { status: 200 });
  if (payment.status === 'paid') return new Response('already processed', { status: 200 });

  const { data: prof } = await admin
    .from('profiles')
    .select('provider_access_until')
    .eq('id', payment.provider_id)
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
    .eq('id', payment.provider_id);

  console.log('safepay-webhook: extended access for', payment.provider_id, 'until', base.toISOString());
  return new Response('ok', { status: 200 });
});

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time compare of two hex strings. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
