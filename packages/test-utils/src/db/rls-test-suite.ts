import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { isSupabaseAvailable, requireEnv } from './supabase-env';
import { createTestTenant } from './tenant-factory';
import type { TenantConfig } from './tenant-factory';

type RLSOperationSpec = {
  actor: string;
  ownTenant: boolean;
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
};

export type RLSTableSpec = {
  table: string;
  tenantColumn?: string;
  sampleInsert?: Record<string, unknown>;
  operations: RLSOperationSpec[];
};

async function signInAs(email: string) {
  const client = createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  );
  const { error } = await client.auth.signInWithPassword({
    email,
    password: 'test-password-12345',
  });
  if (error) throw error;
  return client;
}

export function generateRLSTestSuite(
  tableName: string,
  specs: RLSTableSpec,
): void {
  describe.skipIf(!isSupabaseAvailable())(`RLS: ${tableName}`, () => {
    const col = specs.tenantColumn ?? 'workspace_id';
    const uniqueRoles = [...new Set(specs.operations.map((op) => op.actor))];
    let result: Awaited<ReturnType<typeof createTestTenant>>;
    let otherId: string;

    beforeAll(async () => {
      result = await createTestTenant({
        roles: uniqueRoles as TenantConfig['roles'],
      });

      const svc = createClient(
        requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
        requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
        { auth: { autoRefreshToken: false, persistSession: false } },
      );

      otherId = crypto.randomUUID();
      const { error } = await svc.from('workspaces').insert({
        id: otherId,
        name: `other-${otherId.slice(0, 8)}`,
        settings: {},
      });
      if (error) throw error;

      if (specs.sampleInsert) {
        await svc
          .from(specs.table)
          .insert({ ...specs.sampleInsert, [col]: result.tenantId });
        await svc
          .from(specs.table)
          .insert({ ...specs.sampleInsert, [col]: otherId });
      }
    });

    afterAll(async () => {
      const svc = createClient(
        requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
        requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
        { auth: { autoRefreshToken: false, persistSession: false } },
      );
      await svc.from('workspaces').delete().eq('id', otherId);
      await result.cleanup();
    });

    for (const op of specs.operations) {
      const label = op.ownTenant ? 'own' : 'other';
      const targetId = () => (op.ownTenant ? result.tenantId : otherId);

      it(`${op.actor}@${label}: read → ${op.canRead ? 'allowed' : 'denied'}`, async () => {
        const user = result.users[op.actor];
        if (!user) throw new Error(`No user for actor "${op.actor}"`);
        const client = await signInAs(user.email);
        const { data } = await client
          .from(specs.table)
          .select('id')
          .eq(col, targetId())
          .limit(1);
        if (op.canRead) {
          expect(Array.isArray(data)).toBe(true);
        } else {
          expect(data?.length ?? 0).toBe(0);
        }
      });

      if (specs.sampleInsert) {
        it(`${op.actor}@${label}: write → ${op.canWrite ? 'allowed' : 'denied'}`, async () => {
          const user = result.users[op.actor];
          if (!user) throw new Error(`No user for actor "${op.actor}"`);
          const client = await signInAs(user.email);
          const { error } = await client
            .from(specs.table)
            .insert({ ...specs.sampleInsert, [col]: targetId() });
          if (op.canWrite) {
            expect(error).toBeNull();
          } else {
            expect(error).toBeDefined();
          }
        });

        it(`${op.actor}@${label}: delete → ${op.canDelete ? 'allowed' : 'denied'}`, async () => {
          const user = result.users[op.actor];
          if (!user) throw new Error(`No user for actor "${op.actor}"`);

          const svc = createClient(
            requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
            requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
            { auth: { autoRefreshToken: false, persistSession: false } },
          );
          const { data: row } = await svc
            .from(specs.table)
            .insert({ ...specs.sampleInsert, [col]: targetId() })
            .select('id')
            .single();

          const client = await signInAs(user.email);
          const { error } = await client
            .from(specs.table)
            .delete()
            .eq('id', row?.id);
          if (op.canDelete) {
            expect(error).toBeNull();
          } else {
            expect(error).toBeDefined();
          }
        });
      }
    }
  });
}
