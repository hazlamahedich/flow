import { describe, it, expect } from 'vitest';
import { detectConflict, buildDiff, mergeNonConflicting } from './conflict-detection';

const FIELD_LABELS: Record<string, string> = {
  name: 'Client Name',
  email: 'Email Address',
  phone: 'Phone Number',
  company: 'Company',
};

describe('conflict-detection', () => {
  describe('detectConflict', () => {
    it('detects no conflict when versions match', () => {
      expect(detectConflict(1, { version: 1, name: 'Test' })).toBe(false);
    });

    it('detects conflict when versions differ', () => {
      expect(detectConflict(1, { version: 2, name: 'Test' })).toBe(true);
    });
  });

  describe('buildDiff', () => {
    it('returns no conflict when states are identical', () => {
      const result = buildDiff(
        { name: 'Alice', email: 'alice@test.com' },
        { name: 'Alice', email: 'alice@test.com' },
        FIELD_LABELS,
      );
      expect(result.hasConflict).toBe(false);
      expect(result.conflictingFields).toHaveLength(0);
    });

    it('detects single field conflict', () => {
      const result = buildDiff(
        { name: 'Alice' },
        { name: 'Bob' },
        FIELD_LABELS,
      );
      expect(result.hasConflict).toBe(true);
      expect(result.conflictingFields).toHaveLength(1);
      expect(result.conflictingFields[0]!.fieldName).toBe('name');
      expect(result.conflictingFields[0]!.fieldLabel).toBe('Client Name');
      expect(result.conflictingFields[0]!.clientValue).toBe('Alice');
      expect(result.conflictingFields[0]!.serverValue).toBe('Bob');
    });

    it('detects multiple field conflicts', () => {
      const result = buildDiff(
        { name: 'Alice', email: 'alice@test.com' },
        { name: 'Bob', email: 'bob@test.com' },
        FIELD_LABELS,
      );
      expect(result.hasConflict).toBe(true);
      expect(result.conflictingFields).toHaveLength(2);
    });

    it('auto-merges non-conflicting fields (partial overlap)', () => {
      const result = buildDiff(
        { name: 'Alice' },
        { name: 'Alice', email: 'alice@test.com' },
        FIELD_LABELS,
      );
      expect(result.hasConflict).toBe(false);
      expect(result.autoMergedFields).toHaveLength(1);
      expect(result.autoMergedFields[0]!.fieldName).toBe('email');
    });

    it('skips system fields', () => {
      const result = buildDiff(
        { name: 'Alice', id: '1', version: 1, created_at: '2024-01-01' },
        { name: 'Alice', id: '2', version: 2, created_at: '2024-01-02' },
        FIELD_LABELS,
      );
      expect(result.conflictingFields).toHaveLength(0);
    });

    it('handles same-field conflict correctly', () => {
      const result = buildDiff(
        { name: 'Alice', phone: '555-0001' },
        { name: 'Alice', phone: '555-0002' },
        FIELD_LABELS,
      );
      expect(result.conflictingFields).toHaveLength(1);
      expect(result.conflictingFields[0]!.fieldName).toBe('phone');
    });

    it('uses field key as fallback label', () => {
      const result = buildDiff(
        { custom_field: 'val1' },
        { custom_field: 'val2' },
        FIELD_LABELS,
      );
      expect(result.conflictingFields[0]!.fieldLabel).toBe('custom_field');
    });
  });

  describe('mergeNonConflicting', () => {
    it('merges with keep_server default', () => {
      const conflictInfo = buildDiff(
        { name: 'Alice', email: 'alice@new.com' },
        { name: 'Bob', email: 'bob@test.com' },
        FIELD_LABELS,
      );

      const result = mergeNonConflicting(
        { name: 'Alice', email: 'alice@new.com' },
        { name: 'Bob', email: 'bob@test.com' },
        conflictInfo,
        {},
      );

      expect(result.name).toBe('Bob');
      expect(result.email).toBe('bob@test.com');
    });

    it('applies keep_client resolution', () => {
      const conflictInfo = buildDiff(
        { name: 'Alice', email: 'alice@new.com' },
        { name: 'Bob', email: 'bob@test.com' },
        FIELD_LABELS,
      );

      const result = mergeNonConflicting(
        { name: 'Alice', email: 'alice@new.com' },
        { name: 'Bob', email: 'bob@test.com' },
        conflictInfo,
        { name: 'keep_client' },
      );

      expect(result.name).toBe('Alice');
      expect(result.email).toBe('bob@test.com');
    });

    it('merges auto-merged client fields', () => {
      const conflictInfo = buildDiff(
        { name: 'Alice', phone: '555-0001' },
        { name: 'Bob' },
        FIELD_LABELS,
      );

      const result = mergeNonConflicting(
        { name: 'Alice', phone: '555-0001' },
        { name: 'Bob' },
        conflictInfo,
        { name: 'keep_server' },
      );

      expect(result.phone).toBe('555-0001');
    });

    it('per-field resolution mix', () => {
      const conflictInfo = buildDiff(
        { name: 'Alice', email: 'alice@new.com' },
        { name: 'Bob', email: 'bob@test.com' },
        FIELD_LABELS,
      );

      const result = mergeNonConflicting(
        { name: 'Alice', email: 'alice@new.com' },
        { name: 'Bob', email: 'bob@test.com' },
        conflictInfo,
        { name: 'keep_client', email: 'keep_server' },
      );

      expect(result.name).toBe('Alice');
      expect(result.email).toBe('bob@test.com');
    });
  });
});
