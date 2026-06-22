// Edge Function: create a Safepay checkout session for the Rs 2500/month provider subscription.
// Only an authenticated provider can call it. Records a pending payment, returns the hosted-checkout
// URL the app opens. A successful payment is confirmed by the safepay-webhook function.
//
// Secrets required (set via `supabase secrets set` or the dashboard):
//   SAFEPAY_API_KEY (the sec_… key), SAFEPAY_V1_SECRET, SAFEPAY_WEBHOOK_SECRET, SAFEPAY_ENV (sandbox|production)
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected automatically.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { Safepay } from 'npm:@sfpy/node-sdk';

// NOTE: verify on the sandbox checkout screen whether the SDK expects rupees (2500) or paisa (250000).
const SUBSCRIPTION_PKR = 2500;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Identify the caller from their JWT.
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Not signed in.' }, 401);

    let redirectTo = 'app://subscription-callback';
    try {
      const parsed = await req.json();
      if (parsed?.redirectTo) redirectTo = String(parsed.redirectTo);
    } catch {
      /* no body → use default */
    }

    const safepay = new Safepay({
      environment: Deno.env.get('SAFEPAY_ENV') ?? 'sandbox',
      apiKey: Deno.env.get('SAFEPAY_API_KEY')!,
      v1Secret: Deno.env.get('SAFEPAY_V1_SECRET')!,
      webhookSecret: Deno.env.get('SAFEPAY_WEBHOOK_SECRET')!,
    });

    const { token } = await safepay.payments.create({ amount: SUBSCRIPTION_PKR, currency: 'PKR' });

    // Record a pending payment (service role — clients cannot write payments).
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: payment, error } = await admin
      .from('payments')
      .insert({
        provider_id: user.id,
        amount_pkr: SUBSCRIPTION_PKR,
        period_months: 1,
        status: 'pending',
        safepay_tracker: token,
      })
      .select('id')
      .single();
    if (error) return json({ error: error.message }, 500);

    const url = safepay.checkout.create({
      token,
      orderId: payment.id,
      redirectUrl: redirectTo,
      cancelUrl: redirectTo,
      source: 'custom',
      webhooks: true,
    });

    return json({ url, tracker: token });
  } catch (e) {
    console.error('create-subscription-checkout error', e);
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
