import { SignJWT } from 'jose';
import { requireEnv } from './supabase-env';

export interface TestJWTCustomClaims {
  sub?: string;
  email?: string;
  workspace_id?: string;
  role?: string;
  [key: string]: unknown;
}

export async function createTestJWT(
  claims: TestJWTCustomClaims,
): Promise<string> {
  const secret = requireEnv('SUPABASE_JWT_SECRET');
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const secretBytes = new TextEncoder().encode(secret);

  const userId = claims.sub ?? crypto.randomUUID();
  const userEmail =
    claims.email ?? `test-${userId.slice(0, 8)}@test.flow.local`;

  return new SignJWT({
    email: userEmail,
    role: 'authenticated',
    workspace_id: claims.workspace_id,
    app_metadata: {
      workspace_id: claims.workspace_id,
      role: claims.role ?? 'member',
    },
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(url)
    .setSubject(userId)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secretBytes);
}
