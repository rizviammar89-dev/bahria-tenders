import { describe, expect, it } from '@jest/globals';

import { reputationLabel } from './reputation';

describe('reputationLabel', () => {
  it('shows the new-provider zero-state when there are no ratings', () => {
    expect(reputationLabel({ ratingCount: 0, ratingSum: 0 })).toBe('New provider');
  });
  it('shows average (1 dp) from N jobs for a rated provider', () => {
    expect(reputationLabel({ ratingCount: 12, ratingSum: 55 })).toBe('4.6 from 12 jobs');
  });
  it('handles a single rating', () => {
    expect(reputationLabel({ ratingCount: 1, ratingSum: 5 })).toBe('5.0 from 1 job');
  });
  it('rounds the average to one decimal place', () => {
    expect(reputationLabel({ ratingCount: 3, ratingSum: 10 })).toBe('3.3 from 3 jobs');
  });
});
