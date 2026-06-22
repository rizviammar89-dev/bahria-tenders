// Edge Function: Safepay webhook → on a successful payment, extend the provider's access by a month.
// Deployed with verify_jwt=false (Safepay calls it unauthenticated).
//
// BRING-UP MODE (sandbox): Safepay's exact signature scheme/secret and payload shape aren't in the
// public docs, so this version LOGS the headers + body, tries verifying with each candidate secret
// to discover which one Safepay uses, and (in sandbox) processes the payment so we can confirm the
// end-to-end flow. Once the logs reveal the real secret + success state, we ENFORCE verification.
import { createClient } from 'npm:@supabase/supabase-js@2';

const SIGNATURE_HEADERS = [
  'x-sfpy-signature',
  'x-safepay-signature',
  'x-signature',
  'signature',
  'x-sfpy-hmac',
];

Deno.serve(async (req) => {
  const raw = await req.text();

  // 1. Always log + persist what Safepay actually sent — this is how we learn the real format.
  const headers = Object.fromEntries(req.headers.entries());
  console.log('safepay-webhook HEADERS', JSON.stringify(headers));
  console.log('safepay-webhook BODY', raw.slice(0, 2000));

  const debugAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  await debugAdmin.from('webhook_debug').insert({ headers, body: raw }).then(
    () => {},
    () => {}, // best-effort
  );

  // 2. Diagnose which secret signs the webhook: compute HMAC with each candidate and see which
  //    matches a signature header.
  const candidates: Record<string, string> = {
    webhookSecret: Deno.env.get('SAFEPAY_WEBHOOK_SECRET') ?? '',
    v1Secret: Deno.env.get('SAFEPAY_V1_SECRET') ?? '',
    apiKey: Deno.env.get('SAFEPAY_API_KEY') ?? '',
  };
  const headerSig = (SIGNATURE_HEADERS.map((h) => req.headers.get(h)).find(Boolean) ?? '').toLowerCase();
  let matchedSecret = '';
  for (const [name, secret] of Object.entries(candidates)) {
    if (!secret) continue;
    const hex = await hmacHex(secret, raw);
    if (headerSig && hex.toLowerCase() === headerSig) matchedSecret = name;
    console.log(`safepay-webhook hmac[${name}]`, hex.slice(0, 16), 'match:', hex.toLowerCase() === headerSig);
  }
  console.log('safepay-webhook headerSig', headerSig.slice(0, 16), 'matchedSecret:', matchedSecret || 'NONE');

  // 3. Parse + extend access (sandbox bring-up). TODO: once matchedSecret + success state are known,
  //    reject when the signature doesn't match and only extend on the success event.
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response('bad json', { status: 200 });
  }
  const d = (body.data ?? body) as Record<string, unknown>;
  const token = (d.tracker ?? d.token ?? body.tracker ?? body.token) as string | undefined;
  const state = String(d.state ?? body.state ?? body.type ?? '').toUpperCase();
  console.log('safepay-webhook tracker', token, 'state', state);
  if (!token) return new Response('no tracker', { status: 200 });

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

  console.log('safepay-webhook extended access for', payment.provider_id, 'until', base.toISOString());
  return new Response('ok', { status: 200 });
});

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
