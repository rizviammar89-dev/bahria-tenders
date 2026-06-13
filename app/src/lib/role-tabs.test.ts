import { describe, expect, it } from '@jest/globals';

import { roleTabs } from './role-tabs';

describe('roleTabs', () => {
  it('a resident sees Post a Job, not Jobs', () => {
    expect(roleTabs('resident')).toEqual({ postJob: true, jobs: false });
  });
  it('a provider sees Jobs, not Post a Job', () => {
    expect(roleTabs('provider')).toEqual({ postJob: false, jobs: true });
  });
  it('an unknown role (null) sees neither role tab', () => {
    expect(roleTabs(null)).toEqual({ postJob: false, jobs: false });
  });
});
