'use server';

import { getWeeklyReportByIdAction as _getWeeklyReportByIdAction } from '@/lib/actions/reports/get-weekly-report-by-id';
import { regenerateWeeklyReportAction as _regenerateWeeklyReportAction } from '@/lib/actions/reports/regenerate-weekly-report';
import { getReportVersionsAction as _getReportVersionsAction } from '@/lib/actions/reports/get-report-versions';

export async function getWeeklyReportByIdAction(
  input: Parameters<typeof _getWeeklyReportByIdAction>[0],
) {
  return _getWeeklyReportByIdAction(input);
}

export async function regenerateWeeklyReportAction(
  input: Parameters<typeof _regenerateWeeklyReportAction>[0],
) {
  return _regenerateWeeklyReportAction(input);
}

export async function getReportVersionsAction(
  input: Parameters<typeof _getReportVersionsAction>[0],
) {
  return _getReportVersionsAction(input);
}
