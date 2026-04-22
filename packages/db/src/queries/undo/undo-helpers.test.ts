import { describe, it, expect } from 'vitest';
import { buildUndoPayload } from './undo-helpers';

describe('undo-helpers', () => {
  describe('buildUndoPayload', () => {
    it('builds payload with correct fields', () => {
      const payload = buildUndoPayload(
        'client',
        'c-1',
        { name: 'Before' },
        'op-uuid-1',
        1,
        'whisper',
        false,
        'Updated client',
      );
      expect(payload.operationId).toBe('op-uuid-1');
      expect(payload.entityType).toBe('client');
      expect(payload.entityId).toBe('c-1');
      expect(payload.previousSnapshot).toEqual({ name: 'Before' });
      expect(payload.expectedVersion).toBe(1);
      expect(payload.severity).toBe('whisper');
      expect(payload.irreversible).toBe(false);
      expect(payload.description).toBe('Updated client');
    });

    it('defaults severity to whisper', () => {
      const payload = buildUndoPayload('client', 'c-1', {}, 'op-1', 1);
      expect(payload.severity).toBe('whisper');
    });

    it('defaults irreversible to false', () => {
      const payload = buildUndoPayload('client', 'c-1', {}, 'op-1', 1);
      expect(payload.irreversible).toBe(false);
    });

    it('supports ceremony severity for deletes', () => {
      const payload = buildUndoPayload(
        'client', 'c-1', { name: 'Deleted' }, 'op-1', 2,
        'ceremony', true, 'Deleted client',
      );
      expect(payload.severity).toBe('ceremony');
      expect(payload.irreversible).toBe(true);
    });
  });
});
