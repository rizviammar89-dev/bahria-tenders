import { describe, expect, it } from '@jest/globals';

import { isValidStars } from './rating';

describe('isValidStars', () => {
  it('accepts integers 1 through 5', () => {
    expect(isValidStars(1)).toBe(true);
    expect(isValidStars(3)).toBe(true);
    expect(isValidStars(5)).toBe(true);
  });

  it('rejects 0 and below (no rating / negative)', () => {
    expect(isValidStars(0)).toBe(false);
    expect(isValidStars(-1)).toBe(false);
  });

  it('rejects 6 and above (out of range)', () => {
    expect(isValidStars(6)).toBe(false);
    expect(isValidStars(10)).toBe(false);
  });

  it('rejects non-integers', () => {
    expect(isValidStars(3.5)).toBe(false);
    expect(isValidStars(NaN)).toBe(false);
  });
});
