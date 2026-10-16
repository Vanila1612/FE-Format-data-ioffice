import { describe, expect, it } from 'vitest';
import { getMonthDateRange } from './format';

describe('getMonthDateRange', () => {
  it('correctly calculates 31-day month', () => {
    const range = getMonthDateRange('2026-08');
    expect(range).toEqual({ from: '2026-08-01', to: '2026-08-31' });
  });

  it('correctly calculates 30-day month', () => {
    const range = getMonthDateRange('2026-04');
    expect(range).toEqual({ from: '2026-04-01', to: '2026-04-30' });
  });

  it('correctly calculates leap year February', () => {
    const range = getMonthDateRange('2024-02');
    expect(range).toEqual({ from: '2024-02-01', to: '2024-02-29' });
  });

  it('correctly calculates non-leap year February', () => {
    const range = getMonthDateRange('2025-02');
    expect(range).toEqual({ from: '2025-02-01', to: '2025-02-28' });
  });

  it('handles invalid inputs gracefully', () => {
    expect(getMonthDateRange('')).toEqual({ from: '', to: '' });
    expect(getMonthDateRange('invalid')).toEqual({ from: '', to: '' });
    expect(getMonthDateRange('2026-13')).toEqual({ from: '', to: '' });
  });
});
