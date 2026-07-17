/**
 * Server Actions barrel for the portal feature.
 */
'use server';

import { generatePortalLinkAction as _generatePortalLinkAction } from './generate-link';
import { validatePortalTokenAction as _validatePortalTokenAction } from './validate-token';
import { revokePortalTokenAction as _revokePortalTokenAction } from './revoke-token';
import { getPortalPath as _getPortalPath } from './portal-paths';
import { getFallbackPortalPath as _getFallbackPortalPath } from './portal-paths';
import { validatePortalSessionWithDb as _validatePortalSessionWithDb } from './validate-session-db';
import { validatePortalSlug as _validatePortalSlug } from './portal-session';
import { getPortalInvoices as _getPortalInvoices } from './get-portal-invoices';
import { getPortalInvoiceDetail as _getPortalInvoiceDetail } from './get-portal-invoice-detail';
import { payInvoicePortalAction as _payInvoicePortalAction } from './pay-invoice';
import { approveReportAction as _approveReportAction } from './approve-report';
import { requestReportChangesAction as _requestReportChangesAction } from './request-report-changes';
import { sendClientNotificationAction as _sendClientNotificationAction } from './client-notification';
import { sendClientNotificationServerAction as _sendClientNotificationServerAction } from './client-notification-server';

export async function generatePortalLinkAction(
  input: Parameters<typeof _generatePortalLinkAction>[0],
) {
  return _generatePortalLinkAction(input);
}

export async function validatePortalTokenAction(
  input: Parameters<typeof _validatePortalTokenAction>[0],
) {
  return _validatePortalTokenAction(input);
}

export async function revokePortalTokenAction(
  input: Parameters<typeof _revokePortalTokenAction>[0],
) {
  return _revokePortalTokenAction(input);
}

export async function getPortalPath(
  slug: Parameters<typeof _getPortalPath>[0],
) {
  return _getPortalPath(slug);
}

export async function getFallbackPortalPath() {
  return _getFallbackPortalPath();
}

export async function validatePortalSessionWithDb(
  ..._args: Parameters<typeof _validatePortalSessionWithDb>
) {
  return _validatePortalSessionWithDb(..._args);
}

export async function validatePortalSlug(
  input: Parameters<typeof _validatePortalSlug>[0],
) {
  return _validatePortalSlug(input);
}

export async function getPortalInvoices(
  input: Parameters<typeof _getPortalInvoices>[0],
) {
  return _getPortalInvoices(input);
}

export async function getPortalInvoiceDetail(
  portalCtx: Parameters<typeof _getPortalInvoiceDetail>[0],
  invoiceId: Parameters<typeof _getPortalInvoiceDetail>[1],
) {
  return _getPortalInvoiceDetail(portalCtx, invoiceId);
}

export async function payInvoicePortalAction(
  portalCtx: Parameters<typeof _payInvoicePortalAction>[0],
  input: Parameters<typeof _payInvoicePortalAction>[1],
) {
  return _payInvoicePortalAction(portalCtx, input);
}

export async function approveReportAction(
  portalCtx: Parameters<typeof _approveReportAction>[0],
  input: Parameters<typeof _approveReportAction>[1],
) {
  return _approveReportAction(portalCtx, input);
}

export async function requestReportChangesAction(
  portalCtx: Parameters<typeof _requestReportChangesAction>[0],
  input: Parameters<typeof _requestReportChangesAction>[1],
) {
  return _requestReportChangesAction(portalCtx, input);
}

export async function sendClientNotificationAction(
  portalCtx: Parameters<typeof _sendClientNotificationAction>[0],
  input: Parameters<typeof _sendClientNotificationAction>[1],
) {
  return _sendClientNotificationAction(portalCtx, input);
}

export async function sendClientNotificationServerAction(
  input: Parameters<typeof _sendClientNotificationServerAction>[0],
) {
  return _sendClientNotificationServerAction(input);
}
