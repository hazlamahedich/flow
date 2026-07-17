/**
 * Schemas and types for the time-entry server actions.
 *
 * This file has NO `'use server'` directive on purpose. Next.js 15 forbids
 * a `'use server'` file from exporting anything other than async functions,
 * so Zod schemas (runtime objects) and interfaces must live in a sibling
 * module that the action files import from.
 *
 * Mirrors the pattern in apps/web/app/(workspace)/agents/approvals/actions/schemas.ts.
 */
import { z } from 'zod';

// ─── create-project ────────────────────────────────────────────────
export const createProjectSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1).max(100),
});

export interface CreatedProject {
  id: string;
  name: string;
  clientId: string;
}

// ─── list-workspace-members ────────────────────────────────────────
export interface WorkspaceMemberSummary {
  userId: string;
  displayName: string;
}

// ─── create-time-entry ─────────────────────────────────────────────
function getTodayStr(): string {
  const t = new Date();
  const month = String(t.getMonth() + 1).padStart(2, '0');
  const day = String(t.getDate()).padStart(2, '0');
  return `${t.getFullYear()}-${month}-${day}`;
}

function dateNotFuture(d: string): boolean {
  return d <= getTodayStr();
}

interface CreateTimeEntryShape {
  startMinutes?: number | undefined;
  endMinutes?: number | undefined;
  durationMinutes: number;
}

function startEndConsistent(d: CreateTimeEntryShape): boolean {
  return (d.startMinutes != null) === (d.endMinutes != null);
}

function startBeforeEnd(d: CreateTimeEntryShape): boolean {
  if (d.startMinutes != null && d.endMinutes != null) {
    return d.startMinutes < d.endMinutes;
  }
  return true;
}

function noMidnightSpan(d: CreateTimeEntryShape): boolean {
  if (d.startMinutes != null && d.endMinutes != null) {
    return d.startMinutes + d.durationMinutes <= 1440;
  }
  return true;
}

export const createTimeEntrySchema = z
  .object({
    clientId: z.string().uuid(),
    projectId: z.string().uuid().nullable(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(dateNotFuture, 'Date cannot be in the future'),
    durationMinutes: z.number().int().min(1).max(1440),
    startMinutes: z.number().int().min(0).max(1439).optional(),
    endMinutes: z.number().int().min(0).max(1439).optional(),
    notes: z.string().max(500).optional(),
  })
  .refine(startEndConsistent, {
    message: 'Both start and end times are required together.',
  })
  .refine(startBeforeEnd, { message: 'End time must be after start time.' })
  .refine(noMidnightSpan, {
    message:
      'Entry spans midnight. Split into two entries for each calendar day.',
  });

// ─── update-time-entry ─────────────────────────────────────────────
function stringToUuidOrNull(v: unknown): string | null | undefined {
  if (v === '' || v === null || v === undefined) return null;
  return v as string | null | undefined;
}

interface UpdateTimeEntryShape {
  startMinutes?: number | null | undefined;
  endMinutes?: number | null | undefined;
  durationMinutes: number;
}

function updateStartEndConsistent(d: UpdateTimeEntryShape): boolean {
  const startProvided = d.startMinutes !== undefined;
  const endProvided = d.endMinutes !== undefined;
  if (!startProvided && !endProvided) return true;
  if (startProvided !== endProvided) return false;
  return (d.startMinutes != null) === (d.endMinutes != null);
}

function updateStartBeforeEnd(d: UpdateTimeEntryShape): boolean {
  if (d.startMinutes != null && d.endMinutes != null) {
    return d.startMinutes < d.endMinutes;
  }
  return true;
}

function updateNoMidnightSpan(d: UpdateTimeEntryShape): boolean {
  if (d.startMinutes != null && d.endMinutes != null) {
    return d.startMinutes + d.durationMinutes <= 1440;
  }
  return true;
}

export const updateTimeEntrySchema = z
  .object({
    id: z.string().uuid(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(dateNotFuture, 'Date cannot be in the future'),
    durationMinutes: z.number().int().min(1).max(1440),
    startMinutes: z.number().int().min(0).max(1439).nullable().optional(),
    endMinutes: z.number().int().min(0).max(1439).nullable().optional(),
    clientId: z.preprocess(stringToUuidOrNull, z.string().uuid().nullable()),
    projectId: z.preprocess(stringToUuidOrNull, z.string().uuid().nullable()),
    notes: z.string().max(500).nullable(),
    invoicedAcknowledged: z.boolean().optional(),
  })
  .refine(updateStartEndConsistent, {
    message: 'Both start and end times are required together.',
  })
  .refine(updateStartBeforeEnd, {
    message: 'End time must be after start time.',
  })
  .refine(updateNoMidnightSpan, {
    message:
      'Entry spans midnight. Split into two entries for each calendar day.',
  });
