import { describe, expect, it } from '@jest/globals';

import { visitingChargeLabel } from './visiting-charge';

describe('visitingChargeLabel', () => {
  it('shows the charge with rounded distance when one applies', () => {
    expect(visitingChargeLabel({ distanceKm: 3.24, chargePkr: 250 })).toBe(
      'Rs 250 visiting charge (≈3.2 km away)',
    );
  });

  it('says no charge when within range', () => {
    expect(visitingChargeLabel({ distanceKm: 2.1, chargePkr: 0 })).toBe(
      'No visiting charge (within 3 km)',
    );
  });

  it('returns empty string when location is unavailable', () => {
    expect(visitingChargeLabel({ distanceKm: null, chargePkr: 0 })).toBe('');
  });
});
