import { createServiceClient } from './client';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(value: string, label: string): void {
  if (!UUID_REGEX.test(value)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
}

export async function setActiveWorkspace(
  userId: string,
  workspaceId: string,
): Promise<void> {
  assertUuid(userId, 'userId');
  assertUuid(workspaceId, 'workspaceId');

  const client = createServiceClient();

  const { data: existing, error: fetchErr } =
    await client.auth.admin.getUserById(userId);
  if (fetchErr || !existing) {
    throw new Error(
      `Failed to fetch user for workspace switch: ${fetchErr?.message}`,
    );
  }

  const { error } = await client.auth.admin.updateUserById(userId, {
    app_metadata: {
      ...existing.user.app_metadata,
      workspace_id: workspaceId,
    },
  });

  if (error) {
    throw new Error(`Failed to set active workspace: ${error.message}`);
  }
}
