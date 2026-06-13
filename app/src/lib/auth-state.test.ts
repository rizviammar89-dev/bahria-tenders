import { describe, expect, it } from '@jest/globals';

import { deriveAuth } from './auth-state';

const A = 'aaaa1111-1111-1111-1111-111111111111';
const B = 'bbbb2222-2222-2222-2222-222222222222';

describe('deriveAuth', () => {
  it('is loading until the session is loaded', () => {
    expect(deriveAuth({ sessionUserId: null, sessionLoaded: false, roleState: { uid: null, role: null } })).toEqual({
      role: null,
      loading: true,
    });
  });

  it('signed out (session loaded, no user) → no role, not loading', () => {
    expect(deriveAuth({ sessionUserId: null, sessionLoaded: true, roleState: { uid: null, role: null } })).toEqual({
      role: null,
      loading: false,
    });
  });

  it('signed out does NOT leak the previous user role (the sign-out bug)', () => {
    // session gone, but roleState still holds the last provider — must NOT surface it.
    expect(deriveAuth({ sessionUserId: null, sessionLoaded: true, roleState: { uid: A, role: 'provider' } })).toEqual({
      role: null,
      loading: false,
    });
  });

  it('signed in but role not yet fetched → loading, no role (no wrong-tab flash)', () => {
    expect(deriveAuth({ sessionUserId: A, sessionLoaded: true, roleState: { uid: null, role: null } })).toEqual({
      role: null,
      loading: true,
    });
  });

  it('signed in with role resolved for this session → role, not loading', () => {
    expect(deriveAuth({ sessionUserId: A, sessionLoaded: true, roleState: { uid: A, role: 'resident' } })).toEqual({
      role: 'resident',
      loading: false,
    });
  });

  it('user B signed in but role still tagged for A → loading, no stale A role', () => {
    expect(deriveAuth({ sessionUserId: B, sessionLoaded: true, roleState: { uid: A, role: 'provider' } })).toEqual({
      role: null,
      loading: true,
    });
  });
});
