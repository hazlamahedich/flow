import { test as base } from '@playwright/test';

export const test = base.extend({
  testWorkspace: async ({}, use) => {
    await use({
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'Test Workspace',
      slug: 'test-workspace',
    });
  },
});

export { expect } from '@playwright/test';
