import { expect } from 'vitest';

expect.extend({
  toBeValidUuid(received: string) {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    return {
      pass,
      message: () =>
        pass
          ? `Expected ${received} not to be a valid UUID`
          : `Expected ${received} to be a valid UUID`,
    };
  },
  toBeNonNull(received: unknown) {
    return {
      pass: received !== null && received !== undefined,
      message: () =>
        `Expected value to be non-null, received: ${String(received)}`,
    };
  },
});

declare module 'vitest' {
  interface Assertion {
    toBeValidUuid(): void;
    toBeNonNull(): void;
  }
}
