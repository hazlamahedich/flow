import { z } from 'zod';

export const inboxAccessTypeEnum = z.enum(['direct', 'delegated', 'service_account']);
export type InboxAccessType = z.infer<typeof inboxAccessTypeEnum>;

export const syncStatusEnum = z.enum(['connected', 'syncing', 'error', 'disconnected']);
export type SyncStatus = z.infer<typeof syncStatusEnum>;

export const oauthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiryDate: z.number(),
  scope: z.string(),
  tokenType: z.string().default('Bearer'),
});
export type OAuthTokens = z.infer<typeof oauthTokensSchema>;

export const oauthStateEncryptedSchema = z.object({
  encrypted: z.string(),
  iv: z.string(),
  version: z.number().default(1),
});
export type OAuthStateEncrypted = z.infer<typeof oauthStateEncryptedSchema>;

export const oauthStateCookieSchema = z.object({
  state: z.string(),
  codeVerifier: z.string(),
  clientId: z.string(),
  accessType: inboxAccessTypeEnum,
  workspaceId: z.string().uuid(),
  returnTo: z.string(),
});
export type OAuthStateCookie = z.infer<typeof oauthStateCookieSchema>;

export const connectInboxInputSchema = z.object({
  clientId: z.string().uuid(),
  accessType: z.enum(['direct', 'delegated']),
  returnTo: z.string().optional(),
});
export type ConnectInboxInput = z.infer<typeof connectInboxInputSchema>;

export const clientInboxSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  clientId: z.string().uuid(),
  provider: z.string(),
  emailAddress: z.string(),
  accessType: inboxAccessTypeEnum,
  syncStatus: syncStatusEnum,
  syncCursor: z.string().nullable(),
  errorMessage: z.string().nullable(),
  lastSyncAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ClientInbox = z.infer<typeof clientInboxSchema>;

export const inboxStatusResponseSchema = z.object({
  inbox: clientInboxSchema.nullable(),
});
export type InboxStatusResponse = z.infer<typeof inboxStatusResponseSchema>;

export const gmailPubSubMessageSchema = z.object({
  emailAddress: z.string().email(),
  historyId: z.string(),
});
export type GmailPubSubMessage = z.infer<typeof gmailPubSubMessageSchema>;
