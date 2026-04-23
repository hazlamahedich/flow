import { faker } from '@faker-js/faker';

export function createWorkspaceData(overrides: Record<string, unknown> = {}) {
  return {
    name: faker.company.name(),
    slug: faker.helpers.slugify(faker.company.name()).toLowerCase(),
    ...overrides,
  };
}

export function createUserData(overrides: Record<string, unknown> = {}) {
  return {
    email: faker.internet.email(),
    fullName: faker.person.fullName(),
    role: 'member' as const,
    ...overrides,
  };
}

export function createInvitationData(overrides: Record<string, unknown> = {}) {
  return {
    email: faker.internet.email(),
    role: 'member' as const,
    ...overrides,
  };
}
