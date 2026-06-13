// Story 2.3b: which role-specific tabs to show. Residents post jobs; providers find them.
// Pure + unit-tested; the tab bar reads this. (Home + Push Spike are always shown.)
export type Role = 'resident' | 'provider' | null;

export function roleTabs(role: Role): { postJob: boolean; jobs: boolean } {
  return {
    postJob: role === 'resident',
    jobs: role === 'provider',
  };
}
