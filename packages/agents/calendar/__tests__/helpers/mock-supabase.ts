import { vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

type MockFn = ReturnType<typeof vi.fn>;

interface TableConfig {
  select?: {
    data: unknown;
    error?: unknown;
    chainMethods?: Record<string, MockFn>;
    terminalMethod?: string;
  };
  insert?: {
    data?: unknown;
    error?: unknown;
    capture?: (data: unknown) => void;
  };
  update?: {
    data?: unknown;
    error?: unknown;
    capture?: (data: unknown) => void;
  };
  upsert?: {
    data?: unknown;
    error?: unknown;
  };
  delete?: {
    data?: unknown;
    error?: unknown;
  };
}

interface CapturedOps {
  _capturedInserts: Array<{ table: string; data: unknown }>;
  _capturedUpdates: Array<{ table: string; data: unknown; filters: Record<string, unknown> }>;
}

export type MockSupabaseClient = SupabaseClient & CapturedOps;

function buildChain(finalResult: { data: unknown; error: unknown }, terminalMethod = 'maybeSingle') {
  const chain: Record<string, MockFn> = {};
  const methods = [
    'select', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is', 'ilike',
    'or', 'order', 'limit', 'then', 'maybeSingle', 'single',
  ];

  for (const method of methods) {
    chain[method] = vi.fn().mockImplementation(() => chain);
  }

  chain[terminalMethod] = vi.fn().mockResolvedValue(finalResult);
  return chain;
}

export class MockSupabaseBuilder {
  private tables: Map<string, TableConfig> = new Map();
  private capturedInserts: Array<{ table: string; data: unknown }> = [];
  private capturedUpdates: Array<{ table: string; data: unknown; filters: Record<string, unknown> }> = [];

  withTable(name: string, config: TableConfig): this {
    this.tables.set(name, config);
    return this;
  }

  withSchedulingRequests(opts: {
    data?: Record<string, unknown> | null;
    error?: unknown;
    insertError?: { code?: string; message: string } | null;
    existingRequest?: boolean;
    dedupData?: Record<string, unknown> | null;
    captureInsert?: (data: unknown) => void;
  } = {}): this {
    const requestData = opts.data;
    const requestError = opts.error ?? null;
    let capturedData: Record<string, unknown> | null = null;

    this.tables.set('scheduling_requests', {
      select: {
        data: requestData,
        error: requestError,
      },
      insert: {
        data: null,
        error: opts.insertError ?? null,
        capture: (data: unknown) => {
          capturedData = data as Record<string, unknown>;
          opts.captureInsert?.(data);
        },
      },
      update: {
        capture: () => {},
      },
    });

    const config = this.tables.get('scheduling_requests')!;
    (config as Record<string, unknown>)._schedulingOpts = {
      ...opts,
      getCapturedData: () => capturedData,
    };

    return this;
  }

  withClientCalendars(opts: {
    data?: Record<string, unknown>[];
    error?: unknown;
  } = {}): this {
    this.tables.set('client_calendars', {
      select: {
        data: opts.data ?? [{
          id: '00000000-0000-4000-8000-000000000003',
          client_id: '00000000-0000-4000-8000-000000000002',
          calendar_id: 'cal-1',
          provider: 'google_calendar',
          oauth_state: {},
          sync_status: 'connected',
        }],
        error: opts.error,
      },
    });
    return this;
  }

  withCalendarEvents(opts: {
    data?: Record<string, unknown>[];
    error?: unknown;
    insertData?: Record<string, unknown> | null;
    insertError?: string | null;
    captureInsert?: (data: unknown) => void;
  } = {}): this {
    const insertConfig: TableConfig['insert'] = {
      data: opts.insertData ?? { id: 'event-1' },
    };
    if (opts.insertError) insertConfig.error = { message: opts.insertError };
    if (opts.captureInsert) insertConfig.capture = opts.captureInsert;

    this.tables.set('calendar_events', {
      select: {
        data: opts.data ?? [],
        error: opts.error,
      },
      insert: insertConfig,
    });
    return this;
  }

  withAgentSignals(opts: {
    data?: Array<{ id: string }>;
    error?: unknown;
    insertError?: string | null;
  } = {}): this {
    this.tables.set('agent_signals', {
      select: {
        data: opts.data ?? [],
        error: opts.error,
      },
      insert: {
        error: opts.insertError ? { message: opts.insertError } : null,
      },
      update: {
        capture: () => {},
      },
    });
    return this;
  }

  withClients(opts: {
    data?: Record<string, unknown>[];
    error?: unknown;
  } = {}): this {
    this.tables.set('clients', {
      select: {
        data: opts.data ?? [{ id: '00000000-0000-4000-8000-000000000002' }],
        error: opts.error,
      },
    });
    return this;
  }

  withWorkspaces(opts: {
    data?: Record<string, unknown>;
    error?: unknown;
  } = {}): this {
    this.tables.set('workspaces', {
      select: {
        data: opts.data ?? { timezone: 'UTC' },
        error: opts.error,
        terminalMethod: 'single',
      },
    });
    return this;
  }

  withBypassMetrics(opts: {
    data?: Record<string, unknown> | null;
    error?: unknown;
    updatedData?: Record<string, unknown>;
  } = {}): this {
    this.tables.set('calendar_bypass_metrics', {
      select: {
        data: opts.data,
        error: opts.error,
      },
      update: {
        data: opts.updatedData,
      },
      upsert: {
        error: null,
      },
    });
    return this;
  }

  withEventRelations(opts: {
    data?: Record<string, unknown>[];
    error?: unknown;
  } = {}): this {
    this.tables.set('calendar_event_relations', {
      select: {
        data: opts.data ?? [],
        error: opts.error,
      },
      upsert: {
        error: null,
      },
    });
    return this;
  }

  build(): MockSupabaseClient {
    const self = this;

    const from = vi.fn().mockImplementation((table: string) => {
      const config = self.tables.get(table);
      if (!config) {
        return {
          select: vi.fn().mockReturnThis(),
          insert: vi.fn().mockResolvedValue({ error: null }),
          update: vi.fn().mockReturnThis(),
        };
      }

      if (table === 'scheduling_requests') {
        return self.buildSchedulingRequestsHandler(config);
      }

      const handlers: Record<string, unknown> = {};

      if (config.select) {
        const terminalMethod = config.select.terminalMethod ?? 'maybeSingle';
        handlers.select = vi.fn().mockReturnValue(buildChain(
          { data: config.select.data, error: config.select.error ?? null },
          terminalMethod,
        ));
      }

      if (config.insert) {
        const insertCfg = config.insert;
        handlers.insert = vi.fn().mockImplementation((data: unknown) => {
          self.capturedInserts.push({ table, data });
          insertCfg.capture?.(data);

          if (insertCfg.error) {
            return {
              select: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: insertCfg.error,
                }),
              }),
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: insertCfg.data ?? { id: 'inserted-1' },
                error: null,
              }),
            }),
          };
        });
      }

      if (config.update) {
        handlers.update = vi.fn().mockImplementation((data: unknown) => {
          self.capturedUpdates.push({ table, data, filters: {} });
          config.update?.capture?.(data);
          const updateChain: Record<string, MockFn> = {};
          updateChain.eq = vi.fn().mockImplementation(() => updateChain);
          updateChain.select = vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: config.update?.data ?? null,
              error: null,
            }),
          });
          updateChain.maybeSingle = vi.fn().mockResolvedValue({
            data: config.update?.data ?? null,
            error: null,
          });
          return updateChain;
        });
      }

      if (config.upsert) {
        handlers.upsert = vi.fn().mockImplementation((data: unknown) => {
          self.capturedInserts.push({ table, data });
          if (config.upsert!.error) {
            return Promise.resolve({ error: config.upsert!.error });
          }
          return {
            select: vi.fn().mockResolvedValue({
              data: config.upsert!.data ?? [data],
              error: null,
            }),
          };
        });
      }

      if (config.delete) {
        handlers.delete = vi.fn().mockReturnValue(buildChain({
          data: config.delete.data,
          error: config.delete.error ?? null,
        }));
      }

      return handlers;
    });

    return {
      from,
      _capturedInserts: this.capturedInserts,
      _capturedUpdates: this.capturedUpdates,
    } as unknown as MockSupabaseClient;
  }

  private buildSchedulingRequestsHandler(config: TableConfig): Record<string, unknown> {
    const opts = (config as Record<string, unknown>)._schedulingOpts as {
      data?: Record<string, unknown> | null;
      error?: unknown;
      insertError?: { code?: string; message: string } | null;
      existingRequest?: boolean;
      dedupData?: Record<string, unknown> | null;
      getCapturedData: () => Record<string, unknown> | null;
    } | undefined;

    const requestData = config.select?.data ?? opts?.data ?? null;
    const requestError = config.select?.error ?? opts?.error ?? null;

    const selectChain: Record<string, MockFn> = {};
    selectChain.eq = vi.fn().mockImplementation(() => selectChain);
    selectChain.is = vi.fn().mockImplementation(() => selectChain);
    selectChain.maybeSingle = vi.fn().mockResolvedValue({
      data: requestData,
      error: requestError,
    });

    const dedupChain: Record<string, MockFn> = {};
    dedupChain.eq = vi.fn().mockImplementation(() => dedupChain);
    dedupChain.is = vi.fn().mockImplementation(() => dedupChain);
    dedupChain.maybeSingle = vi.fn().mockResolvedValue({
      data: opts?.existingRequest ? { id: 'existing' } : (opts?.dedupData ?? null),
      error: null,
    });

    const updateChain: Record<string, MockFn> = {};
    updateChain.eq = vi.fn().mockImplementation(() => updateChain);

    return {
      select: vi.fn().mockImplementation((fields?: string) => {
        if (fields === 'id') return dedupChain;
        return selectChain;
      }),
      update: vi.fn().mockImplementation((data: unknown) => {
        this.capturedUpdates.push({ table: 'scheduling_requests', data, filters: {} });
        return updateChain;
      }),
      insert: vi.fn().mockImplementation((data: unknown) => {
        this.capturedInserts.push({ table: 'scheduling_requests', data });
        const insertChain: Record<string, MockFn> = {};
        insertChain.select = vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: opts?.insertError ? null : {
              id: 'new-req-id',
              ...(data as Record<string, unknown>),
              status: 'pending',
              created_at: new Date().toISOString(),
            },
            error: opts?.insertError ?? null,
          }),
        });
        return insertChain;
      }),
    };
  }
}

export function createMockSupabaseBuilder(): MockSupabaseBuilder {
  return new MockSupabaseBuilder();
}
