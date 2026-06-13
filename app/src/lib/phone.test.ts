import { describe, expect, it } from '@jest/globals';

import { normalizePkPhone, phoneToSyntheticEmail } from './phone';

describe('normalizePkPhone', () => {
  it('normalizes local 03XXXXXXXXX format', () => {
    expect(normalizePkPhone('03001234567')).toBe('+923001234567');
  });
  it('passes through canonical +923XXXXXXXXX', () => {
    expect(normalizePkPhone('+923001234567')).toBe('+923001234567');
  });
  it('normalizes 923XXXXXXXXX (missing +)', () => {
    expect(normalizePkPhone('923001234567')).toBe('+923001234567');
  });
  it('normalizes bare 3XXXXXXXXX (no leading 0 or country code)', () => {
    expect(normalizePkPhone('3001234567')).toBe('+923001234567');
  });
  it('tolerates spaces and dashes', () => {
    expect(normalizePkPhone('0300-123 4567')).toBe('+923001234567');
    expect(normalizePkPhone('+92 300 1234567')).toBe('+923001234567');
  });
  it('accepts all mobile network prefixes (3xx)', () => {
    expect(normalizePkPhone('03451234567')).toBe('+923451234567'); // Zong
    expect(normalizePkPhone('03331234567')).toBe('+923331234567'); // Ufone
    expect(normalizePkPhone('03121234567')).toBe('+923121234567'); // Warid
  });

  it('rejects a landline (021...)', () => {
    expect(normalizePkPhone('0211234567')).toBeNull();
  });
  it('rejects non-mobile country-code numbers (not starting 3)', () => {
    expect(normalizePkPhone('+922001234567')).toBeNull();
    expect(normalizePkPhone('02001234567')).toBeNull();
  });
  it('rejects wrong length', () => {
    expect(normalizePkPhone('0300123')).toBeNull();
    expect(normalizePkPhone('030012345678')).toBeNull();
  });
  it('rejects letters / junk', () => {
    expect(normalizePkPhone('0300abcd567')).toBeNull();
    expect(normalizePkPhone('')).toBeNull();
  });
});

describe('phoneToSyntheticEmail', () => {
  it('maps E.164 to the synthetic auth email', () => {
    expect(phoneToSyntheticEmail('+923001234567')).toBe(
      '+923001234567@phone.bahria-tenders.local',
    );
  });
});
