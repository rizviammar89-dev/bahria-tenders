// Self-service signup (open model). Creates the auth account (synthetic phone-email + PIN) then
// inserts the user's own profile. Trust fields (verified_by_admin etc.) are set server-side by the
// profiles_set_trust trigger — providers come out auto-verified and can bid immediately.
import { normalizePkPhone, phoneToSyntheticEmail } from '@/lib/phone';
import type { Role } from '@/lib/role-tabs';
import { supabase } from '@/lib/supabase';

export type SignUpInput = {
  name: string;
  phone: string;
  pin: string;
  role: Exclude<Role, null>;
  precinct: string;
  serviceIds: string[]; // provider trades; empty for residents
};

export async function signUpUser(input: SignUpInput): Promise<{ error: string | null }> {
  const name = input.name.trim();
  const precinct = input.precinct.trim();
  if (!name) return { error: 'Please enter your name.' };
  const e164 = normalizePkPhone(input.phone);
  if (!e164) return { error: 'Enter a valid Pakistani mobile number (e.g. 03001234567).' };
  if (!/^\d{6,}$/.test(input.pin)) return { error: 'PIN must be at least 6 digits.' };
  if (!precinct) return { error: 'Please enter your precinct.' };
  if (input.role === 'provider' && input.serviceIds.length === 0) {
    return { error: 'Pick at least one trade.' };
  }

  // 1. Create the auth account (cloud is set to auto-confirm, so this signs them in immediately).
  const { data, error } = await supabase.auth.signUp({
    email: phoneToSyntheticEmail(e164),
    password: input.pin,
  });
  if (error) {
    if (/already registered|already exists/i.test(error.message)) {
      return { error: 'This number is already registered — try logging in instead.' };
    }
    return { error: error.message };
  }
  const uid = data.user?.id;
  if (!uid) return { error: "Couldn't create your account — please try again." };

  // 2. Insert the profile (trust fields are forced server-side by the trigger).
  const { error: pErr } = await supabase.from('profiles').insert({
    id: uid,
    role: input.role,
    full_name: name,
    phone: e164,
    precinct,
    service_ids: input.role === 'provider' ? input.serviceIds : [],
  });
  if (pErr) {
    if (/duplicate key|unique/i.test(pErr.message)) {
      return { error: 'This number is already registered — try logging in instead.' };
    }
    return { error: pErr.message };
  }
  return { error: null };
}
