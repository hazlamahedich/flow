import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { OAuthTokens, OAuthStateEncrypted } from '@flow/types';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_VERSION = 1;

function getEncryptionKey(): Buffer {
  const key = process.env.GMAIL_ENCRYPTION_KEY;
  if (!key) {
    throw Object.assign(
      new Error('GMAIL_ENCRYPTION_KEY is not set. Required for inbox token encryption.'),
      { code: 'ENCRYPTION_KEY_MISSING' as const, statusCode: 500 },
    );
  }
  if (!/^[0-9a-f]{64}$/i.test(key)) {
    throw Object.assign(
      new Error('GMAIL_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes).'),
      { code: 'ENCRYPTION_KEY_MISSING' as const, statusCode: 500 },
    );
  }
  return Buffer.from(key, 'hex');
}

export function encryptInboxTokens(tokens: OAuthTokens): OAuthStateEncrypted {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const plaintext = JSON.stringify(tokens);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    encrypted: Buffer.concat([encrypted, authTag]).toString('base64'),
    iv: iv.toString('base64'),
    version: KEY_VERSION,
  };
}

export function decryptInboxTokens(state: OAuthStateEncrypted): OAuthTokens {
  const key = getEncryptionKey();
  const combined = Buffer.from(state.encrypted, 'base64');
  const iv = Buffer.from(state.iv, 'base64');

  const authTagLength = 16;
  if (combined.length < authTagLength) {
    throw Object.assign(
      new Error('Invalid encrypted state: too short'),
      { code: 'INBOX_CONNECTION_FAILED' as const, statusCode: 500 },
    );
  }

  const encrypted = combined.subarray(0, combined.length - authTagLength);
  const authTag = combined.subarray(combined.length - authTagLength);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted: string;
  try {
    decrypted = decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
  } catch {
    throw Object.assign(
      new Error('Token decryption failed: data may be tampered or key mismatch'),
      { code: 'INBOX_CONNECTION_FAILED' as const, statusCode: 500 },
    );
  }

  const parsed: unknown = JSON.parse(decrypted);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('accessToken' in parsed) ||
    !('refreshToken' in parsed)
  ) {
    throw Object.assign(
      new Error('Decrypted data is not valid OAuth tokens'),
      { code: 'INBOX_CONNECTION_FAILED' as const, statusCode: 500 },
    );
  }

  return parsed as OAuthTokens;
}

export function rotateInboxTokens(
  oldState: OAuthStateEncrypted,
  newTokens: OAuthTokens,
): OAuthStateEncrypted {
  const oldTokens = decryptInboxTokens(oldState);
  void oldTokens; // Validates old state is decryptable before overwriting
  return encryptInboxTokens(newTokens);
}
