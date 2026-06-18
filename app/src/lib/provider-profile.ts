// Quick-dev: provider profile data — identity (name/avatar/trades), the reviews they've received
// (public ratings), and a "work done" photo gallery. Media lives in the public 'provider-photos'
// Storage bucket (owner-write); display is via public URLs.
import { decode } from 'base64-arraybuffer';

import type { PickedPhoto } from '@/lib/job-photos';
import { supabase } from '@/lib/supabase';

const BUCKET = 'provider-photos';

export type ProviderProfile = {
  id: string;
  fullName: string;
  avatarPath: string | null;
  workPhotoPaths: string[];
  serviceIds: string[];
  ratingSum: number;
  ratingCount: number;
};

export type ProviderReview = {
  id: string;
  stars: number;
  review: string | null;
  created_at: string;
};

/** Public URL for a provider-photos object path (bucket is public-read). */
export function providerPhotoUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function fetchProviderProfile(
  providerId: string,
): Promise<{ profile: ProviderProfile | null; error: string | null }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_path, work_photo_paths, service_ids, rating_sum, rating_count')
    .eq('id', providerId)
    .single();
  if (error || !data) return { profile: null, error: error?.message ?? 'Profile not found.' };
  return {
    profile: {
      id: data.id,
      fullName: data.full_name,
      avatarPath: data.avatar_path,
      workPhotoPaths: data.work_photo_paths ?? [],
      serviceIds: data.service_ids ?? [],
      ratingSum: data.rating_sum,
      ratingCount: data.rating_count,
    },
    error: null,
  };
}

/** The reviews (ratings) a provider has received, newest first. Public via ratings_select_all. */
export async function fetchProviderReviews(
  providerId: string,
): Promise<{ reviews: ProviderReview[]; error: string | null }> {
  const { data, error } = await supabase
    .from('ratings')
    .select('id, stars, review, created_at')
    .eq('provider_id', providerId)
    .order('created_at', { ascending: false });
  if (error) return { reviews: [], error: error.message };
  return { reviews: (data ?? []) as ProviderReview[], error: null };
}

function extFor(mime: string): string {
  return mime.includes('png') ? 'png' : 'jpg';
}

/** Upload/replace the provider's avatar (fixed path, upsert) and record it on the profile. */
export async function uploadAvatar(
  uid: string,
  photo: PickedPhoto,
): Promise<{ path: string | null; error: string | null }> {
  const path = `${uid}/avatar.${extFor(photo.mime)}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, decode(photo.base64), { contentType: photo.mime, upsert: true });
  if (error) return { path: null, error: error.message };
  const { error: updErr } = await supabase
    .from('profiles')
    .update({ avatar_path: path })
    .eq('id', uid);
  if (updErr) return { path: null, error: updErr.message };
  return { path, error: null };
}

/** Upload work-gallery photos, append to the profile, and return the new full list. */
export async function addWorkPhotos(
  uid: string,
  existing: string[],
  photos: PickedPhoto[],
): Promise<{ paths: string[]; error: string | null }> {
  const added: string[] = [];
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    // Date.now() keeps names unique across adds even after some are removed (no path reuse).
    const path = `${uid}/work/${Date.now()}_${i}.${extFor(photo.mime)}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, decode(photo.base64), { contentType: photo.mime, upsert: true });
    if (error) {
      console.warn('work photo upload failed:', error.message);
      continue;
    }
    added.push(path);
  }
  const all = [...existing, ...added];
  const { error: updErr } = await supabase
    .from('profiles')
    .update({ work_photo_paths: all })
    .eq('id', uid);
  if (updErr) return { paths: existing, error: updErr.message };
  return { paths: all, error: null };
}

/** Remove one work photo from storage + the profile; returns the new list. */
export async function removeWorkPhoto(
  uid: string,
  existing: string[],
  path: string,
): Promise<{ paths: string[]; error: string | null }> {
  const all = existing.filter((p) => p !== path);
  const { error: updErr } = await supabase
    .from('profiles')
    .update({ work_photo_paths: all })
    .eq('id', uid);
  if (updErr) return { paths: existing, error: updErr.message };
  // Best-effort storage cleanup — the profile no longer references it regardless.
  void supabase.storage.from(BUCKET).remove([path]);
  return { paths: all, error: null };
}
