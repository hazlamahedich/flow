/**
 * Client notification email templates.
 *
 * HTML + text body builders for invoice_created, payment_confirmed,
 * and report_shared events.
 *
 * Story 9.2 — AC5 (FR82).
 */
import { formatCentsToDollar } from '@flow/shared';
import type { TransactionalEmailPayload } from '@flow/agents/providers';

export type ClientNotificationType =
  | 'invoice_created'
  | 'payment_confirmed'
  | 'report_shared';

export interface ClientNotificationPayload {
  invoiceId?: string | undefined;
  reportId?: string | undefined;
  amountCents?: number | undefined;
  currency?: string | undefined;
  invoiceNumber?: string | undefined;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildClientNotificationEmail(args: {
  to: string;
  clientName: string;
  workspaceName: string;
  type: ClientNotificationType;
  payload: ClientNotificationPayload;
  portalUrl?: string;
}): TransactionalEmailPayload {
  const { to, clientName, workspaceName, type, payload } = args;
  const meta: Record<string, string> = {};
  if (payload.invoiceId) meta.invoice_id = payload.invoiceId;
  if (payload.reportId) meta.report_id = payload.reportId;

  let subject: string;
  let htmlBody: string;
  let textBody: string;

  switch (type) {
    case 'invoice_created': {
      const amount = payload.amountCents
        ? formatCentsToDollar(payload.amountCents)
        : '';
      const invNum = payload.invoiceNumber ?? '';
      subject = `New invoice ${invNum} from ${workspaceName}`;
      const payLink = args.portalUrl ?? '';
      htmlBody = `<!DOCTYPE html><html><body>
<p>Dear ${escapeHtml(clientName)},</p>
<p>You have a new invoice <strong>${escapeHtml(invNum)}</strong>${amount ? ` for ${escapeHtml(amount)}` : ''}.</p>
${payLink ? `<p><a href="${encodeURI(payLink)}" style="display:inline-block;padding:10px 16px;background:#0f172a;color:#fff;text-decoration:none;border-radius:4px;">View &amp; Pay</a></p>` : ''}
</body></html>`;
      textBody = `Dear ${clientName},\n\nYou have a new invoice ${invNum}${amount ? ` for ${amount}` : ''}.\n${payLink ? `View it here: ${payLink}\n` : ''}\n- ${workspaceName}`;
      break;
    }
    case 'payment_confirmed': {
      const amount = payload.amountCents
        ? formatCentsToDollar(payload.amountCents)
        : '';
      const invNum = payload.invoiceNumber ?? '';
      subject = `Payment confirmed for ${invNum}`;
      htmlBody = `<!DOCTYPE html><html><body>
<p>Dear ${escapeHtml(clientName)},</p>
<p>We've received your payment${amount ? ` of <strong>${escapeHtml(amount)}</strong>` : ''} for invoice ${escapeHtml(invNum)}. Thank you!</p>
</body></html>`;
      textBody = `Dear ${clientName},\n\nWe've received your payment${amount ? ` of ${amount}` : ''} for invoice ${invNum}. Thank you!\n\n- ${workspaceName}`;
      break;
    }
    case 'report_shared': {
      subject = `Your weekly report from ${workspaceName} is ready`;
      const reportUrl = args.portalUrl ?? '';
      htmlBody = `<!DOCTYPE html><html><body>
<p>Dear ${escapeHtml(clientName)},</p>
<p>Your weekly report is ready for review.</p>
${reportUrl ? `<p><a href="${encodeURI(reportUrl)}" style="display:inline-block;padding:10px 16px;background:#0f172a;color:#fff;text-decoration:none;border-radius:4px;">View Report</a></p>` : ''}
</body></html>`;
      textBody = `Dear ${clientName},\n\nYour weekly report is ready for review.\n${reportUrl ? `View it here: ${reportUrl}\n` : ''}\n- ${workspaceName}`;
      break;
    }
  }

  return { to, subject, htmlBody, textBody, metadata: meta };
}
