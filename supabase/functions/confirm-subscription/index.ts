// Edge Function: confirm a provider subscription payment when the user returns from Safepay checkout.
// Called by the app (authenticated) with the tracker from create-subscription-checkout and the full
// redirect URL Safepay returned to. Extends the caller's provider access by one month — but ONLY
// after cryptographically verifying the payment.
//
// SECURITY: access is granted solely on Safepay's "Transaction Integrity" signature. On a genuinely
// completed transaction Safepay appends `?tracker=…&sig=…` to the redirect, where
//   sig = HMAC-SHA256(SAFEPAY_V1_SECRET, tracker)   (hex)
// (see Safepay's transaction-integrity scheme; matches @sfpy/node-sdk `verify.signature`). We
// recompute that HMAC and require an exact match, so a caller cannot self-grant access without a
// real, Safepay-signed return. No signature / wrong signature / mismatched tracker ⇒ rejected.
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const v1Secret = Deno.env.get('SAFEPAY_V1_SECRET') ?? '';

    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Not signed in.' }, 401);

    const { redirectUrl } = await req.json().catch(() => ({}) as Record<string, unknown>);

    // Extract the signed (tracker, sig) pair Safepay appended to the redirect URL.
    const params = parseParams(String(redirectUrl ?? ''));
    const tracker = params.get('tracker');
    const sig = params.get('sig');
    if (!tracker || !sig) return json({ error: 'Missing payment signature.' }, 400);

    // Verify the payment cryptographically. This is the self-grant guard: without SAFEPAY_V1_SECRET
    // the caller cannot produce a matching sig.
    if (!v1Secret) {
      console.error('confirm-subscription: SAFEPAY_V1_SECRET is not set');
      return json({ error: 'Payment verification unavailable.' }, 500);
    }
    const expected = await hmacHex('SHA-256', v1Secret, tracker);
    if (!timingSafeEqual(sig, expected)) {
      console.warn('confirm-subscription: signature mismatch for tracker', tracker, 'user', user.id);
      return json({ error: 'Payment could not be verified.' }, 403);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // The verified tracker must belong to a pending payment owned by the caller.
    const { data: payment } = await admin
      .from('payments')
      .select('id, provider_id, status, period_months')
      .eq('safepay_tracker', tracker)
      .eq('provider_id', user.id)
      .maybeSingle();
    if (!payment) return json({ error: 'Payment not found.' }, 404);
    if (payment.status === 'paid') return json({ ok: true, already: true });

    const until = await extendAccess(admin, payment.provider_id, payment.id, payment.period_months ?? 1);
    return json({ ok: true, provider_access_until: until });
  } catch (e) {
    console.error('confirm-subscription error', e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});

/** Pull query params from a redirect URL, tolerating custom schemes (app://, exp://…/--/…). */
function parseParams(url: string): URLSearchParams {
  const q = url.indexOf('?');
  if (q === -1) return new URLSearchParams();
  // Strip any fragment after the query so it doesn't leak into the last param.
  const query = url.slice(q + 1).split('#')[0];
  return new URLSearchParams(query);
}

/** Mark the payment paid and extend the provider's access window by `months`. Returns the new until. */
async function extendAccess(
  admin: ReturnType<typeof createClient>,
  providerId: string,
  paymentId: string,
  months: number,
): Promise<string> {
  const { data: prof } = await admin
    .from('profiles')
    .select('provider_access_until')
    .eq('id', providerId)
    .single();
  const current = prof?.provider_access_until ? new Date(prof.provider_access_until as string) : null;
  const base = current && current > new Date() ? current : new Date();
  base.setMonth(base.getMonth() + months);

  await admin
    .from('payments')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', paymentId);
  await admin
    .from('profiles')
    .update({ provider_access_until: base.toISOString() })
    .eq('id', providerId);
  return base.toISOString();
}

async function hmacHex(hash: 'SHA-256' | 'SHA-512', secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time string compare (case-insensitive hex) to avoid leaking the signature via timing. */
function timingSafeEqual(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
