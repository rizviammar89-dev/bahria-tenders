import { describe, expect, it } from '@jest/globals';

import { deriveAuth } from './auth-state';

const A = 'aaaa1111-1111-1111-1111-111111111111';
const B = 'bbbb2222-2222-2222-2222-222222222222';

describe('deriveAuth', () => {
  it('is loading until the session is loaded', () => {
    expect(
      deriveAuth({ sessionUserId: null, sessionLoaded: false, roleState: { uid: null, role: null, exists: false } }),
    ).toEqual({ role: null, loading: true, hasProfile: null });
  });

  it('signed out (session loaded, no user) → no role, not loading', () => {
    expect(
      deriveAuth({ sessionUserId: null, sessionLoaded: true, roleState: { uid: null, role: null, exists: false } }),
    ).toEqual({ role: null, loading: false, hasProfile: null });
  });

  it('signed out does NOT leak the previous user role (the sign-out bug)', () => {
    expect(
      deriveAuth({ sessionUserId: null, sessionLoaded: true, roleState: { uid: A, role: 'provider', exists: true } }),
    ).toEqual({ role: null, loading: false, hasProfile: null });
  });

  it('signed in but role not yet fetched → loading, no role (no wrong-tab flash)', () => {
    expect(
      deriveAuth({ sessionUserId: A, sessionLoaded: true, roleState: { uid: null, role: null, exists: false } }),
    ).toEqual({ role: null, loading: true, hasProfile: null });
  });

  it('signed in with role resolved for this session → role, not loading, hasProfile true', () => {
    expect(
      deriveAuth({ sessionUserId: A, sessionLoaded: true, roleState: { uid: A, role: 'resident', exists: true } }),
    ).toEqual({ role: 'resident', loading: false, hasProfile: true });
  });

  it('signed in but no profile row yet → not loading, hasProfile false (→ profile setup)', () => {
    expect(
      deriveAuth({ sessionUserId: A, sessionLoaded: true, roleState: { uid: A, role: null, exists: false } }),
    ).toEqual({ role: null, loading: false, hasProfile: false });
  });

  it('user B signed in but role still tagged for A → loading, no stale A role', () => {
    expect(
      deriveAuth({ sessionUserId: B, sessionLoaded: true, roleState: { uid: A, role: 'provider', exists: true } }),
    ).toEqual({ role: null, loading: true, hasProfile: null });
  });
});
