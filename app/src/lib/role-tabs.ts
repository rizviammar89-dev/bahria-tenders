// Story 2.3b: which role-specific tabs to show. Residents post jobs; providers find them.
// Pure + unit-tested; the tab bar reads this. (Home + Push Spike are always shown.)
export type Role = 'resident' | 'provider' | null;

export function roleTabs(
  role: Role,
): { postJob: boolean; myJobs: boolean; jobs: boolean; profile: boolean } {
  return {
    postJob: role === 'resident',
    myJobs: role === 'resident',
    jobs: role === 'provider',
    profile: role === 'provider', // a provider's own profile (name, picture, trade, reviews, work)
  };
}
