import { describe, expect, it } from '@jest/globals';

import { formatSchedule, nextDays } from './schedule';

const TODAY = new Date(2026, 5, 19); // 2026-06-19 (local, month is 0-based)

describe('formatSchedule', () => {
  it('null date → as soon as possible', () => {
    expect(formatSchedule(null, null, TODAY)).toBe('As soon as possible');
    expect(formatSchedule(null, 'morning', TODAY)).toBe('As soon as possible · morning');
  });

  it('today / tomorrow are named', () => {
    expect(formatSchedule('2026-06-19', null, TODAY)).toBe('Today');
    expect(formatSchedule('2026-06-19', 'afternoon', TODAY)).toBe('Today · afternoon');
    expect(formatSchedule('2026-06-20', null, TODAY)).toBe('Tomorrow');
  });

  it('further dates are not "Today"/"Tomorrow" and include the slot', () => {
    const label = formatSchedule('2026-06-25', 'evening', TODAY);
    expect(label).not.toMatch(/Today|Tomorrow|As soon/);
    expect(label).toMatch(/· evening$/);
  });
});

describe('nextDays', () => {
  it('starts at Today, then Tomorrow, with the right count', () => {
    const days = nextDays(TODAY, 5);
    expect(days).toHaveLength(5);
    expect(days[0]).toEqual({ value: '2026-06-19', label: 'Today' });
    expect(days[1]).toEqual({ value: '2026-06-20', label: 'Tomorrow' });
    expect(days[4].value).toBe('2026-06-23');
  });
});
