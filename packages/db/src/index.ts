export { createServerClient, createBrowserClient, createServiceClient } from './client';
export { createAdminSupabase } from './admin-client';
export {
  requireTenantContext,
  setTenantContext,
  createFlowError,
} from './rls-helpers';
export type { TenantContext } from './rls-helpers';
export { setActiveWorkspace } from './workspace-jwt';
export {
  getRevalidationTags,
  invalidateAfterMutation,
  cacheTag,
} from './cache-policy';
export type { CacheEntity, CacheMutation } from './cache-policy';
export { getConfig } from './config';
export * from './schema';
export {
  ensureUserProfile,
  getUserProfile,
  updateUserProfile,
  updateAvatarUrl,
  requestEmailChangeAtomic,
  syncUserEmail,
} from './queries/users';
export { getDashboardSummary } from './queries/dashboard';
export type { DashboardSummary } from './queries/dashboard';
export { listUserWorkspaces } from './queries/workspaces';
export type { UserWorkspace } from './queries/workspaces';
