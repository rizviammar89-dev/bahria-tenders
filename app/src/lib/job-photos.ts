// Quick-dev: pick + upload problem photos for a job. Picking uses expo-image-picker (NATIVE —
// needs an EAS dev build; guarded so a pre-build client degrades to no-op instead of crashing).
// Upload goes to the public 'job-photos' Storage bucket at "<uid>/<jobId>/<n>.<ext>" (RLS locks
// writes to the owner's folder; reads are public so providers can view via getPublicUrl).
import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

export type PickedPhoto = { uri: string; base64: string; mime: string };

const MAX_PHOTOS = 5;

function toPicked(asset: ImagePicker.ImagePickerAsset): PickedPhoto | null {
  if (!asset.base64) return null;
  return { uri: asset.uri, base64: asset.base64, mime: asset.mimeType ?? 'image/jpeg' };
}

/** Pick up to 5 photos from the library. Returns [] on cancel, denial, or a pre-build client. */
export async function pickJobPhotos(): Promise<PickedPhoto[]> {
  try {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS,
      quality: 0.6,
      base64: true,
    });
    if (res.canceled) return [];
    return res.assets.map(toPicked).filter((p): p is PickedPhoto => p !== null);
  } catch (e) {
    console.warn('pickJobPhotos failed:', String(e));
    return [];
  }
}

/** Take a single photo with the camera. Returns null on cancel, denial, or a pre-build client. */
export async function takeJobPhoto(): Promise<PickedPhoto | null> {
  try {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return null;
    const res = await ImagePicker.launchCameraAsync({ quality: 0.6, base64: true });
    if (res.canceled) return null;
    return res.assets[0] ? toPicked(res.assets[0]) : null;
  } catch (e) {
    console.warn('takeJobPhoto failed:', String(e));
    return null;
  }
}

/** Upload picked photos to the job's folder; returns the stored object paths (skips any that fail). */
export async function uploadJobPhotos(
  uid: string,
  jobId: string,
  photos: PickedPhoto[],
): Promise<string[]> {
  const paths: string[] = [];
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const ext = photo.mime.includes('png') ? 'png' : 'jpg';
    const path = `${uid}/${jobId}/${i}.${ext}`;
    const { error } = await supabase.storage
      .from('job-photos')
      .upload(path, decode(photo.base64), { contentType: photo.mime, upsert: true });
    if (error) {
      console.warn('job photo upload failed:', error.message);
      continue;
    }
    paths.push(path);
  }
  return paths;
}

/** Public URL for a stored job-photo path (bucket is public-read). */
export function jobPhotoUrl(path: string): string {
  return supabase.storage.from('job-photos').getPublicUrl(path).data.publicUrl;
}
