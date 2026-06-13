import { describe, expect, it } from '@jest/globals';

import { timeAgo } from './time-ago';

const NOW = Date.parse('2026-06-13T12:00:00Z');

describe('timeAgo', () => {
  it('shows "just now" under a minute', () => {
    expect(timeAgo('2026-06-13T11:59:30Z', NOW)).toBe('just now');
  });
  it('shows minutes', () => {
    expect(timeAgo('2026-06-13T11:55:00Z', NOW)).toBe('5 min ago');
    expect(timeAgo('2026-06-13T11:59:00Z', NOW)).toBe('1 min ago');
  });
  it('shows hours', () => {
    expect(timeAgo('2026-06-13T09:00:00Z', NOW)).toBe('3 hr ago');
    expect(timeAgo('2026-06-13T11:00:00Z', NOW)).toBe('1 hr ago');
  });
  it('shows days', () => {
    expect(timeAgo('2026-06-11T12:00:00Z', NOW)).toBe('2 days ago');
    expect(timeAgo('2026-06-12T12:00:00Z', NOW)).toBe('1 day ago');
  });
  it('uses Western Arabic numerals only', () => {
    expect(timeAgo('2026-06-13T11:55:00Z', NOW)).toMatch(/^[0-9]/);
  });
});
