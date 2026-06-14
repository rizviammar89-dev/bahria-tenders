import { describe, expect, it } from '@jest/globals';

import { roleTabs } from './role-tabs';

describe('roleTabs', () => {
  it('a resident sees Post a Job + My Jobs, not Jobs', () => {
    expect(roleTabs('resident')).toEqual({ postJob: true, myJobs: true, jobs: false });
  });
  it('a provider sees Jobs, not Post a Job / My Jobs', () => {
    expect(roleTabs('provider')).toEqual({ postJob: false, myJobs: false, jobs: true });
  });
  it('an unknown role (null) sees no role tabs', () => {
    expect(roleTabs(null)).toEqual({ postJob: false, myJobs: false, jobs: false });
  });
});
