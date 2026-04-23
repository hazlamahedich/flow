import { mergeTests } from '@playwright/test';
import { test as apiRequestFixture } from '@seontechnologies/playwright-utils/api-request/fixtures';
import { test as recurseFixture } from '@seontechnologies/playwright-utils/recurse/fixtures';
import { test as logFixture } from '@seontechnologies/playwright-utils/log/fixtures';
import { test as interceptFixture } from '@seontechnologies/playwright-utils/intercept-network-call/fixtures';
import { test as authFixture } from './auth/supabase-auth-fixture';

export const test = mergeTests(
  apiRequestFixture,
  recurseFixture,
  logFixture,
  interceptFixture,
  authFixture,
);

export { expect } from '@playwright/test';
