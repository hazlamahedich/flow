import { formatCentsToDollar } from '@flow/shared';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export interface EmailPayloadArgs {
  to: string;
  invoiceNumber: string;
  totalCents: number;
  currency: string;
  clientName: string;
  paymentUrl: string;
  workspaceName: string;
  metadata: Record<string, string>;
}

export function buildSendInvoiceEmailPayload(args: EmailPayloadArgs) {
  const totalDollars = formatCentsToDollar(args.totalCents);
  return {
    to: args.to,
    subject: `Invoice ${args.invoiceNumber} from ${args.workspaceName}`,
    htmlBody: `<!DOCTYPE html>
<html><body>
  <p>Dear ${escapeHtml(args.clientName)},</p>
  <p>Here is your invoice <strong>${escapeHtml(args.invoiceNumber)}</strong> for ${args.currency.toUpperCase()} ${totalDollars}.</p>
  <p><a href="${encodeURI(args.paymentUrl)}" style="display:inline-block;padding:10px 16px;background:#0f172a;color:#fff;text-decoration:none;border-radius:4px;">Pay Invoice</a></p>
  <p style="color:#666;font-size:12px;">If the button doesn't work, copy this link: ${encodeURI(args.paymentUrl)}</p>
</body></html>`,
    textBody: `Dear ${args.clientName},\n\nHere is your invoice ${args.invoiceNumber} for ${args.currency.toUpperCase()} ${totalDollars}.\n\nPay here: ${args.paymentUrl}\n\n- Flow OS`,
    metadata: args.metadata,
  };
}

export function plainLanguageError(stripeError?: boolean, resendError?: boolean): string {
  if (stripeError) return "We couldn't connect to the payment processor — please try again.";
  if (resendError) return "We couldn't send the email — check the client's email address.";
  return 'Something went wrong — please copy the payment link and send it manually.';
}
