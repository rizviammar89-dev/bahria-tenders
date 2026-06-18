// Story 1.4: Supabase client singleton for the Expo app.
// Session persists in AsyncStorage; tokens auto-refresh while the app is foregrounded.
// Only the ANON key ships in the app — RLS (Story 1.3) is what protects data.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import { AppState } from 'react-native';

// EXPO_PUBLIC_ vars are inlined at build time and MUST be read via static dot-access.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy app/.env.example to app/.env.local and fill in `supabase status` values (use your LAN IP for a physical device).',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // no URL to parse in React Native
    // React Native's runtime exposes a partial `navigator.locks` that never resolves, so
    // supabase-js's default Web Locks adapter makes getSession() hang forever (permanent
    // "loading" / blank screen). processLock is Supabase's RN-safe in-memory lock.
    lock: processLock,
  },
});

// Refresh tokens only while the app is in the foreground (Supabase RN guidance).
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
