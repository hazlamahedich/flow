import { describe, it, expect } from 'vitest';
import {
  ALLOWED_TRANSITIONS,
  isValidTransition,
  assertTransition,
  SharedAgentTransitionError,
} from '../src/agent-transitions';
import type { AgentBackendStatus } from '@flow/types';

describe('agent-transitions', () => {
  describe('ALLOWED_TRANSITIONS', () => {
    it('defines transitions for all backend statuses', () => {
      const statuses: AgentBackendStatus[] = ['inactive', 'activating', 'active', 'draining', 'suspended'];
      for (const status of statuses) {
        expect(ALLOWED_TRANSITIONS[status]).toBeDefined();
        expect(Array.isArray(ALLOWED_TRANSITIONS[status])).toBe(true);
      }
    });

    it('allows inactive → activating', () => {
      expect(ALLOWED_TRANSITIONS.inactive).toContain('activating');
    });

    it('allows inactive → suspended', () => {
      expect(ALLOWED_TRANSITIONS.inactive).toContain('suspended');
    });

    it('allows activating → active', () => {
      expect(ALLOWED_TRANSITIONS.activating).toContain('active');
    });

    it('allows activating → inactive', () => {
      expect(ALLOWED_TRANSITIONS.activating).toContain('inactive');
    });

    it('allows activating → suspended', () => {
      expect(ALLOWED_TRANSITIONS.activating).toContain('suspended');
    });

    it('allows active → draining', () => {
      expect(ALLOWED_TRANSITIONS.active).toContain('draining');
    });

    it('allows active → suspended', () => {
      expect(ALLOWED_TRANSITIONS.active).toContain('suspended');
    });

    it('allows draining → inactive', () => {
      expect(ALLOWED_TRANSITIONS.draining).toContain('inactive');
    });

    it('allows draining → suspended', () => {
      expect(ALLOWED_TRANSITIONS.draining).toContain('suspended');
    });

    it('allows suspended → inactive', () => {
      expect(ALLOWED_TRANSITIONS.suspended).toContain('inactive');
    });
  });

  describe('isValidTransition', () => {
    it('returns true for valid transitions', () => {
      expect(isValidTransition('inactive', 'activating')).toBe(true);
      expect(isValidTransition('activating', 'active')).toBe(true);
      expect(isValidTransition('active', 'draining')).toBe(true);
      expect(isValidTransition('draining', 'inactive')).toBe(true);
      expect(isValidTransition('suspended', 'inactive')).toBe(true);
    });

    it('returns true for self-transitions (idempotent)', () => {
      const statuses: AgentBackendStatus[] = ['inactive', 'activating', 'active', 'draining', 'suspended'];
      for (const status of statuses) {
        expect(isValidTransition(status, status)).toBe(true);
      }
    });

    it('returns false for active → inactive (must drain first)', () => {
      expect(isValidTransition('active', 'inactive')).toBe(false);
    });

    it('returns false for active → activating', () => {
      expect(isValidTransition('active', 'activating')).toBe(false);
    });

    it('returns false for draining → active', () => {
      expect(isValidTransition('draining', 'active')).toBe(false);
    });

    it('returns false for suspended → active (must go through activating)', () => {
      expect(isValidTransition('suspended', 'active')).toBe(false);
    });

    it('returns false for suspended → activating (must go through inactive first)', () => {
      expect(isValidTransition('suspended', 'activating')).toBe(false);
    });

    it('returns false for inactive → active (must go through activating)', () => {
      expect(isValidTransition('inactive', 'active')).toBe(false);
    });

    it('returns false for inactive → draining', () => {
      expect(isValidTransition('inactive', 'draining')).toBe(false);
    });
  });

  describe('assertTransition', () => {
    it('does not throw for valid transitions', () => {
      expect(() => assertTransition('inactive', 'activating')).not.toThrow();
    });

    it('does not throw for self-transitions', () => {
      expect(() => assertTransition('active', 'active')).not.toThrow();
    });

    it('throws AgentTransitionError for invalid transitions', () => {
      expect(() => assertTransition('active', 'inactive')).toThrow(SharedAgentTransitionError);
    });

    it('includes from and to in error message', () => {
      try {
        assertTransition('active', 'inactive');
      } catch (error) {
        const err = error as SharedAgentTransitionError;
        expect(err.from).toBe('active');
        expect(err.to).toBe('inactive');
        expect(err.message).toContain('active');
        expect(err.message).toContain('inactive');
      }
    });
  });
});
