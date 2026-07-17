/**
 * Story 9.5c AC5 — suspension notification dispatch (FR57a).
 *
 * Sibling to `suspension-notifications.ts` (the template builders). This
 * module owns the **side-effectful** half: resolving the email provider,
 * sending per-member + owner-summary emails, and reporting partial-failure
 * observably. Split from the templates so each file has one responsibility
 * and stays under the 250-line limit (review I1).
 *
 * Best-effort contract (AC5): the dispatcher never throws. On any failure —
 * provider unavailable, individual send rejected, unexpected error — it
 * logs via `writeAuditLog` and returns the failure count. The suspension DB
 * writes are NOT rolled back; the caller folds the count into the EC6
 * `warnings: ['session_invalidation_partial']` contract.
 *
 * Templated on `apps/web/lib/actions/portal/client-notification-templates.ts`
 * (hand-written HTML strings — no @react-email in this repo).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TransactionalEmailPayload } from '@flow/agents/providers';
import { writeAuditLog } from '@flow/agents/shared/audit-writer';
import {
  buildMemberSuspendedEmail,
  buildOwnerSuspendedEmail,
} from './suspension-notifications';

/**
 * Best-effort dispatch contract for a single notification send. Returned by
 * the per-recipient helpers so the caller can record partial-failure
 * observability alongside the session-invalidation contract (EC6).
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
  provider: {
    send: (p: TransactionalEmailPayload) => Promise<{ messageId: string }>;
  };
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
  provider: {
    send: (p: TransactionalEmailPayload) => Promise<{ messageId: string }>;
  };
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

/**
 * A suspended member prepared for notification — the per-member context the
 * dispatcher needs to build + send the member email, and to include the
 * member in the owner's summary list. Produced by the webhook handler while
 * it is already looping over suspended IDs for session invalidation.
 */
export interface SuspendedMemberForNotification {
  userId: string;
  memberId: string;
  email: string;
  name: string | null;
  suspendedAt: string;
}

/**
 * Dispatch the AC5 suspension notifications for a single Agency→Pro
 * downgrade: one email per suspended member + one summary email to the owner.
 *
 * Extracted from `applyAgencyToProDowngrade` so the handler stays under the
 * 250-line file limit and the notification concern is testable in isolation.
 *
 * Best-effort contract (AC5): never throws. On any failure — provider
 * unavailable, individual send rejected, unexpected error — the dispatcher
 * logs via `writeAuditLog` and returns the failure count so the caller can
 * surface partial-failure observability alongside the session-invalidation
 * contract (EC6). The suspension DB writes are NOT rolled back.
 *
 * @returns the number of notification sends that failed (0 = all sent or
 *   all-skipped-due-to-missing-provider; the caller treats `> 0` as the
 *   signal to set `warnings: ['session_invalidation_partial']`).
 */
export async function dispatchSuspensionNotifications(args: {
  supabase: SupabaseClient;
  workspaceId: string;
  suspendedMembers: SuspendedMemberForNotification[];
}): Promise<{ failed: number }> {
  let failed = 0;
  try {
    // Workspace name + owner email for the templates.
    const { data: wsRow } = await args.supabase
      .from('workspaces')
      .select('name, slug')
      .eq('id', args.workspaceId)
      .maybeSingle();
    const workspaceName =
      (wsRow as { name?: string } | null)?.name ?? 'your workspace';
    const { data: ownerRow } = await args.supabase
      .from('workspace_members')
      .select('users(email)')
      .eq('workspace_id', args.workspaceId)
      .eq('role', 'owner')
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    const ownerEmail =
      (ownerRow as { users?: { email?: string } | null } | null)?.users
        ?.email ?? '';

    // Resolve the transactional email provider once. If RESEND_API_KEY is
    // unset the registry throws — treat as a best-effort skip (the whole
    // notification dispatch is non-blocking per AC5).
    let provider: {
      send: (p: TransactionalEmailPayload) => Promise<{ messageId: string }>;
    } | null = null;
    try {
      const { getTransactionalEmailProvider } = await import(
        '@flow/agents/providers'
      );
      const resolved = getTransactionalEmailProvider('resend');
      provider = { send: (p) => resolved.send(p) };
    } catch {
      // Provider unavailable (e.g. missing API key in this env). Skip
      // notification dispatch — AC5 explicitly allows log + continue.
      provider = null;
    }

    if (provider && ownerEmail) {
      // Member emails (parallel — independent best-effort sends).
      const memberResults = await Promise.all(
        args.suspendedMembers.map((m) =>
          sendMemberSuspendedNotification({
            provider,
            payload: buildMemberSuspendedEmail({
              to: m.email,
              workspaceName,
              ownerEmail,
              suspendedAt: new Date(m.suspendedAt).toLocaleDateString(),
            }),
            workspaceId: args.workspaceId,
            memberUserId: m.userId,
          }),
        ),
      );
      failed += memberResults.filter((r) => r.status === 'failed').length;

      // Owner email (one summary, with two deep links per AC5).
      const appOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN ?? '';
      // Build the suspended-members list for the owner email. Omit `name`
      // when null (exactOptionalPropertyTypes: the optional key must be
      // absent, not present-and-undefined).
      const ownerList = args.suspendedMembers.map((m) =>
        m.name ? { email: m.email, name: m.name } : { email: m.email },
      );
      const ownerResult = await sendOwnerSuspendedNotification({
        provider,
        payload: buildOwnerSuspendedEmail({
          to: ownerEmail,
          workspaceName,
          suspendedMembers: ownerList,
          billingUrl: `${appOrigin}/settings/billing`,
          teamUrl: `${appOrigin}/settings/team`,
        }),
        workspaceId: args.workspaceId,
      });
      if (ownerResult.status === 'failed') failed += 1;
    }
  } catch {
    // Notification dispatch is entirely best-effort. Any uncaught error
    // here does NOT roll back the suspension (AC5). Count as a failure for
    // observability but do not throw.
    failed += 1;
  }
  return { failed };
}
