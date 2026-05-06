import { OAuth2Client } from 'google-auth-library';

export async function verifyGoogleOidcToken(
  token: string,
  expectedAudience: string,
): Promise<boolean> {
  try {
    const client = new OAuth2Client();
    await client.verifyIdToken({
      idToken: token,
      audience: expectedAudience,
    });
    return true;
  } catch {
    return false;
  }
}
