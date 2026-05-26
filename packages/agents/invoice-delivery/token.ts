/**
 * Utilities for signing and verifying invoice delivery tokens.
 * Tokens are stateless JWTs using jose.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const SECRET = () => {
  const secret = process.env.INVOICE_TOKEN_SECRET;
  if (!secret) throw new Error('INVOICE_TOKEN_SECRET not configured');
  return secret;
};

function b64url(s: string): string {
  return Buffer.from(s, 'utf8').toString('base64url');
}

export async function signDeliveryToken(params: {
  invoiceId: string;
  workspaceId: string;
}): Promise<string> {
  const secret = SECRET();
  const payload = JSON.stringify({
    invoiceId: params.invoiceId,
    workspaceId: params.workspaceId,
    exp: Date.now() + 14 * 24 * 60 * 60 * 1000,
  });
  const hmac = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${b64url(payload)}.${hmac}`;
}

export async function verifyDeliveryToken(token: string): Promise<{
  invoiceId: string;
  workspaceId: string;
}> {
  const secret = SECRET();
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) throw new Error('Invalid token format');
  const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
  const hmac = createHmac('sha256', secret).update(payloadJson).digest('base64url');
  const hmacBuf = Buffer.from(hmac);
  const sigBuf = Buffer.from(sig);
  if (hmacBuf.length !== sigBuf.length || !timingSafeEqual(hmacBuf, sigBuf)) {
    throw new Error('Invalid token signature');
  }
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(payloadJson) as Record<string, unknown>;
  } catch {
    throw new Error('Invalid token payload');
  }
  if (typeof data.exp === 'number' && Date.now() > data.exp) {
    throw new Error('Token expired');
  }
  if (
    typeof data.invoiceId !== 'string' ||
    typeof data.workspaceId !== 'string'
  ) {
    throw new Error('Invalid token payload');
  }
  return { invoiceId: data.invoiceId, workspaceId: data.workspaceId };
}
