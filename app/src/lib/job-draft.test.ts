import { describe, expect, it } from '@jest/globals';

import { validateJobDraft } from './job-draft';

describe('validateJobDraft', () => {
  const valid = { serviceId: 'svc-1', description: 'Leaky tap in the kitchen', precinct: 'Precinct 10' };

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

  it('rejects an empty / whitespace precinct', () => {
    expect(validateJobDraft({ ...valid, precinct: '  ' }).ok).toBe(false);
    expect(validateJobDraft({ ...valid, precinct: '' }).ok).toBe(false);
  });

  it('accepts values that are valid only after trimming', () => {
    expect(validateJobDraft({ serviceId: 'svc-1', description: '  fix it  ', precinct: '  P10 ' })).toEqual({
      ok: true,
    });
  });
});
