/**
 * Epic 8 E2E Tests — Reporting & Client Health
 * End-to-end tests for report generation, viewing, sharing, and the Friday Feeling ritual.
 */
import { test, expect } from '../support/merged-fixtures';
import type { Page } from '@playwright/test';

test.describe('[P0] Epic 8 — Reporting & Client Health', () => {
  test.beforeEach(async ({ ownerPage }) => {
    await ownerPage.goto('/reports');
  });

  // ───────────────────────────────────────────────────────────────
  // E2E-001: Reports list page loads
  // ───────────────────────────────────────────────────────────────
  test('[8.1-E2E-001] reports list page loads with heading and generate button', async ({ ownerPage }) => {
    await expect(ownerPage).not.toHaveURL(/\/login/);
    await expect(
      ownerPage.getByRole('heading', { name: /reports/i }),
    ).toBeVisible();
    await expect(
      ownerPage.getByRole('link', { name: /generate report/i }),
    ).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────
  // E2E-002: Generate report form
  // ───────────────────────────────────────────────────────────────
  test('[8.1-E2E-002] generate report form has client picker and date range', async ({ ownerPage }) => {
    await expect(ownerPage).not.toHaveURL(/\/login/);
    const generateBtn = ownerPage.getByRole('link', { name: /generate report/i });
    if (!(await generateBtn.isVisible())) {
      test.skip(true, 'Generate report button not visible');
    }
    await generateBtn.click();
    await expect(ownerPage.getByRole('heading', { name: /generate weekly report/i })).toBeVisible();
    await expect(ownerPage.getByTestId('client-picker')).toBeVisible();
    await expect(ownerPage.getByTestId('period-start-date')).toBeVisible();
    await expect(ownerPage.getByTestId('period-end-date')).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────
  // E2E-003: Report detail page shows sections
  // ───────────────────────────────────────────────────────────────
  test('[8.1-E2E-003] report detail page shows time summary, task log, and agent activity sections', async ({ ownerPage }) => {
    await expect(ownerPage).not.toHaveURL(/\/login/);
    const firstReportLink = ownerPage.locator('a[href*="/reports/"]').first();
    if (!(await firstReportLink.isVisible())) {
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
  // ───────────────────────────────────────────────────────────────
  test('[8.1-E2E-004] report template settings shows section toggles and branding options', async ({ ownerPage }) => {
    await ownerPage.goto('/reports/templates');
    await expect(ownerPage).not.toHaveURL(/\/login/);
    await expect(ownerPage.getByRole('heading', { name: /report templates/i })).toBeVisible();
    await expect(ownerPage.getByTestId('template-section-toggle')).toBeVisible();
    await expect(ownerPage.getByTestId('template-branding-color')).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────
  // E2E-005: Agent action log page
  // ───────────────────────────────────────────────────────────────
  test('[8.2-E2E-001] agent action log page shows chronological agent runs', async ({ ownerPage }) => {
    await ownerPage.goto('/reports/agent-log');
    await expect(ownerPage).not.toHaveURL(/\/login/);
    await expect(ownerPage.getByRole('heading', { name: /agent action log/i })).toBeVisible();
    const logTable = ownerPage.getByRole('table');
    const emptyState = ownerPage.getByText(/no agent actions yet/i);
    await expect(logTable.or(emptyState)).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────
  // E2E-006: Usage analytics dashboard
  // ───────────────────────────────────────────────────────────────
  test('[8.3-E2E-001] analytics dashboard shows completion rate, approval rate, and trust distribution', async ({ ownerPage }) => {
    await ownerPage.goto('/analytics');
    await expect(ownerPage).not.toHaveURL(/\/login/);
    await expect(ownerPage.getByRole('heading', { name: /usage analytics/i })).toBeVisible();
    await expect(ownerPage.getByTestId('metric-completion-rate')).toBeVisible();
    await expect(ownerPage.getByTestId('metric-approval-rate')).toBeVisible();
    await expect(ownerPage.getByTestId('trust-distribution-chart')).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────
  // E2E-007: Client health card on client detail page
  // ───────────────────────────────────────────────────────────────
  test('[8.3-E2E-002] client detail page shows health indicator card', async ({ ownerPage }) => {
    await ownerPage.goto('/clients');
    await expect(ownerPage).not.toHaveURL(/\/login/);
    const firstClientLink = ownerPage.locator('a[href*="/clients/"]').first();
    if (!(await firstClientLink.isVisible())) {
      test.skip(true, 'No clients in seeded data');
    }
    await firstClientLink.click();
    await expect(ownerPage.getByTestId('client-health-card')).toBeVisible();
    await expect(ownerPage.getByTestId('health-indicator-overall')).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────
  // E2E-008: Friday Feeling appears in inbox
  // ───────────────────────────────────────────────────────────────
  test('[8.4-E2E-001] friday feeling summary appears in orchestrated workflow inbox', async ({ ownerPage }) => {
    await ownerPage.goto('/inbox');
    await expect(ownerPage).not.toHaveURL(/\/login/);
    const ffItem = ownerPage.getByTestId('inbox-item-friday-feeling');
    const emptyState = ownerPage.getByText(/no new items/i);
    await expect(ffItem.or(emptyState)).toBeVisible();
  });

  // ───────────────────────────────────────────────────────────────
  // E2E-009: The Exhale screen
  // ───────────────────────────────────────────────────────────────
  test('[8.4-E2E-002] the exhale screen shows impact stories when activated', async ({ ownerPage }) => {
    await ownerPage.goto('/friday-feeling');
    await expect(ownerPage).not.toHaveURL(/\/login/);
    await expect(ownerPage.getByRole('heading', { name: /the exhale/i })).toBeVisible();
    await expect(ownerPage.getByTestId('exhale-impact-stories')).toBeVisible();
    await expect(ownerPage.getByTestId('exhale-tasks-count')).toBeVisible();
    await expect(ownerPage.getByTestId('exhale-time-saved')).toBeVisible();
  });
});
