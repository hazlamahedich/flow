import { createFlowError } from '@flow/db';
import { createServiceClient } from '@flow/db/client';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function invalidateUserSessions(userId: string): Promise<void> {
  if (!UUID_REGEX.test(userId)) {
    throw createFlowError(
      400,
      'VALIDATION_ERROR',
      'Invalid user ID format',
      'validation',
    );
  }

  const supabase = createServiceClient();
  const { error } = await supabase.auth.admin.signOut(userId);

  if (error) {
    throw createFlowError(
      500,
      'INTERNAL_ERROR',
      'Failed to invalidate user sessions',
      'system',
      { originalError: error.message },
    );
  }
}
