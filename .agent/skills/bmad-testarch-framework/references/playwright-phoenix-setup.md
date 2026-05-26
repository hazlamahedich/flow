# Playwright Setup for Phoenix / LiveView Projects

Session-tested patterns for scaffolding Playwright E2E on Phoenix 1.8+ with LiveView.

---

## macOS Resource Forks

macOS external/USB drives create `._` resource fork files alongside real files. Playwright's test file crawler crashes on them with `SyntaxError: Unexpected character '\u0000'`.

**Fix in `playwright.config.ts`:**
```typescript
export default defineConfig({
  testIgnore: "**/._*",
  // ... other config
});
```

Do not attempt `find … -delete` to remove them — destructive cleanup is often blocked by user policies or CI safety guards. Exclusion is the reliable, portable fix.

---

## Test Directory Placement

Phoenix 1.8 generates `assets/package.json` and `assets/tsconfig.json` for its built-in asset pipeline. Do NOT place the E2E suite inside `assets/`; Playwright needs its own dependency tree separate from the Phoenix asset build.

**Recommended layout:**
```
repo-root/
├── leadforge_ai/           # Phoenix app (or subdirectory)
│   ├── mix.exs
│   └── assets/
│       └── package.json    # Phoenix deps only
├── package.json            # E2E deps: @playwright/test, typescript, dotenv, @faker-js/faker
├── playwright.config.ts
├── tsconfig.json           # extends ./leadforge_ai/assets/tsconfig.json if desired
├── .env.example
└── tests/
    ├── e2e/
    └── support/
        ├── fixtures/
        ├── fixtures/factories/
        ├── helpers/
        └── page-objects/
```

If Phoenix is in a subdirectory, keep `package.json` and `playwright.config.ts` at the repo root so `tests/` resolves naturally.

---

## WebServer Auto-Start

Playwright can start the Phoenix server for you via the `webServer` block. This is critical for CI self-contained runs.

```typescript
export default defineConfig({
  testIgnore: "**/._*",
  webServer: {
    command: "cd leadforge_ai && mix phx.server",
    url: "http://localhost:4000",
    timeout: 120_000,          // Elixir compile + boot is slow on first run
    reuseExistingServer: !process.env.CI,
  },
});
```

If Phoenix lives in a subdirectory, the `command` must `cd` into it before `mix phx.server`. The `url` is what Playwright polls until the server is ready.

---

## TypeScript Configuration

Root `tsconfig.json` for the E2E suite should extend the Phoenix `assets/tsconfig.json` only if you want shared type roots; otherwise, define a standalone config.

```json
{
  "extends": "./leadforge_ai/assets/tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "types": ["@playwright/test"]
  },
  "include": ["tests/**/*", "playwright.config.ts"]
}
```

---

## LiveView Selector Strategy

Phoenix LiveView renders plain HTML without automatic `data-testid` on generated elements. Relying on `getByTestId` alone will fail on uninstrumented templates.

**Use adaptive `.or()` fallback chains:**
```typescript
const email = page.locator("input[type='email']")
  .or(page.getByLabel("Email"))
  .or(page.getByTestId("email-input"));

await email.fill("test@example.com");
```

This strategy works whether the page uses native HTML semantics, accessible labels, or explicit test IDs added later.

**Page title assertions:**
Phoenix auto-camelCases the app name. Assert against the actual rendered `<title>`, which defaults to `ModuleName · Phoenix Framework`:
```typescript
await expect(page).toHaveTitle(/LeadforgeAi/);
```
Do not assume a custom brand like `LeadForge` unless you have explicitly overridden the layout title.

---

## Environment Variables

Create `.env.example` at the repo root:
```ini
TEST_ENV=local
BASE_URL=http://localhost:4000
API_URL=http://localhost:4000/api
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=supersecret
```

Load it in `playwright.config.ts` and in `tests/support/global-setup.ts` via `dotenv`:
```typescript
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });
```

---

## Cross-Browser Strategy

Phoenix apps serve HTML — they are not framework-specific like React. Install all browsers to catch WebKit-specific rendering differences and ensure broad compatibility:
```bash
npx playwright install chromium firefox webkit
```

---

## Template Instrumentation Pitfalls (adding data-testid)

Adding `data-testid` attributes to Phoenix `.heex` templates is straightforward for raw HTML elements, but component calls (`<.input>`, `<.form>`, `<.button>`) can trigger editor-tool mismatch loops when multiple similar forms exist on the same page.

### Duplicate-match trap
The login page (`user_session_html/new.html.heex`) contains **two** forms with the same `action={~p"/users/log-in"}` and the same `<.input field={f[:email]} type="email" label="Email"/>` structure. A naive `patch` to add `data-testid` to the email input matches both forms, causing an ambiguous error.

**Symptom:** `Found 2 matches for old_string`

**Fix:**
1. Use context that is **unique per form**, e.g. include the preceding form `id="login_form_magic"` or `id="login_form_password"` in the old_string.
2. If tool-level escaping on `~p"/path"` causes drift (`Escape-drift detected`), fall back to a **Python script** (or `sed`/`awk`) applied via `terminal`, since those run line-by-line on the raw file bytes.

Example safe Python patch script:
```python
import re
content = open("new.html.heex").read()
# Match uniquely by form id, so only one form is touched
content = content.replace(
    'id="login_form_password" action={~p"/users/log-in"}',
    'id="login_form_password" action={~p"/users/log-in"} data-testid="password-login-form"',
    1  # <-- only first occurrence
)
open("new.html.heex", "w").write(content)
```

### CoreComponents attribute passthrough
Phoenix `CoreComponents` (`<.input>`, `<.button>`, `<.header>`) pass unknown attributes through to the underlying HTML element, but `<.form>` renders a wrapper `<form>` and the extra attribute lands there — which is usually fine for `data-testid`. For elements where the component already takes a `class`, drop `data-testid` next to it:

```heex
<.input field={f[:email]} type="email" label="Email" data-testid="register-email-input" />
```

For `<select>` inputs generated by `<.input type="select">`, the `data-testid` also lands on the wrapper, so use a stable `page.locator("select[name='workspace[plan]'")` or add a wrapper `<div data-testid="...">`.

---

## Page-Object Model Structure

A barrel-exported page-object keeps tests readable and resilient to layout changes.

**Directory:** `tests/support/page-objects/`

```typescript
// tests/support/page-objects/login-page.ts
import { Page, Locator, expect } from "@playwright/test";

export class LoginPage {
  readonly page: Page;
  readonly pageWrapper: Locator;
  readonly passwordForm: Locator;
  readonly passwordEmailInput: Locator;
  readonly passwordInput: Locator;
  readonly passwordSubmit: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageWrapper = page.getByTestId("login-page");
    this.passwordForm = page.getByTestId("password-login-form");
    this.passwordEmailInput = page.getByTestId("password-email-input");
    this.passwordInput = page.getByTestId("password-input");
    this.passwordSubmit = page.getByTestId("password-login-submit");
  }

  async goto() { await this.page.goto("/users/log-in"); }
  async expectLoaded() { await this.pageWrapper.waitFor({ state: "visible" }); }
  async loginViaPassword(email: string, password: string) {
    await this.passwordEmailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.passwordSubmit.click();
  }
}
```

```typescript
// tests/support/page-objects/index.ts
export { LoginPage } from "./login-page";
export { RegisterPage } from "./register-page";
export { HomePage } from "./home-page";
export { NewWorkspacePage } from "./workspace-page";
```

Tests consume them via the custom fixture or directly:
```typescript
test("user can log in", async ({ page }) => {
  const login = new LoginPage(page);
  await login.goto();
  await login.expectLoaded();
  await login.loginViaPassword("alice@example.com", "secret123");
  await expect(page).toHaveURL("/dashboard");
});
```

---

## Template Instrumentation Pitfalls (adding data-testid)

Adding `data-testid` attributes to Phoenix `.heex` templates is usually straightforward for raw HTML elements, but component calls (`<.input>`, `<.form>`, `<.button>`) can trigger tooling loops when multiple similar forms exist on the same page.

### Duplicate-match trap
The login page (`user_session_html/new.html.heex`) can contain **two** forms with the same `action={~p\"/users/log-in\"}` and the same `<.input field={f[:email]} type=\"email\" label=\"Email\"/>` structure. A naive `patch` to add `data-testid` to the email input matches both forms, causing an ambiguous `Found 2 matches for old_string` error.

**Fix:**
1. Use surrounding context that is **unique per form** (e.g., include the preceding form `id`) in `old_string` so the match is unique.
2. If tool-level escaping on `~p\"/path\"` causes `Escape-drift detected`, fall back to a **Python script** (or `sed`/`awk`) applied via `terminal`, since those run line-by-line on the raw file bytes.

Example safe Python patch script:
```python
content = open("new.html.heex").read()
# Uniquify by form id so only one form is touched
content = content.replace(
    'id="login_form_password" action={~p"/users/log-in"}',
    'id="login_form_password" action={~p"/users/log-in"} data-testid="password-login-form"',
    1  # <-- only first occurrence
)
open("new.html.heex", "w").write(content)
```

**CoreComponents attribute passthrough:**
Phoenix `<.input>`, `<.button>`, and `<.header>` pass unknown attributes through to the underlying HTML element. Place `data-testid` next to existing attributes. For `<.input type="select">`, the attribute lands on the wrapper div, so also use a stable `page.locator("select[name='workspace[plan]']")` or wrap the field in an explicit `<div data-testid="...">`.

---

## Debugging Failed Tests

When a Playwright test fails, it leaves rich artifacts under `test-results/<test-name>/`:
- `error-context.md` — human-readable error summary, locator resolution, and DOM snapshot
- `trace.zip` — time-travel trace you can inspect: `npx playwright show-trace test-results/.../trace.zip`

Check these first before re-running. The `error-context.md` often reveals a selector mismatch or a server 500 on the Phoenix side without needing to watch a video replay.

---

## `.env` File Creation

The shell `cp .env.example .env` may be blocked by safety tooling. If you need to create `.env` programmatically, write it directly with the `write_file` tool or instruct the user to copy it manually.

---

## Sample Homepage Test

```typescript
import { test, expect } from "@playwright/test";

test.describe("Homepage", () => {
  test("loads and shows the app title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/LeadforgeAi/);
  });
});
```

This is the minimal passing smoke test after scaffold. Grow it into authentication, workspace, and credit flows as features land.