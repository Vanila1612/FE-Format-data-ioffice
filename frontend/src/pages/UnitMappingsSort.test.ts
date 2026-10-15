import { describe, expect, it } from 'vitest';
import type { UnitMapping } from '../types/api';

describe('Unit mappings sorting by updatedAt descending', () => {
  function sortMappings(mappings: UnitMapping[]) {
    return [...mappings].sort((a, b) => {
      const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return timeB - timeA;
    });
  }

  it('sorts mappings by updatedAt descending (latest updated first)', () => {
    const input: UnitMapping[] = [
      { id: '1', sourceName: 'BAN KIỂM SOÁT', normalizedName: 'Ban Kiểm soát', enabled: true, updatedAt: '2026-10-14T08:00:00.000Z' },
      { id: '2', sourceName: 'Ban ALCO', normalizedName: 'Ban QLTS', enabled: true, updatedAt: '2026-10-14T09:30:00.000Z' },
      { id: '3', sourceName: 'Ban Công nghệ', normalizedName: 'Ban CN', enabled: true, updatedAt: '2026-10-14T07:15:00.000Z' }
    ];

    const sorted = sortMappings(input);

    expect(sorted.map(m => m.id)).toEqual(['2', '1', '3']);
    expect(sorted[0].sourceName).toBe('Ban ALCO');
  });

  it('handles fallback to createdAt when updatedAt is missing', () => {
    const input: UnitMapping[] = [
      { id: '1', sourceName: 'Old', normalizedName: 'Old', enabled: true, createdAt: '2026-10-14T06:00:00.000Z' },
      { id: '2', sourceName: 'New', normalizedName: 'New', enabled: true, createdAt: '2026-10-14T10:00:00.000Z' }
    ];

    const sorted = sortMappings(input);

    expect(sorted.map(m => m.id)).toEqual(['2', '1']);
  });
});
