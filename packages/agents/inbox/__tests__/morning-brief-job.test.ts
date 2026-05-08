import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@flow/db', () => ({
  createServiceClient: vi.fn(),
}));

vi.mock('../index', () => ({
  generateMorningBrief: vi.fn(),
}));

import { handleMorningBriefScheduledJob } from '../jobs/morning-brief';
import { createServiceClient } from '@flow/db';
import { generateMorningBrief } from '../index';

describe('handleMorningBriefScheduledJob', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
    };
    (createServiceClient as any).mockReturnValue(mockSupabase);
  });

  it('returns early when no workspaces exist', async () => {
    mockSupabase.select.mockResolvedValueOnce({ data: [], error: null });

    await handleMorningBriefScheduledJob();

    expect(generateMorningBrief).not.toHaveBeenCalled();
  });

  it('returns early when data is null', async () => {
    mockSupabase.select.mockResolvedValueOnce({ data: null, error: null });

    await handleMorningBriefScheduledJob();

    expect(generateMorningBrief).not.toHaveBeenCalled();
  });

  it('throws when workspace enumeration fails', async () => {
    mockSupabase.select.mockResolvedValueOnce({
      data: null,
      error: new Error('DB down'),
    });

    await expect(handleMorningBriefScheduledJob()).rejects.toThrow('DB down');
  });

  it('generates briefs for all workspaces', async () => {
    mockSupabase.select.mockResolvedValueOnce({
      data: [{ id: 'ws-1' }, { id: 'ws-2' }],
      error: null,
    });
    (generateMorningBrief as any).mockResolvedValue({ id: 'brief-1' });

    await handleMorningBriefScheduledJob();

    expect(generateMorningBrief).toHaveBeenCalledTimes(2);
    expect(generateMorningBrief).toHaveBeenCalledWith('ws-1');
    expect(generateMorningBrief).toHaveBeenCalledWith('ws-2');
  });

  it('continues when one workspace fails', async () => {
    mockSupabase.select.mockResolvedValueOnce({
      data: [{ id: 'ws-1' }, { id: 'ws-2' }],
      error: null,
    });
    (generateMorningBrief as any)
      .mockRejectedValueOnce(new Error('Timeout for workspace ws-1'))
      .mockResolvedValueOnce({ id: 'brief-2' });

    await handleMorningBriefScheduledJob();

    expect(generateMorningBrief).toHaveBeenCalledTimes(2);
  });

  it('times out workspaces that exceed 30s', async () => {
    mockSupabase.select.mockResolvedValueOnce({
      data: [{ id: 'ws-slow' }],
      error: null,
    });

    let resolveBrief: () => void;
    const briefPromise = new Promise((resolve) => { resolveBrief = resolve; });
    (generateMorningBrief as any).mockReturnValue(briefPromise);

    const jobPromise = handleMorningBriefScheduledJob();

    await new Promise((r) => setTimeout(r, 100));

    resolveBrief!();
    await jobPromise;

    expect(generateMorningBrief).toHaveBeenCalledWith('ws-slow');
  });
});
