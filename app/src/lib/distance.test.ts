import { describe, expect, it } from '@jest/globals';

import { CHARGE_THRESHOLD_KM, haversineKm, VISITING_CHARGE_PKR, visitingChargeForKm } from './distance';

describe('haversineKm', () => {
  it('is ~0 for identical points', () => {
    expect(haversineKm(24.86, 67.0, 24.86, 67.0)).toBeCloseTo(0, 5);
  });

  it('is ~1.11 km per 0.01° of latitude', () => {
    const d = haversineKm(24.86, 67.0, 24.87, 67.0);
    expect(d).toBeGreaterThan(1.0);
    expect(d).toBeLessThan(1.2);
  });

  it('is symmetric', () => {
    const a = haversineKm(24.86, 67.0, 24.9, 67.05);
    const b = haversineKm(24.9, 67.05, 24.86, 67.0);
    expect(a).toBeCloseTo(b, 9);
  });
});

describe('visitingChargeForKm', () => {
  it('is Rs 0 at or under the 3 km threshold', () => {
    expect(visitingChargeForKm(0)).toBe(0);
    expect(visitingChargeForKm(CHARGE_THRESHOLD_KM)).toBe(0);
    expect(visitingChargeForKm(CHARGE_THRESHOLD_KM - 0.01)).toBe(0);
  });

  it('is Rs 250 just over the threshold', () => {
    expect(visitingChargeForKm(CHARGE_THRESHOLD_KM + 0.01)).toBe(VISITING_CHARGE_PKR);
    expect(visitingChargeForKm(10)).toBe(VISITING_CHARGE_PKR);
  });
});
