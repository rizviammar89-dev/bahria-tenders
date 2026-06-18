// Story 6.2: thin GUARDED wrapper over expo-location. Every call is try/caught so that on a build
// WITHOUT the native module (the current dev client, until the 6.3 EAS build) it degrades to
// null/false instead of crashing — same non-fatal discipline as savePushToken (Story 2.5).
import * as Location from 'expo-location';

/** Ask for foreground location permission. Returns false on denial OR if the native module is absent. */
export async function requestForegroundPermission(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false; // native module unavailable (pre-build) or prompt failed
  }
}

/** Current coarse position, or null if unavailable/denied/not-built. */
export async function getCurrentPosition(): Promise<{ lat: number; lng: number } | null> {
  try {
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch (e) {
    console.warn('getCurrentPosition failed:', String(e)); // diagnostic: surfaces GPS-off / timeout
    return null;
  }
}

/**
 * Best-effort reverse geocode used to PRE-FILL the address text fields from GPS — the user can
 * still edit. Bahria-specific villa/precinct numbers won't come back reliably, so we only surface
 * a street and a district hint. Guarded: returns null on the pre-build client or any failure.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<{ street: string | null; district: string | null } | null> {
  try {
    const [a] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (!a) return null;
    const street = [a.streetNumber, a.street].filter(Boolean).join(' ') || a.name || null;
    const district = a.district ?? a.subregion ?? null;
    return { street, district };
  } catch (e) {
    console.warn('reverseGeocode failed:', String(e));
    return null;
  }
}
