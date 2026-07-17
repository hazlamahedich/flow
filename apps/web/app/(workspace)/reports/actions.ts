'use server';

import { generateWeeklyReportAction as _generateWeeklyReportAction } from '@/lib/actions/reports/generate-weekly-report';
import { getWeeklyReportsAction as _getWeeklyReportsAction } from '@/lib/actions/reports/get-weekly-reports';
import { getWeeklyReportByIdAction as _getWeeklyReportByIdAction } from '@/lib/actions/reports/get-weekly-report-by-id';
import { saveReportTemplateAction as _saveReportTemplateAction } from '@/lib/actions/reports/save-report-template';
import { deleteReportTemplateAction as _deleteReportTemplateAction } from '@/lib/actions/reports/delete-report-template';
import { getReportTemplatesForWorkspaceAction as _getReportTemplatesForWorkspaceAction } from '@/lib/actions/reports/get-report-templates';

export async function generateWeeklyReportAction(
  input: Parameters<typeof _generateWeeklyReportAction>[0],
) {
  return _generateWeeklyReportAction(input);
}

export async function getWeeklyReportsAction(
  page: Parameters<typeof _getWeeklyReportsAction>[0],
  clientId?: Parameters<typeof _getWeeklyReportsAction>[1],
) {
  return _getWeeklyReportsAction(page, clientId);
}

export async function getWeeklyReportByIdAction(
  input: Parameters<typeof _getWeeklyReportByIdAction>[0],
) {
  return _getWeeklyReportByIdAction(input);
}

export async function saveReportTemplateAction(
  input: Parameters<typeof _saveReportTemplateAction>[0],
) {
  return _saveReportTemplateAction(input);
}

export async function deleteReportTemplateAction(
  input: Parameters<typeof _deleteReportTemplateAction>[0],
) {
  return _deleteReportTemplateAction(input);
}

export async function getReportTemplatesForWorkspaceAction(
  ..._args: Parameters<typeof _getReportTemplatesForWorkspaceAction>
) {
  return _getReportTemplatesForWorkspaceAction(..._args);
}
