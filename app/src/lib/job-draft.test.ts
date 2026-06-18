import { describe, expect, it } from '@jest/globals';

import { validateJobDraft } from './job-draft';

describe('validateJobDraft', () => {
  const valid = {
    serviceId: 'svc-1',
    description: 'Leaky tap in the kitchen',
    addressUnit: 'Villa 123',
    addressStreet: 'Rose Street',
    precinct: 'Precinct 10',
  };

  it('accepts a complete draft', () => {
    expect(validateJobDraft(valid)).toEqual({ ok: true });
  });

  it('rejects a missing trade', () => {
    const r = validateJobDraft({ ...valid, serviceId: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/trade/i);
  });

  it('rejects an empty / whitespace description', () => {
    expect(validateJobDraft({ ...valid, description: '   ' }).ok).toBe(false);
    expect(validateJobDraft({ ...valid, description: '' }).ok).toBe(false);
  });

  it('rejects an empty / whitespace villa/apartment number', () => {
    const r = validateJobDraft({ ...valid, addressUnit: '  ' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/villa|apartment/i);
  });

  it('rejects an empty / whitespace street/building name', () => {
    const r = validateJobDraft({ ...valid, addressStreet: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/street|building/i);
  });

  it('rejects an empty / whitespace precinct', () => {
    expect(validateJobDraft({ ...valid, precinct: '  ' }).ok).toBe(false);
    expect(validateJobDraft({ ...valid, precinct: '' }).ok).toBe(false);
  });

  it('accepts values that are valid only after trimming', () => {
    expect(
      validateJobDraft({
        serviceId: 'svc-1',
        description: '  fix it  ',
        addressUnit: '  123 ',
        addressStreet: '  Rose St ',
        precinct: '  P10 ',
      }),
    ).toEqual({ ok: true });
  });
});
