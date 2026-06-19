// Phone-OTP auth (open model). Login AND signup are the same first step: enter your number, get a
// one-time code, verify. If you have no profile yet, the app then asks you to complete it. No PIN.
// (Demo uses Supabase "test OTP" numbers — fixed codes, no real SMS provider.)
import { normalizePkPhone } from '@/lib/phone';
import type { Role } from '@/lib/role-tabs';
import { supabase } from '@/lib/supabase';

/** Send a one-time code to the phone (creates the auth user on first use). */
export async function sendPhoneOtp(rawPhone: string): Promise<{ error: string | null }> {
  const e164 = normalizePkPhone(rawPhone);
  if (!e164) return { error: 'Enter a valid Pakistani mobile number (e.g. 03001234567).' };
  const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
  return { error: error ? error.message : null };
}

/** Verify the code → establishes the session (the auth listener then renders the app/setup). */
export async function verifyPhoneOtp(rawPhone: string, code: string): Promise<{ error: string | null }> {
  const e164 = normalizePkPhone(rawPhone);
  if (!e164) return { error: 'Invalid number.' };
  if (!/^\d{4,8}$/.test(code.trim())) return { error: 'Enter the code from your SMS.' };
  const { error } = await supabase.auth.verifyOtp({ phone: e164, token: code.trim(), type: 'sms' });
  if (error) return { error: /expired|invalid/i.test(error.message) ? 'That code is incorrect or expired.' : error.message };
  return { error: null };
}

/** For a freshly-verified user with no profile: create their profile (phone comes from the session). */
export async function completeProfile(input: {
  name: string;
  role: Exclude<Role, null>;
  precinct: string;
  serviceIds: string[];
}): Promise<{ error: string | null }> {
  const name = input.name.trim();
  const precinct = input.precinct.trim();
  if (!name) return { error: 'Please enter your name.' };
  if (!precinct) return { error: 'Please enter your precinct.' };
  if (input.role === 'provider' && input.serviceIds.length === 0) return { error: 'Pick at least one trade.' };

  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  const rawPhone = u.user?.phone;
  if (!uid || !rawPhone) return { error: 'Your session expired — please request a new code.' };
  const e164 = normalizePkPhone(rawPhone) ?? `+${rawPhone}`;

  const { error } = await supabase.from('profiles').insert({
    id: uid,
    role: input.role,
    full_name: name,
    phone: e164,
    precinct,
    service_ids: input.role === 'provider' ? input.serviceIds : [],
  });
  if (error) {
    if (/duplicate key|unique/i.test(error.message)) return { error: 'This number already has an account.' };
    return { error: error.message };
  }
  return { error: null };
}
