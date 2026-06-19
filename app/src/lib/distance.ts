// Story 6.4: pure distance + visiting-charge math, kept free of any Supabase import so it's
// unit-testable. Mirrors the SQL haversine_km / visiting_charge rule for instant client-side
// feedback on the live map (the authoritative charge on bid cards still comes from the RPC).
export const CHARGE_THRESHOLD_KM = 3; // build-time tunable (FR-27)
export const VISITING_CHARGE_PKR = 250;

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Rs 250 iff strictly more than the threshold away, else Rs 0 (matches SQL visiting_charge). */
export function visitingChargeForKm(distanceKm: number): number {
  return distanceKm > CHARGE_THRESHOLD_KM ? VISITING_CHARGE_PKR : 0;
}
