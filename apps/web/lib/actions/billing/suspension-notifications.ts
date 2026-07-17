/**
 * Story 9.5c AC5 — suspension notification email templates + best-effort
 * dispatch (FR57a).
 *
 * Two templates:
 *  - `buildMemberSuspendedEmail` — to the suspended member. Copy attributes
 *    cause to the workspace's plan change, never to the member or any
 *    algorithm. Strips all role/seniority-speak (that language is for audit
 *    logs, not humans — per AC5).
 *  - `buildOwnerSuspendedEmail` — to the workspace owner. Lists who was
 *    suspended and why, with two deep links ("Upgrade back to Agency" +
 *    "Manage team"). This is the owner's override window.
 *
 * Dispatch helpers (`sendMemberSuspendedNotification`,
 * `sendOwnerSuspendedNotification`) are **best-effort, never throw**: on
 * provider failure they log via `writeAuditLog` and return. AC5 explicitly
 * allows this ("If a notification service is unavailable, log + continue —
 * do not roll back the suspension"), matching the session-invalidation
 * contract (Murat P0-1).
 *
 * Templated on `apps/web/lib/actions/portal/client-notification-templates.ts`
 * (hand-written HTML strings — no @react-email in this repo).
 *
 * NOTE on `from` address (2026-07-17): the Resend provider hardcodes
 * `Flow OS <invoices@flow.app>` (resend-transactional-provider.ts:34) and does
 * not accept a per-send override. Member/owner suspension emails therefore
 * come from `invoices@flow.app` today. Mildly awkward but not wrong; refactoring
 * the provider is filed as tech-debt td-9-5c-02 (out of scope for this story).
 */
import type { TransactionalEmailPayload } from '@flow/agents/providers';
import { writeAuditLog } from '@flow/agents/shared/audit-writer';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build the member-suspended email payload. Plain copy, plan-change
 * attribution, no algorithm-speak (AC5).
 *
 * @example
 *   const payload = buildMemberSuspendedEmail({
 *     to: 'member@example.com',
 *     workspaceName: 'Acme VA',
 *     ownerEmail: 'owner@acme.com',
 *     suspendedAt: 'July 17, 2026',
 *   });
 */
export function buildMemberSuspendedEmail(args: {
  to: string;
  workspaceName: string;
  ownerEmail: string;
  suspendedAt: string;
}): TransactionalEmailPayload {
  const { to, workspaceName, ownerEmail, suspendedAt } = args;
  const subject = `Your access to ${workspaceName} was paused`;
  // Plain copy. "paused" (not "suspended" / "revoked") — human, not bureaucratic.
  // Attributes cause to the workspace's plan, never the member. Mentions
  // upgrade-back recourse explicitly (AC3 reactivation promise).
  const htmlBody = `<!DOCTYPE html><html><body>
<p>Hi,</p>
<p>Your access to <strong>${escapeHtml(workspaceName)}</strong> was paused on ${escapeHtml(suspendedAt)} because ${escapeHtml(workspaceName)} changed its plan to Pro.</p>
<p>Your work isn't deleted. If they upgrade back to Agency, you'll be re-added automatically.</p>
<p>Questions? Reply to this email or contact ${escapeHtml(ownerEmail)}.</p>
<p style="color:#6b7280;font-size:12px;margin-top:24px;">— The ${escapeHtml(workspaceName)} team</p>
</body></html>`;
  const textBody = `Hi,

Your access to ${workspaceName} was paused on ${suspendedAt} because ${workspaceName} changed its plan to Pro.

Your work isn't deleted. If they upgrade back to Agency, you'll be re-added automatically.

Questions? Reply to this email or contact ${ownerEmail}.

— The ${workspaceName} team`;
  return {
    to,
    subject,
    htmlBody,
    textBody,
    metadata: { reason: 'tier_downgrade_agency_to_pro' },
  };
}

/**
 * Build the owner-suspended email payload. Lists who was suspended and why,
 * with two deep links (AC5): "Upgrade back to Agency" + "Manage team".
 */
export function buildOwnerSuspendedEmail(args: {
  to: string;
  workspaceName: string;
  suspendedMembers: Array<{ email: string; name?: string }>;
  billingUrl: string;
  teamUrl: string;
}): TransactionalEmailPayload {
  const { to, workspaceName, suspendedMembers, billingUrl, teamUrl } = args;
  const count = suspendedMembers.length;
  const subject = `${count} team member${count === 1 ? '' : 's'} paused on ${workspaceName}`;
  const list = suspendedMembers
    .map((m) => `  • ${escapeHtml(m.name ?? m.email)}`)
    .join('\n');

  const htmlBody = `<!DOCTYPE html><html><body>
<p>Hi,</p>
<p>When <strong>${escapeHtml(workspaceName)}</strong> switched to Pro, we paused ${count} team member${count === 1 ? '' : 's'} to fit the Pro plan limit. Their work is preserved — nothing was deleted.</p>
<p><strong>Paused members:</strong></p>
<pre style="font-family:inherit;font-size:14px;">${list}</pre>
<p>You have two options:</p>
<p>
  <a href="${encodeURI(billingUrl)}" style="display:inline-block;padding:10px 16px;background:#0f172a;color:#fff;text-decoration:none;border-radius:4px;">Upgrade back to Agency</a>
  &nbsp; restores everyone automatically.
</p>
<p>
  Or <a href="${encodeURI(teamUrl)}">manage your team</a> to adjust who was paused.
</p>
<p style="color:#6b7280;font-size:12px;margin-top:24px;">— Flow OS</p>
</body></html>`;
  const textBody = `Hi,

When ${workspaceName} switched to Pro, we paused ${count} team member${count === 1 ? '' : 's'} to fit the Pro plan limit. Their work is preserved — nothing was deleted.

Paused members:
${suspendedMembers.map((m) => `  • ${m.name ?? m.email}`).join('\n')}

You have two options:
  • Upgrade back to Agency (restores everyone automatically): ${billingUrl}
  • Manage your team to adjust who was paused: ${teamUrl}

— Flow OS`;
  return {
    to,
    subject,
    htmlBody,
    textBody,
    metadata: {
      reason: 'tier_downgrade_agency_to_pro',
      suspended_count: String(count),
    },
  };
}

/**
 * Best-effort dispatch contract for suspension notifications. Returned by
 * the send helpers so the caller can record partial-failure observability
 * alongside the session-invalidation contract (EC6).
 */
export interface NotificationDispatchResult {
  /** 'sent' on provider success, 'failed' on any error (never throws). */
  status: 'sent' | 'failed';
  /** Provider messageId on success; error message on failure. */
  detail: string;
}

/**
 * Send the member-suspended email. Best-effort — never throws. On failure,
 * logs via `writeAuditLog` and returns `{ status: 'failed' }` so the caller
 * can record it without rolling back the suspension (AC5 / EC6 contract).
 *
 * Caller passes the already-resolved provider (resolved once per webhook
 * invocation, not per member) so a missing `RESEND_API_KEY` fails fast once
 * rather than once per suspended member.
 */
export async function sendMemberSuspendedNotification(args: {
  provider: { send: (p: TransactionalEmailPayload) => Promise<{ messageId: string }> };
  payload: TransactionalEmailPayload;
  workspaceId: string;
  memberUserId: string;
}): Promise<NotificationDispatchResult> {
  try {
    const result = await args.provider.send(args.payload);
    return { status: 'sent', detail: result.messageId };
  } catch (err) {
    writeAuditLog({
      workspaceId: args.workspaceId,
      agentId: 'stripe-webhook',
      action: 'notification.member_suspended_email_failed',
      entityType: 'user',
      entityId: args.memberUserId,
      details: {
        to: args.payload.to,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    return {
      status: 'failed',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Send the owner-suspended email. Same best-effort contract as the member
 * variant. The owner email is the floor (Sally's finding: the banner alone
 * assumes the owner logs in).
 */
export async function sendOwnerSuspendedNotification(args: {
  provider: { send: (p: TransactionalEmailPayload) => Promise<{ messageId: string }> };
  payload: TransactionalEmailPayload;
  workspaceId: string;
}): Promise<NotificationDispatchResult> {
  try {
    const result = await args.provider.send(args.payload);
    return { status: 'sent', detail: result.messageId };
  } catch (err) {
    writeAuditLog({
      workspaceId: args.workspaceId,
      agentId: 'stripe-webhook',
      action: 'notification.owner_suspended_email_failed',
      entityType: 'workspace',
      entityId: args.workspaceId,
      details: {
        to: args.payload.to,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    return {
      status: 'failed',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}
