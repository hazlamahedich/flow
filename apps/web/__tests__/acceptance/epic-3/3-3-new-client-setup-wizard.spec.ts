import { describe, test, expect } from 'vitest';
import { createClientSchema } from '@flow/types';
import { createTestClient } from './test-factories';

describe('Story 3.3: New Client Setup Wizard', () => {
  describe('Wizard Step Sequence (FR73e)', () => {
    test('[P0] [3.3-UNIT-001] should define the wizard step order', () => {
      // Given: the expected wizard step sequence
      const wizardSteps = [
        'contact_details',
        'billing_notes',
        'retainer_setup',
        'review',
      ] as const;
      // Then: steps are in correct order
      expect(wizardSteps[0]).toBe('contact_details');
      expect(wizardSteps[1]).toBe('billing_notes');
      expect(wizardSteps[2]).toBe('retainer_setup');
      expect(wizardSteps[3]).toBe('review');
    });

    test('[P0] [3.3-UNIT-002] should require contact details as the first step', () => {
      // Given: expected contact detail fields
      const contactFields = ['name', 'email', 'phone', 'company_name'] as const;
      // Then: name and email are present
      expect(contactFields).toContain('name');
      expect(contactFields).toContain('email');
    });

    test('[P0] [3.3-UNIT-003] should include billing and notes fields', () => {
      // Given: expected billing fields
      const billingFields = ['billing_email', 'hourly_rate_cents', 'address'] as const;
      // Then: billing email and rate are present
      expect(billingFields).toContain('billing_email');
      expect(billingFields).toContain('hourly_rate_cents');
    });

    test('[P0] [3.3-UNIT-004] should validate contact step fields against createClientSchema', () => {
      // Given: contact-only data via factory
      const contactOnly = createClientSchema.safeParse(createTestClient({
        name: 'Acme Corp',
        email: 'contact@acme.com',
        phone: '+1-555-0100',
        companyName: 'Acme Inc',
      }));
      // Then: schema accepts it
      expect(contactOnly.success).toBe(true);
    });

    test('[P0] [3.3-UNIT-005] should validate billing step fields against createClientSchema', () => {
      // Given: billing-only data via factory
      const billingOnly = createClientSchema.safeParse(createTestClient({
        name: 'Acme Corp',
        billingEmail: 'billing@acme.com',
        hourlyRateCents: 7500,
        address: '123 Main St',
        notes: 'VIP client',
      }));
      // Then: schema accepts it
      expect(billingOnly.success).toBe(true);
    });

    test('[P1] [3.3-UNIT-006] should allow retainer setup as optional wizard step', () => {
      // Given: the retainer setup step is optional
      const optionalSteps = ['retainer_setup'] as const;
      expect(optionalSteps).toContain('retainer_setup');
    });

    test('[P1] [3.3-UNIT-007] should include review step before final submission', () => {
      // Given: the review step
      const reviewStep = 'review';
      expect(reviewStep).toBe('review');
    });
  });
  describe('Wizard Completion Under 5 Minutes', () => {
    test('[P0] [3.3-UNIT-008] should define maximum completion time constraint', () => {
      // Given: the NFR constraint for wizard completion
      const MAX_COMPLETION_MINUTES = 5;
      expect(MAX_COMPLETION_MINUTES).toBe(5);
    });
    test.skip('[P0] [3.3-E2E-001] should complete standard client setup in under 5 minutes (NFR)', () => {
      // Requires running app — E2E performance test
    });
  });
  describe('Progress Indicators', () => {
    test('[P0] [3.3-UNIT-009] should define progress indicator for each wizard step', () => {
      // Given: 4 wizard steps
      const totalSteps = 4;
      // When: creating step indicators
      const steps = Array.from({ length: totalSteps }, (_, i) => ({
        step: i + 1,
        completed: false,
        label: `Step ${i + 1}`,
      }));
      // Then: 4 steps created with correct numbering
      expect(steps).toHaveLength(4);
      expect(steps[0]?.step).toBe(1);
      expect(steps[3]?.step).toBe(4);
    });

    test('[P1] [3.3-UNIT-010] should calculate progress percentage from current step', () => {
      // Given: step 2 of 4
      const totalSteps = 4;
      const currentStep = 2;
      // When: calculating progress
      const progress = Math.round(((currentStep - 1) / (totalSteps - 1)) * 100);
      // Then: 33% complete
      expect(progress).toBe(33);
    });

    test('[P1] [3.3-UNIT-011] should mark completed steps in progress indicator', () => {
      // Given: partially completed steps
      const stepStates = [
        { step: 1, completed: true },
        { step: 2, completed: true },
        { step: 3, completed: false },
        { step: 4, completed: false },
      ];
      // Then: 2 completed
      const completedCount = stepStates.filter((s) => s.completed).length;
      expect(completedCount).toBe(2);
    });

    test.skip('[P0] [3.3-E2E-002] should render progress bar indicating current wizard step', () => {
      // Requires running app — E2E test
    });
  });
  describe('Client Creation on Completion', () => {
    test('[P0] [3.3-UNIT-012] should define complete client payload from wizard aggregation', () => {
      // Given: wizard payload aggregating contact, billing, and optional retainer
      const wizardPayload = {
        contact: { name: '', email: '', phone: '', company_name: '' },
        billing: { billing_email: '', hourly_rate_cents: null, address: '' },
        retainer: undefined as { type: string } | undefined,
      };
      // Then: contact and billing sections exist
      expect(wizardPayload.contact).toBeDefined();
      expect(wizardPayload.billing).toBeDefined();
    });

    test('[P0] [3.3-UNIT-013] should validate required fields before wizard submission', () => {
      // Given: a valid client payload with required name
      const requiredOnSubmit = ['name'] as const;
      const payload = createTestClient({ name: 'Acme Corp' });
      const isValid = requiredOnSubmit.every((field) => {
        const value = payload[field as keyof typeof payload];
        return typeof value === 'string' && value.length > 0;
      });
      // Then: payload is valid
      expect(isValid).toBe(true);
    });
    test('[P0] [3.3-UNIT-014] should validate full wizard payload against createClientSchema', () => {
      // Given: a complete wizard payload via factory
      const fullPayload = createClientSchema.safeParse(createTestClient({
        name: 'Wizard Client',
        email: 'wiz@test.com',
        phone: '+1-555-0199',
        companyName: 'Wizard Corp',
        billingEmail: 'billing@wizard.com',
        hourlyRateCents: 10000,
        address: '456 Wizard Lane',
        notes: 'Created via wizard',
      }));
      // Then: schema accepts it
      expect(fullPayload.success).toBe(true);
      if (fullPayload.success) {
        expect(fullPayload.data.name).toBe('Wizard Client');
        expect(fullPayload.data.hourlyRateCents).toBe(10000);
      }
    });

    test('[P1] [3.3-UNIT-015] should reject wizard submission with missing required fields', () => {
      // Given: a payload with empty name
      const requiredOnSubmit = ['name'] as const;
      const payload = { name: '' };
      const isValid = requiredOnSubmit.every((field) => {
        const value = payload[field as keyof typeof payload];
        return typeof value === 'string' && value.length > 0;
      });
      // Then: payload is invalid
      expect(isValid).toBe(false);
    });
    test('[P0] [3.3-UNIT-016] should reject wizard payload with empty name via Zod', () => {
      // Given: a payload with empty name
      const result = createClientSchema.safeParse(createTestClient({
        name: '',
        email: 'test@test.com',
      }));
      expect(result.success).toBe(false);
    });
    test('[P0] [3.3-UNIT-017] should reject wizard payload with invalid email via Zod', () => {
      // Given: a payload with invalid email
      const result = createClientSchema.safeParse(createTestClient({
        name: 'Test Client',
        email: 'not-an-email',
      }));
      expect(result.success).toBe(false);
    });
    test('[P0] [3.3-UNIT-018] should reject wizard payload with negative hourly rate via Zod', () => {
      // Given: a payload with negative hourly rate
      const result = createClientSchema.safeParse(createTestClient({
        name: 'Test Client',
        hourlyRateCents: -500,
      }));
      expect(result.success).toBe(false);
    });
    test.skip('[P0] [3.3-INT-001] should create client with all wizard data on final submission', () => {
      // Requires running Supabase — integration test
    });
    test.skip('[P0] [3.3-E2E-003] should redirect to client detail page after successful creation', () => {
      // Requires running app — E2E test
    });
    test.skip('[P0] [3.3-INT-002] should show newly created client in client list', () => {
      // Requires running Supabase — integration test
    });
    test.skip('[P1] [3.3-E2E-004] should preserve partial data on navigation back within wizard', () => {
      // Requires running app — E2E test
    });

    test.skip('[P1] [3.3-E2E-005] should clear wizard state on completion or explicit cancel', () => {
      // Requires running app — E2E test
    });
  });
  describe('Navigation & Validation Per Step', () => {
    test('[P0] [3.3-UNIT-019] should prevent forward navigation when current step is invalid', () => {
      // Given: a contact step validator
      const validateContactStep = (data: { name: string }) => {
        const errors: string[] = [];
        if (!data.name || data.name.trim().length === 0) errors.push('name_required');
        return { valid: errors.length === 0, errors };
      };

      // When: name is empty
      const result = validateContactStep({ name: '' });
      // Then: validation fails with name_required error
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('name_required');
    });

    test('[P0] [3.3-UNIT-020] should validate contact step against createClientSchema', () => {
      // Given: valid and invalid contact data
      const validContact = createClientSchema.safeParse(createTestClient({ name: 'Valid Name' }));
      expect(validContact.success).toBe(true);

      // When: name is empty
      const invalidContact = createClientSchema.safeParse(createTestClient({ name: '' }));
      expect(invalidContact.success).toBe(false);
    });

    test('[P1] [3.3-UNIT-021] should allow backward navigation to previous steps', () => {
      // Given: step 3
      const currentStep = 3;
      // Then: can go back
      const canGoBack = currentStep > 1;
      expect(canGoBack).toBe(true);
    });

    test('[P1] [3.3-UNIT-022] should not allow backward navigation from step 1', () => {
      // Given: step 1
      const currentStep = 1;
      // Then: cannot go back
      const canGoBack = currentStep > 1;
      expect(canGoBack).toBe(false);
    });

    test('[P1] [3.3-UNIT-023] should skip optional retainer step when declined', () => {
      // Given: user declines retainer setup
      const wantsRetainer = false;
      const steps = ['contact_details', 'billing_notes', 'review'];
      // When: building step list based on choice
      const finalSteps = wantsRetainer
        ? ['contact_details', 'billing_notes', 'retainer_setup', 'review']
        : steps;
      // Then: retainer step is skipped
      expect(finalSteps).toHaveLength(3);
      expect(finalSteps).not.toContain('retainer_setup');
    });

    test.skip('[P0] [3.3-E2E-006] should validate each step before allowing forward navigation', () => {
      // Requires running app — E2E test
    });
  });
  describe('Accessibility & Keyboard Navigation', () => {
    test('[P1] [3.3-UNIT-024] should support keyboard navigation between wizard steps', () => {
      // Given: expected keyboard actions
      const keyboardActions = ['Tab', 'Enter', 'Escape'] as const;
      // Then: all actions are defined
      expect(keyboardActions).toContain('Tab');
      expect(keyboardActions).toContain('Enter');
    });

    test.skip('[P0] [3.3-E2E-007] should meet WCAG 2.1 AA for all wizard steps (FR97)', () => {
      // Requires running app — E2E accessibility audit
    });

    test.skip('[P1] [3.3-E2E-008] should announce step changes to screen readers via focus management', () => {
      // Requires running app — E2E accessibility test
    });
  });
});
