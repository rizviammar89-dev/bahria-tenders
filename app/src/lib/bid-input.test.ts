import { describe, expect, it } from '@jest/globals';

import { validateBidInput } from './bid-input';

describe('validateBidInput', () => {
  it('accepts a whole-rupee amount', () => {
    expect(validateBidInput('1500')).toEqual({ ok: true, pricePkr: 1500 });
  });
  it('trims surrounding whitespace', () => {
    expect(validateBidInput('  2000 ')).toEqual({ ok: true, pricePkr: 2000 });
  });
  it('rejects empty / whitespace', () => {
    expect(validateBidInput('').ok).toBe(false);
    expect(validateBidInput('   ').ok).toBe(false);
  });
  it('rejects zero', () => {
    expect(validateBidInput('0').ok).toBe(false);
  });
  it('rejects non-numeric', () => {
    expect(validateBidInput('abc').ok).toBe(false);
    expect(validateBidInput('15oo').ok).toBe(false);
  });
  it('rejects decimals (whole rupees only)', () => {
    expect(validateBidInput('1500.50').ok).toBe(false);
    expect(validateBidInput('1500.0').ok).toBe(false);
  });
  it('rejects negatives', () => {
    expect(validateBidInput('-100').ok).toBe(false);
  });
});
