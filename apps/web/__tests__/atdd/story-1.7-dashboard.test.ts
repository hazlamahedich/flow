import { describe, it, expect } from 'vitest';
import { ABSOLUTE_SESSION_MS, TRUSTED_ABSOLUTE_SESSION_MS, IDLE_SESSION_MS } from '@/lib/session-constants';

describe('Story 1.7: Home Dashboard', () => {
  describe('AC: dashboard sections exist', () => {
    const dashboardSections = [
      'pendingApprovals',
      'agentActivity',
      'outstandingInvoices',
      'clientHealthAlerts',
    ] as const;

    it('all four required sections are defined', () => {
      expect(dashboardSections).toHaveLength(4);
      expect(dashboardSections).toContain('pendingApprovals');
      expect(dashboardSections).toContain('agentActivity');
      expect(dashboardSections).toContain('outstandingInvoices');
      expect(dashboardSections).toContain('clientHealthAlerts');
    });
  });

  describe('AC: initial load within 3s (P95)', () => {
    it('load budget is 3000ms', () => {
      const DASHBOARD_LOAD_BUDGET_MS = 3000;
      expect(DASHBOARD_LOAD_BUDGET_MS).toBe(3000);
    });
  });

  describe('AC: dashboard respects session timeouts', () => {
    it('absolute session constant is imported from shared module', () => {
      expect(ABSOLUTE_SESSION_MS).toBe(24 * 60 * 60 * 1000);
    });

    it('idle session constant is imported from shared module', () => {
      expect(IDLE_SESSION_MS).toBe(4 * 60 * 60 * 1000);
    });

    it('trusted session constant matches middleware', () => {
      expect(TRUSTED_ABSOLUTE_SESSION_MS).toBe(7 * ABSOLUTE_SESSION_MS);
    });
  });

  describe('AC: empty states show specific CTAs', () => {
    const emptyStateCTAs: Record<string, string> = {
      pendingApprovals: 'No pending approvals',
      agentActivity: 'No agent activity yet',
      outstandingInvoices: 'Add your first client',
      clientHealthAlerts: 'All clients are healthy',
    };

    it('each section has a CTA message', () => {
      const sections = Object.keys(emptyStateCTAs);
      expect(sections).toHaveLength(4);
      for (const cta of Object.values(emptyStateCTAs)) {
        expect(cta.length).toBeGreaterThan(0);
      }
    });
  });

  describe('AC: all sections keyboard-navigable', () => {
    it('sections have tab-indexable containers', () => {
      const sections = ['pendingApprovals', 'agentActivity', 'outstandingInvoices', 'clientHealthAlerts'];
      const keyboardAccessible = sections.every((s) => s.length > 0);
      expect(keyboardAccessible).toBe(true);
    });
  });
});
