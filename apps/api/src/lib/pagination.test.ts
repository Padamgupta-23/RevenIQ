import { describe, it, expect } from 'vitest';
import { parsePagination, buildPaginationMeta } from './pagination.js';

describe('pagination lib', () => {
  it('parses defaults when query is empty', () => {
    const params = parsePagination({});
    expect(params.page).toBe(1);
    expect(params.pageSize).toBe(20);
    expect(params.skip).toBe(0);
    expect(params.take).toBe(20);
    expect(params.search).toBeUndefined();
    expect(params.sort).toBeUndefined();
  });

  it('parses valid page and pageSize within limits', () => {
    const params = parsePagination({ page: '3', pageSize: '50' });
    expect(params.page).toBe(3);
    expect(params.pageSize).toBe(50);
    expect(params.skip).toBe(100);
    expect(params.take).toBe(50);
  });

  it('clamps pageSize to max 100', () => {
    const params = parsePagination({ pageSize: '500' });
    expect(params.pageSize).toBe(100);
  });

  it('handles negative or invalid values gracefully', () => {
    const params = parsePagination({ page: '-5', pageSize: 'abc' });
    expect(params.page).toBe(1);
    expect(params.pageSize).toBe(20);
  });

  it('parses sort fields and directions', () => {
    const asc = parsePagination({ sort: 'createdAt:asc' });
    expect(asc.sortField).toBe('createdAt');
    expect(asc.sortOrder).toBe('asc');

    const desc = parsePagination({ sort: '-createdAt' });
    expect(desc.sortField).toBe('createdAt');
    expect(desc.sortOrder).toBe('desc');
  });

  it('builds pagination metadata', () => {
    const meta = buildPaginationMeta(2, 20, 55);
    expect(meta).toEqual({
      page: 2,
      pageSize: 20,
      total: 55,
    });
  });
});

