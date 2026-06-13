// Story 2.3b (review): pure derivation of the auth view-state. Extracted from AuthProvider so
// the session/role/loading state machine is unit-testable — notably that sign-out never leaks
// the previous user's role. `roleState` is the role tagged with the uid it was fetched for.
import type { Role } from '@/lib/role-tabs';

export function deriveAuth(input: {
  sessionUserId: string | null;
  sessionLoaded: boolean;
  roleState: { uid: string | null; role: Role };
}): { role: Role; loading: boolean } {
  const signedIn = input.sessionUserId != null;
  const roleResolved = signedIn ? input.roleState.uid === input.sessionUserId : true;
  return {
    // Only expose the role when signed in AND it was fetched for THIS session — never the
    // previous user's stale role after sign-out.
    role: signedIn && roleResolved ? input.roleState.role : null,
    loading: !input.sessionLoaded || !roleResolved,
  };
}
