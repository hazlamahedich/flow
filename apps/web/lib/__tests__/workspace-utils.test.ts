import { describe, it, expect, vi, beforeEach } from 'vitest';
import { slugify, generateSlug, mapWorkspaceRow } from '../workspace-utils';

describe('slugify', () => {
  it('lowercases and joins with hyphens', () => {
    expect(slugify('My Cool Workspace')).toBe('my-cool-workspace');
  });

  it('removes special characters', () => {
    expect(slugify('Flow @#$% OS!!!')).toBe('flow-os');
  });

  it('trims to 60 chars', () => {
    const input = 'a'.repeat(80);
    expect(slugify(input)).toHaveLength(60);
    expect(slugify(input)).toBe('a'.repeat(60));
  });

  it('returns workspace for empty/whitespace-only input', () => {
    expect(slugify('')).toBe('workspace');
    expect(slugify('   ')).toBe('workspace');
    expect(slugify('!@#$%')).toBe('workspace');
  });

  it('strips leading and trailing hyphens', () => {
    expect(slugify('---hello world---')).toBe('hello-world');
    expect(slugify('___test___')).toBe('test');
  });
});

describe('generateSlug', () => {
  it('appends 6-char hex hash to slugified base', () => {
    const result = generateSlug('My Project');
    expect(result).toMatch(/^my-project-[0-9a-f]{6}$/);
  });

  it('generates unique slugs on repeated calls', () => {
    const results = new Set(Array.from({ length: 10 }, () => generateSlug('Test')));
    expect(results.size).toBeGreaterThan(1);
  });
});

describe('mapWorkspaceRow', () => {
  it('converts snake_case to camelCase', () => {
    const row = {
      id: 'ws-1',
      name: 'Test',
      slug: 'test',
      created_by: 'user-1',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-06-01T00:00:00Z',
      settings: { theme: 'dark' },
    };
    const result = mapWorkspaceRow(row);
    expect(result).toEqual({
      id: 'ws-1',
      name: 'Test',
      slug: 'test',
      createdBy: 'user-1',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-06-01T00:00:00Z',
      settings: { theme: 'dark' },
    });
  });
});
