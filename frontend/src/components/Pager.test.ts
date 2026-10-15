import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { Pager, pageNumbers } from './Pager';

describe('pageNumbers algorithm', () => {
  it('returns 1 to total when total <= 7', () => {
    expect(pageNumbers(1, 1)).toEqual([1]);
    expect(pageNumbers(3, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageNumbers(7, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('handles current page <= 4 with ellipsis before last page', () => {
    expect(pageNumbers(1, 10)).toEqual([1, 2, 3, 4, 5, '…', 10]);
    expect(pageNumbers(4, 10)).toEqual([1, 2, 3, 4, 5, '…', 10]);
    expect(pageNumbers(1, 13266)).toEqual([1, 2, 3, 4, 5, '…', 13266]);
  });

  it('handles current page near the end (current >= total - 3)', () => {
    expect(pageNumbers(7, 10)).toEqual([1, '…', 6, 7, 8, 9, 10]);
    expect(pageNumbers(10, 10)).toEqual([1, '…', 6, 7, 8, 9, 10]);
    expect(pageNumbers(13266, 13266)).toEqual([1, '…', 13262, 13263, 13264, 13265, 13266]);
  });

  it('handles current page in the middle with ellipsis on both sides', () => {
    expect(pageNumbers(5, 10)).toEqual([1, '…', 4, 5, 6, '…', 10]);
    expect(pageNumbers(6, 10)).toEqual([1, '…', 5, 6, 7, '…', 10]);
  });
});

describe('Pager component markup', () => {
  it('renders null when total <= 0', () => {
    const html = renderToString(
      React.createElement(Pager, {
        page: 1,
        pageSize: 20,
        total: 0,
        onPageChange: vi.fn(),
        onPageSizeChange: vi.fn()
      })
    );
    expect(html).toBe('');
  });

  it('renders pagination bar with page sizes [10, 20, 50, 100] by default', () => {
    const html = renderToString(
      React.createElement(Pager, {
        page: 1,
        pageSize: 20,
        total: 265308,
        totalPages: 13266,
        onPageChange: vi.fn(),
        onPageSizeChange: vi.fn()
      })
    );
    expect(html.replace(/<!--.*?-->/g, '')).toContain('265.308 bản ghi · Trang 1/13266');
    expect(html).toContain('Hiển thị');
    expect(html).toContain('<option value="10">10</option>');
    expect(html).toContain('<option value="20" selected="">20</option>');
    expect(html).toContain('<option value="50">50</option>');
    expect(html).toContain('<option value="100">100</option>');
    expect(html).toContain('Trước');
    expect(html).toContain('Sau');
    expect(html).toContain('current-page');
    expect(html).toContain('13266');
  });

  it('disables "Trước" button when on first page', () => {
    const html = renderToString(
      React.createElement(Pager, {
        page: 1,
        pageSize: 20,
        total: 100,
        onPageChange: vi.fn(),
        onPageSizeChange: vi.fn()
      })
    );
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Trước<\/button>/);
  });

  it('disables "Sau" button when on last page', () => {
    const html = renderToString(
      React.createElement(Pager, {
        page: 5,
        pageSize: 20,
        total: 100,
        onPageChange: vi.fn(),
        onPageSizeChange: vi.fn()
      })
    );
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Sau<\/button>/);
  });
});
