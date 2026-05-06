import type { OAuthTokens, OAuthStateEncrypted } from '@flow/types';

export interface OAuthUrlParams {
  redirectUri: string;
  state: string;
  codeChallenge: string;
  accessType: 'direct' | 'delegated';
}

export interface CodeExchangeResult {
  tokens: OAuthTokens;
  emailAddress: string;
}

export interface WatchInboxResult {
  historyId: string;
  expiration: string;
}

export interface EmailHistoryItem {
  messageId: string;
  threadId: string;
}

export interface EmailMessageHeader {
  name: string;
  value: string;
}

export interface EmailMetadata {
  gmailMessageId: string;
  gmailThreadId: string;
  subject: string | null;
  fromAddress: string;
  fromName: string | null;
  toAddresses: Array<{ name: string | null; address: string }>;
  ccAddresses: Array<{ name: string | null; address: string }>;
  receivedAt: string;
  headers: EmailMessageHeader[];
}

export interface EmailMessage extends EmailMetadata {
  bodyHtml: string | null;
  bodyText: string | null;
}

export interface EmailProvider {
  getOAuthUrl(params: OAuthUrlParams): string;
  exchangeCode(code: string, redirectUri: string, codeVerifier: string): Promise<CodeExchangeResult>;
  refreshToken(refreshToken: string): Promise<OAuthTokens>;
  revokeToken(accessToken: string): Promise<void>;
  getUserEmail(accessToken: string): Promise<string>;
  getHistorySince(accessToken: string, startHistoryId: string): Promise<EmailHistoryItem[]>;
  listMessages(accessToken: string, query: string, maxResults: number): Promise<EmailHistoryItem[]>;
  getMessageMetadata(accessToken: string, messageId: string): Promise<EmailMetadata>;
  getMessage(accessToken: string, messageId: string): Promise<EmailMessage>;
  getProfile(accessToken: string): Promise<{ emailAddress: string; historyId: string }>;
  watchInbox(accessToken: string, topicName: string): Promise<WatchInboxResult>;
  stopWatch(accessToken: string): Promise<void>;
  verifyDelegation(delegatedEmail: string, accessToken: string): Promise<boolean>;
}

export type { OAuthTokens, OAuthStateEncrypted };
