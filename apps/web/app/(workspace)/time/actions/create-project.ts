'use server';

import type { ActionResult } from '@flow/types';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  requireTenantContext,
  createFlowError,
  createProject,
  ProjectNameDuplicateError,
} from '@flow/db';
// Schema and return type live in a sibling non-'use server' module because
// Next.js 15 forbids exporting non-function values from 'use server' files.
import { createProjectSchema } from './schemas';
import type { CreatedProject } from './schemas';

export async function createProjectAction(
  input: unknown,
): Promise<ActionResult<CreatedProject>> {
  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(
        400,
        'VALIDATION_ERROR',
        parsed.error.message,
        'validation',
      ),
    };
  }

  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  try {
    const project = await createProject(supabase, {
      workspaceId: ctx.workspaceId,
      clientId: parsed.data.clientId,
      name: parsed.data.name,
    });

    return {
      success: true,
      data: { id: project.id, name: project.name, clientId: project.clientId },
    };
  } catch (err) {
    if (err instanceof ProjectNameDuplicateError) {
      return {
        success: false,
        error: createFlowError(
          409,
          'CONFLICT',
          'A project with this name already exists',
          'validation',
        ),
      };
    }
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        'Failed to create project',
        'system',
      ),
    };
  }
}
