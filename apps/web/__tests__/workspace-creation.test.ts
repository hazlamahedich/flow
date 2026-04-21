import { describe, it, expect } from 'vitest';
import { createWorkspaceSchema } from '@flow/types';

describe('workspace-creation', () => {
  describe('createWorkspaceSchema contract', () => {
    it('accepts valid name', () => {
      const result = createWorkspaceSchema.safeParse({ name: 'My Agency' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('My Agency');
      }
    });

    it('rejects empty name', () => {
      const result = createWorkspaceSchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
    });

    it('rejects name over 100 characters', () => {
      const result = createWorkspaceSchema.safeParse({ name: 'A'.repeat(101) });
      expect(result.success).toBe(false);
    });

    it('rejects non-string name', () => {
      const result = createWorkspaceSchema.safeParse({ name: 123 });
      expect(result.success).toBe(false);
    });

    it('rejects missing name', () => {
      const result = createWorkspaceSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('strips unknown properties', () => {
      const result = createWorkspaceSchema.safeParse({ name: 'Test', extra: 'field' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect('extra' in result.data).toBe(false);
      }
    });
  });

  describe('slug generation logic', () => {
    function slugify(name: string): string {
      return name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'workspace';
    }

    it('generates slug from workspace name', () => {
      expect(slugify('My Cool Agency')).toBe('my-cool-agency');
    });

    it('handles special characters', () => {
      expect(slugify('My Agency & Co.')).not.toContain('&');
      expect(slugify('My Agency & Co.')).not.toContain('.');
    });

    it('handles empty name gracefully', () => {
      expect(slugify('')).toBe('workspace');
    });

    it('truncates long names', () => {
      expect(slugify('A'.repeat(100)).length).toBeLessThanOrEqual(60);
    });
  });
});
