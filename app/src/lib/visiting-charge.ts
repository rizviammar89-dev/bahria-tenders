// Story 6.1: present the distance-based visiting charge (FR-27). The DB `visiting_charge`
// function owns the rule (Rs 250 when > 3 km); this just formats it for display.

export type VisitingCharge = { distanceKm: number | null; chargePkr: number };

/**
 * Human label for the visiting charge:
 *  - location unavailable (distanceKm null) → "" (show nothing)
 *  - charge applies → "Rs <n> visiting charge (≈<d> km away)"
 *  - within range → "No visiting charge (within 3 km)"
 */
export function visitingChargeLabel({ distanceKm, chargePkr }: VisitingCharge): string {
  if (distanceKm == null) return '';
  if (chargePkr > 0) return `Rs ${chargePkr} visiting charge (≈${distanceKm.toFixed(1)} km away)`;
  return 'No visiting charge (within 3 km)';
}
