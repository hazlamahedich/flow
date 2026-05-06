import type {
  EmailProvider,
  OAuthUrlParams,
  CodeExchangeResult,
  OAuthTokens,
  EmailHistoryItem,
  EmailMetadata,
  EmailMessage,
  WatchInboxResult,
} from '../email-provider.js';
import * as gmailOAuth from './gmail-oauth.js';
import * as gmailApi from './gmail-api.js';

export class GmailProvider implements EmailProvider {
  getOAuthUrl(params: OAuthUrlParams): string {
    return gmailOAuth.getOAuthUrl(params);
  }

  async exchangeCode(
    code: string,
    redirectUri: string,
    codeVerifier: string,
  ): Promise<CodeExchangeResult> {
    return gmailOAuth.exchangeCode(code, redirectUri, codeVerifier);
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokens> {
    return gmailOAuth.refreshToken(refreshToken);
  }

  async revokeToken(accessToken: string): Promise<void> {
    return gmailOAuth.revokeToken(accessToken);
  }

  async getUserEmail(accessToken: string): Promise<string> {
    return gmailOAuth.getUserEmail(accessToken);
  }

  async getHistorySince(accessToken: string, startHistoryId: string): Promise<EmailHistoryItem[]> {
    return gmailApi.getHistorySince(accessToken, startHistoryId);
  }

  async listMessages(
    accessToken: string,
    query: string,
    maxResults: number,
  ): Promise<EmailHistoryItem[]> {
    return gmailApi.listMessages(accessToken, query, maxResults);
  }

  async getMessageMetadata(accessToken: string, messageId: string): Promise<EmailMetadata> {
    return gmailApi.getMessageMetadata(accessToken, messageId);
  }

  async getMessage(accessToken: string, messageId: string): Promise<EmailMessage> {
    return gmailApi.getMessage(accessToken, messageId);
  }

  async getProfile(
    accessToken: string,
  ): Promise<{ emailAddress: string; historyId: string }> {
    return gmailApi.getProfile(accessToken);
  }

  async watchInbox(accessToken: string, topicName: string): Promise<WatchInboxResult> {
    return gmailApi.watchInbox(accessToken, topicName);
  }

  async stopWatch(accessToken: string): Promise<void> {
    return gmailApi.stopWatch(accessToken);
  }

  async verifyDelegation(delegatedEmail: string, accessToken: string): Promise<boolean> {
    return gmailApi.verifyDelegation(delegatedEmail, accessToken);
  }
}
