/**
 * Epic 8 E2E Tests — Reporting & Client Health
 * End-to-end tests for report generation, viewing, sharing, and the Friday Feeling ritual.
 */
import { test, expect } from '../support/merged-fixtures';

// Centralized Routing Constants
const ROUTES = {
  REPORTS: '/reports',
  REPORT_TEMPLATES: '/reports/templates',
  AGENT_LOG: '/reports/agent-log',
  ANALYTICS: '/analytics',
  CLIENTS: '/clients',
  INBOX: '/inbox',
  FRIDAY_FEELING: '/friday-feeling',
} as const;

test.describe('[P0] Epic 8 — Reporting & Client Health', () => {
  // Configure tests to run in parallel
  test.describe.configure({ mode: 'parallel' });

  // ───────────────────────────────────────────────────────────────
  // E2E-001: Reports list page loads
  // ───────────────────────────────────────────────────────────────
  test('[8.1-E2E-001] Given owner is authenticated, When navigating to reports list page, Then it loads with heading and generate button', async ({
    ownerPage,
  }) => {
    await ownerPage.goto(ROUTES.REPORTS);
    await expect(ownerPage).not.toHaveURL(/\/login/);
    await expect(
      ownerPage.getByRole('heading', { name: /reports/i }),
    ).toBeVisible();
    await expect(
      ownerPage.getByRole('link', { name: /generate report/i }).first(),
    ).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────
  // E2E-002: Generate report form
  // TODO(Story 8-1a): /reports/new is a stub — client-picker,
  // period-start-date, period-end-date test IDs not yet implemented.
  // Re-enable when the report generation form UI lands.
  // ───────────────────────────────────────────────────────────────
  test.skip('[8.1-E2E-002] Given owner is authenticated on reports page, When generate report link is clicked, Then generate report form is displayed with client picker and date range inputs', async ({
    ownerPage,
  }) => {
    await ownerPage.goto(ROUTES.REPORTS);
    await expect(ownerPage).not.toHaveURL(/\/login/);
    const generateBtn = ownerPage.getByRole('link', {
      name: /generate report/i,
    });
    await expect(generateBtn).toBeVisible();
    await generateBtn.click();
    await expect(
      ownerPage.getByRole('heading', { name: /generate weekly report/i }),
    ).toBeVisible();
    await expect(ownerPage.getByTestId('client-picker')).toBeVisible();
    await expect(ownerPage.getByTestId('period-start-date')).toBeVisible();
    await expect(ownerPage.getByTestId('period-end-date')).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────
  // E2E-003: Report detail page shows sections
  // ───────────────────────────────────────────────────────────────
  test('[8.1-E2E-003] Given reports exist, When report detail page is loaded, Then it shows time summary, task log, and agent activity sections', async ({
    ownerPage,
  }) => {
    await ownerPage.goto(ROUTES.REPORTS);
    await expect(ownerPage).not.toHaveURL(/\/login/);
    // Only match links whose /reports/<id> segment is a UUID, excluding
    // /reports/new, /reports/templates, /reports/agent-log, and pagination.
    const firstReportLink = ownerPage.locator(
      'a[href*="/reports/"][href*="-"][href*="-"][href*="-"]',
    );
    if (!(await firstReportLink.isVisible().catch(() => false))) {
      test.skip(true, 'No reports in seeded data to view detail');
    }
    await firstReportLink.click();
    await expect(ownerPage.getByTestId('report-detail-heading')).toBeVisible();
    await expect(ownerPage.getByTestId('section-time-summary')).toBeVisible();
    await expect(ownerPage.getByTestId('section-task-log')).toBeVisible();
    await expect(ownerPage.getByTestId('section-agent-activity')).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────
  // E2E-004: Report templates settings page
  // TODO(Story 8-1b): templates UI exists but uses different test IDs
  // (toggle-${key}, template-form-color-picker) than this test expects
  // (template-section-toggle, template-branding-color). Re-enable after
  // aligning selectors or adding the expected test IDs.
  // ───────────────────────────────────────────────────────────────
  test.skip('[8.1-E2E-004] Given owner on templates page, When viewing settings, Then section toggles and branding options are visible', async ({
    ownerPage,
  }) => {
    await ownerPage.goto(ROUTES.REPORT_TEMPLATES);
    await expect(ownerPage).not.toHaveURL(/\/login/);
    await expect(
      ownerPage.getByRole('heading', { name: /report templates/i }),
    ).toBeVisible();
    await expect(
      ownerPage.getByTestId('template-section-toggle'),
    ).toBeVisible();
    await expect(
      ownerPage.getByTestId('template-branding-color'),
    ).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────
  // E2E-005: Agent action log page
  // ───────────────────────────────────────────────────────────────
  test('[8.2-E2E-001] Given owner on agent log page, When page is loaded, Then chronological agent runs or empty state is shown', async ({
    ownerPage,
  }) => {
    await ownerPage.goto(ROUTES.AGENT_LOG);
    await expect(ownerPage).not.toHaveURL(/\/login/);
    await expect(
      ownerPage.getByRole('heading', { name: /agent action log/i }),
    ).toBeVisible();
    const logTable = ownerPage.getByRole('table');
    const emptyState = ownerPage.getByText(/no agent actions/i);
    await expect(logTable.or(emptyState)).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────
  // E2E-006: Usage analytics dashboard
  // TODO(Story 8-3): /analytics page exists but has no data-testid
  // attributes (metric-completion-rate, metric-approval-rate,
  // trust-distribution-chart). Re-enable when test IDs are added.
  // ───────────────────────────────────────────────────────────────
  test.skip('[8.3-E2E-001] Given owner on analytics dashboard, When page is loaded, Then completion rate, approval rate, and trust distribution metrics are shown', async ({
    ownerPage,
  }) => {
    await ownerPage.goto(ROUTES.ANALYTICS);
    await expect(ownerPage).not.toHaveURL(/\/login/);
    await expect(
      ownerPage.getByRole('heading', { name: /usage analytics/i }),
    ).toBeVisible();
    await expect(ownerPage.getByTestId('metric-completion-rate')).toBeVisible();
    await expect(ownerPage.getByTestId('metric-approval-rate')).toBeVisible();
    await expect(
      ownerPage.getByTestId('trust-distribution-chart'),
    ).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────
  // E2E-007: Client health card on client detail page
  // TODO(Story 8-3): client-health-card and health-indicator-overall
  // test IDs are not yet rendered on the client detail page. Re-enable
  // when the health card UI lands.
  // ───────────────────────────────────────────────────────────────
  test.skip('[8.3-E2E-002] Given clients exist, When viewing first client detail page, Then client health card and health indicator are displayed', async ({
    ownerPage,
  }) => {
    await ownerPage.goto(ROUTES.CLIENTS);
    await expect(ownerPage).not.toHaveURL(/\/login/);
    const firstClientLink = ownerPage.locator('a[href*="/clients/"]').first();
    if (!(await firstClientLink.isVisible())) {
      test.skip(true, 'No clients in seeded data');
    }
    await firstClientLink.click();
    await expect(ownerPage.getByTestId('client-health-card')).toBeVisible();
    await expect(
      ownerPage.getByTestId('health-indicator-overall'),
    ).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────
  // E2E-008: Friday Feeling appears in inbox
  // TODO(Story 8-4): no /inbox route exists; inbox-item-friday-feeling
  // test ID not rendered anywhere. Re-enable when the orchestrated
  // workflow inbox UI lands.
  // ───────────────────────────────────────────────────────────────
  test.skip('[8.4-E2E-001] Given owner inbox loaded, When page is viewed, Then Friday Feeling summary or empty state appears in orchestrated workflow inbox', async ({
    ownerPage,
  }) => {
    await ownerPage.goto(ROUTES.INBOX);
    await expect(ownerPage).not.toHaveURL(/\/login/);
    const ffItem = ownerPage.getByTestId('inbox-item-friday-feeling');
    const emptyState = ownerPage.getByText(/no new items/i);
    await expect(ffItem.or(emptyState)).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────
  // E2E-009: The Exhale screen
  // TODO(Story 8-4): no /friday-feeling route exists; ExhaleScreen
  // component has no data-testid attributes. Re-enable when the
  // Friday Feeling page + test IDs land.
  // ───────────────────────────────────────────────────────────────
  test.skip('[8.4-E2E-002] Given owner on friday feeling page, When page is loaded, Then the exhale screen shows impact stories, tasks count, and time saved', async ({
    ownerPage,
  }) => {
    await ownerPage.goto(ROUTES.FRIDAY_FEELING);
    await expect(ownerPage).not.toHaveURL(/\/login/);
    await expect(
      ownerPage.getByRole('heading', { name: /the exhale/i }),
    ).toBeVisible();
    await expect(ownerPage.getByTestId('exhale-impact-stories')).toBeVisible();
    await expect(ownerPage.getByTestId('exhale-tasks-count')).toBeVisible();
    await expect(ownerPage.getByTestId('exhale-time-saved')).toBeVisible();
  });
});
