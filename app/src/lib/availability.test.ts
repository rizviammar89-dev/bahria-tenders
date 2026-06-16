import { describe, expect, it } from '@jest/globals';

import { availabilityIsFresh, shouldPublish } from './availability-logic';

const NOW = 1_000_000_000_000; // fixed "now" in ms

describe('availabilityIsFresh', () => {
  it('is true when the heartbeat is within the window', () => {
    const fiveMinAgo = new Date(NOW - 5 * 60_000).toISOString();
    expect(availabilityIsFresh(fiveMinAgo, NOW, 15)).toBe(true);
  });

  it('is false when the heartbeat is older than the window', () => {
    const twentyMinAgo = new Date(NOW - 20 * 60_000).toISOString();
    expect(availabilityIsFresh(twentyMinAgo, NOW, 15)).toBe(false);
  });

  it('is false for null or unparseable timestamps', () => {
    expect(availabilityIsFresh(null, NOW, 15)).toBe(false);
    expect(availabilityIsFresh('not-a-date', NOW, 15)).toBe(false);
  });
});

describe('shouldPublish', () => {
  it('publishes when never published before', () => {
    expect(shouldPublish(null, NOW, 20_000)).toBe(true);
  });

  it('does not publish before the throttle elapses', () => {
    expect(shouldPublish(NOW - 10_000, NOW, 20_000)).toBe(false);
  });

  it('publishes once the throttle has elapsed', () => {
    expect(shouldPublish(NOW - 20_000, NOW, 20_000)).toBe(true);
  });
});
