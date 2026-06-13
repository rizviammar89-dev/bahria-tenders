/**
 * Story 1.4: Founder onboarding tool — provisions a POC account (no SMS/OTP).
 *
 * Creates a Supabase auth user (synthetic email + PIN, auto-confirmed) and the matching
 * public.profiles row, with phone_verified_at set (the founder vouches by calling the person).
 *
 * RUN (from the app/ dir):
 *   cd app
 *   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<service_role key from `supabase status`> \
 *     npx tsx scripts/provision_user.ts \
 *     --phone 03001234567 --pin 1234 --role provider --name "Bilal Carpenter" \
 *     --precinct "Precinct 10" --services carpenter,painter
 *
 * SECURITY: SUPABASE_SERVICE_ROLE_KEY is a secret — pass via env only, never commit it.
 */
import { createClient } from '@supabase/supabase-js';

import { normalizePkPhone, phoneToSyntheticEmail } from '../src/lib/phone';

type Args = Record<string, string>;

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      args[key] = val;
    }
  }
  return args;
}

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) fail('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.');

  const a = parseArgs(process.argv.slice(2));
  const { phone, pin, role, name, precinct } = a;
  if (!phone || !pin || !role || !name || !precinct) {
    fail('Required: --phone --pin --role <resident|provider> --name --precinct [--services slug,slug]');
  }
  if (role !== 'resident' && role !== 'provider') fail(`role must be resident|provider, got "${role}"`);
  if (pin.length < 4) fail('PIN must be at least 4 characters.');

  const e164 = normalizePkPhone(phone);
  if (!e164) fail(`Invalid Pakistani mobile number: "${phone}"`);
  const email = phoneToSyntheticEmail(e164);

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Resolve provider trade slugs -> service ids.
  let serviceIds: string[] = [];
  if (role === 'provider' && a.services) {
    const slugs = a.services.split(',').map((s) => s.trim()).filter(Boolean);
    const { data: services, error } = await supabase
      .from('services')
      .select('id, slug')
      .in('slug', slugs);
    if (error) fail(`Could not load services: ${error.message}`);
    const found = new Set((services ?? []).map((s) => s.slug));
    const missing = slugs.filter((s) => !found.has(s));
    if (missing.length) fail(`Unknown service slug(s): ${missing.join(', ')}`);
    serviceIds = (services ?? []).map((s) => s.id);
  }

  // 1. Create the auth user (synthetic email + PIN, auto-confirmed).
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password: pin,
    email_confirm: true,
  });
  if (createErr || !created?.user) fail(`createUser failed: ${createErr?.message ?? 'no user returned'}`);
  const userId = created.user.id;

  // 2. Insert the matching profile. On failure, delete the auth user (no orphans).
  const { error: profileErr } = await supabase.from('profiles').insert({
    id: userId,
    role,
    full_name: name,
    phone: e164,
    precinct,
    phone_verified_at: new Date().toISOString(),
    verified_by_admin: role === 'provider',
    service_ids: serviceIds,
  });
  if (profileErr) {
    await supabase.auth.admin.deleteUser(userId); // roll back the orphan
    fail(`profile insert failed (auth user rolled back): ${profileErr.message}`);
  }

  console.log(`✓ Provisioned ${role} "${name}" — phone ${e164}, login email ${email}`);
  console.log(`  user id: ${userId}`);
  if (role === 'provider') console.log(`  trades: ${a.services ?? '(none)'}  verified_by_admin: true`);
}

main().catch((e) => fail(String(e)));
