/**
 * Story 9.5a — Webhook handler tests for `handleSubscriptionDeleted` (AC5).
 *
 * Verifies:
 *   - `customer.subscription.deleted` transitions to `suspended` (NOT `cancelled`)
 *     via the `transition_to_suspended_any` RPC (FR59 + spike §6.1).
 *   - Duplicate webhook delivery is idempotent — `PRECONDITION_FAILED` is
 *     treated as `processed: true` (project-context.md:494).
 *   - Missing subscription id / workspace lookup failures return `processed: false`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { handleSubscriptionDeleted } from '../subscription-updated';
import type { WebhookEvent } from '../../webhook-types';

function buildClient(rpcImpl: ReturnType<typeof vi.fn>): SupabaseClient {
  const from = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { id: 'ws-123' },
      error: null,
    }),
  });
  return {
    from,
    rpc: rpcImpl,
  } as unknown as SupabaseClient;
}

function buildDeletedEvent(overrides?: Partial<{
  subscriptionId: string;
  customerId: string;
  workspaceId: string;
}>): WebhookEvent {
  const { subscriptionId = 'sub_abc', customerId = 'cus_123', workspaceId } = overrides ?? {};
  return {
    id: 'evt_test',
    type: 'customer.subscription.deleted',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: subscriptionId,
        customer: customerId,
        ...(workspaceId ? { metadata: { workspace_id: workspaceId } } : {}),
      },
    },
  };
}

describe('handleSubscriptionDeleted (Story 9.5a AC5)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('transitions to suspended via transition_to_suspended_any RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { success: true }, error: null });
    const client = buildClient(rpc);

    const result = await handleSubscriptionDeleted(client, buildDeletedEvent());

    expect(result.processed).toBe(true);
    expect(rpc).toHaveBeenCalledWith('transition_to_suspended_any', {
      p_workspace_id: 'ws-123',
    });
  });

  it('does NOT call set_workspace_subscription_status with cancelled', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { success: true }, error: null });
    const client = buildClient(rpc);

    await handleSubscriptionDeleted(client, buildDeletedEvent());

    const cancelledCalls = rpc.mock.calls.filter(
      ([fn]) => fn === 'set_workspace_subscription_status',
    );
    expect(cancelledCalls).toHaveLength(0);
  });

  it('treats PRECONDITION_FAILED (duplicate webhook) as processed:true', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { error: 'PRECONDITION_FAILED' },
      error: null,
    });
    const client = buildClient(rpc);

    const result = await handleSubscriptionDeleted(client, buildDeletedEvent());

    // Idempotent — already suspended/deleted, so this is a no-op success.
    expect(result.processed).toBe(true);
  });

  it('returns processed:false when RPC returns an error', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'rpc failed' },
    });
    const client = buildClient(rpc);

    const result = await handleSubscriptionDeleted(client, buildDeletedEvent());

    expect(result.processed).toBe(false);
    expect(result.reason).toBe('rpc failed');
  });

  it('returns processed:false when subscription id is missing', async () => {
    const rpc = vi.fn();
    const client = buildClient(rpc);

    const result = await handleSubscriptionDeleted(client, {
      id: 'evt_test',
      type: 'customer.subscription.deleted',
      created: Math.floor(Date.now() / 1000),
      data: { object: { customer: 'cus_123' } },
    });

    expect(result.processed).toBe(false);
    expect(result.reason).toContain('subscription id');
    expect(rpc).not.toHaveBeenCalled();
  });
});
