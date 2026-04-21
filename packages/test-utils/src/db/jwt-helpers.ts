import { SignJWT } from 'jose';
import { requireEnv } from './supabase-env';

export interface TestJWTCustomClaims {
  sub?: string;
  email?: string;
  workspace_id?: string;
  role?: string;
  expiresAt?: string | Date;
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

  const builder = new SignJWT({
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
    .setIssuedAt();

  if (claims.expiresAt) {
    builder.setExpirationTime(claims.expiresAt);
  } else {
    builder.setExpirationTime('1h');
  }

  return builder.sign(secretBytes);
}

export async function buildTestJWT(opts: {
  role: string;
  workspaceId: string;
  userId: string;
  expiresAt?: string | Date;
}): Promise<string> {
  const claims: TestJWTCustomClaims = {
    sub: opts.userId,
    workspace_id: opts.workspaceId,
    role: opts.role,
  };
  if (opts.expiresAt !== undefined) {
    claims.expiresAt = opts.expiresAt;
  }
  return createTestJWT(claims);
}
