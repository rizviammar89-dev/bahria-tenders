// Favorites / re-hire data layer (resident-owned). The favorites table has two FKs to profiles,
// so the provider embed is disambiguated by the FK name (favorites_provider_id_fkey).
import { currentUserId } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export type FavoriteProvider = {
  id: string;
  fullName: string;
  avatarPath: string | null;
  serviceIds: string[];
  ratingSum: number;
  ratingCount: number;
};

export async function fetchFavorites(): Promise<{ providers: FavoriteProvider[]; error: string | null }> {
  const uid = await currentUserId();
  if (!uid) return { providers: [], error: 'You are not signed in.' };
  const { data, error } = await supabase
    .from('favorites')
    .select(
      'provider:profiles!favorites_provider_id_fkey(id, full_name, avatar_path, service_ids, rating_sum, rating_count)',
    )
    .eq('resident_id', uid)
    .order('created_at', { ascending: false });
  if (error) return { providers: [], error: error.message };
  const providers = (data ?? [])
    .map((row) => {
      const prov = (row as { provider: unknown }).provider;
      return (Array.isArray(prov) ? prov[0] : prov) as Record<string, unknown> | null;
    })
    .filter((p): p is Record<string, unknown> => p != null)
    .map((p) => ({
      id: p.id as string,
      fullName: p.full_name as string,
      avatarPath: (p.avatar_path as string | null) ?? null,
      serviceIds: (p.service_ids as string[] | null) ?? [],
      ratingSum: (p.rating_sum as number) ?? 0,
      ratingCount: (p.rating_count as number) ?? 0,
    }));
  return { providers, error: null };
}

/** The set of provider ids the signed-in resident has favorited (for heart state). */
export async function fetchFavoriteIds(): Promise<Set<string>> {
  const uid = await currentUserId();
  if (!uid) return new Set();
  const { data, error } = await supabase.from('favorites').select('provider_id').eq('resident_id', uid);
  if (error) return new Set();
  return new Set((data ?? []).map((r) => r.provider_id as string));
}

export async function addFavorite(providerId: string): Promise<{ error: string | null }> {
  const uid = await currentUserId();
  if (!uid) return { error: 'You are not signed in.' };
  const { error } = await supabase.from('favorites').insert({ resident_id: uid, provider_id: providerId });
  // Unique-violation = already favorited → treat as success (idempotent).
  if (error && !/duplicate key|unique/i.test(error.message)) return { error: error.message };
  return { error: null };
}

export async function removeFavorite(providerId: string): Promise<{ error: string | null }> {
  const uid = await currentUserId();
  if (!uid) return { error: 'You are not signed in.' };
  const { error } = await supabase
    .from('favorites')
    .delete()
    .eq('resident_id', uid)
    .eq('provider_id', providerId);
  return { error: error ? error.message : null };
}
