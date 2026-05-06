import { google } from 'googleapis';
import { CodeChallengeMethod } from 'google-auth-library';
import type {
  OAuthUrlParams,
  CodeExchangeResult,
  OAuthTokens,
} from '../email-provider.js';

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
];

function createOAuth2Client(redirectUri: string): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw Object.assign(new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required'), {
      code: 'OAUTH_CONFIG_ERROR' as const,
      statusCode: 500,
    });
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getOAuthUrl(params: OAuthUrlParams): string {
  const client = createOAuth2Client(params.redirectUri);
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GMAIL_SCOPES,
    state: params.state,
    code_challenge_method: CodeChallengeMethod.S256,
    code_challenge: params.codeChallenge,
  });
}

export async function exchangeCode(
  code: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<CodeExchangeResult> {
  const client = createOAuth2Client(redirectUri);
  const { tokens } = await client.getToken({ code, codeVerifier });
  if (!tokens.access_token || !tokens.refresh_token) {
    throw Object.assign(new Error('Token exchange did not return required tokens'), {
      code: 'OAUTH_TOKEN_EXCHANGE_FAILED' as const,
      statusCode: 502,
    });
  }

  const oauthTokens: OAuthTokens = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiryDate: tokens.expiry_date ?? Date.now() + 3600 * 1000,
    scope: tokens.scope ?? GMAIL_SCOPES.join(' '),
    tokenType: tokens.token_type ?? 'Bearer',
  };

  const emailAddress = await getUserEmail(tokens.access_token);

  return { tokens: oauthTokens, emailAddress };
}

export async function refreshToken(refreshToken: string): Promise<OAuthTokens> {
  const client = createOAuth2Client('');
  client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await client.refreshAccessToken();
  if (!credentials.access_token) {
    throw Object.assign(new Error('Token refresh did not return access token'), {
      code: 'OAUTH_TOKEN_EXCHANGE_FAILED' as const,
      statusCode: 502,
    });
  }
  return {
    accessToken: credentials.access_token,
    refreshToken: credentials.refresh_token ?? refreshToken,
    expiryDate: credentials.expiry_date ?? Date.now() + 3600 * 1000,
    scope: credentials.scope ?? GMAIL_SCOPES.join(' '),
    tokenType: credentials.token_type ?? 'Bearer',
  };
}

export async function revokeToken(accessToken: string): Promise<void> {
  const client = createOAuth2Client('');
  await client.revokeToken(accessToken);
}

export async function getUserEmail(accessToken: string): Promise<string> {
  const oauth2 = google.oauth2({ version: 'v2', auth: accessToken });
  const { data } = await oauth2.userinfo.get();
  if (!data.email) {
    throw Object.assign(new Error('Google userinfo did not return email'), {
      code: 'OAUTH_TOKEN_EXCHANGE_FAILED' as const,
      statusCode: 502,
    });
  }
  return data.email;
}
