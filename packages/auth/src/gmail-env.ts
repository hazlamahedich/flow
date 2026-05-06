export interface GmailEnv {
  googleClientId: string;
  googleClientSecret: string;
  gmailEncryptionKey: string;
  ironSessionPassword: string;
  gmailPubsubTopic: string | undefined;
  gmailPubsubAudience: string | undefined;
}

export function validateGmailEnv(): GmailEnv {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const gmailEncryptionKey = process.env.GMAIL_ENCRYPTION_KEY;
  const ironSessionPassword = process.env.IRON_SESSION_PASSWORD;
  const gmailPubsubTopic = process.env.GMAIL_PUBSUB_TOPIC;
  const gmailPubsubAudience = process.env.GMAIL_PUBSUB_AUDIENCE;

  const missing: string[] = [];
  if (!googleClientId) missing.push('GOOGLE_CLIENT_ID');
  if (!googleClientSecret) missing.push('GOOGLE_CLIENT_SECRET');
  if (!gmailEncryptionKey) missing.push('GMAIL_ENCRYPTION_KEY');
  if (!ironSessionPassword) missing.push('IRON_SESSION_PASSWORD');

  if (missing.length > 0) {
    throw new Error(`Missing required Gmail environment variables: ${missing.join(', ')}`);
  }

  if (!/^[0-9a-f]{64}$/i.test(gmailEncryptionKey!)) {
    throw new Error('GMAIL_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)');
  }

  if (ironSessionPassword!.length < 32) {
    throw new Error('IRON_SESSION_PASSWORD must be at least 32 characters');
  }

  return {
    googleClientId: googleClientId!,
    googleClientSecret: googleClientSecret!,
    gmailEncryptionKey: gmailEncryptionKey!,
    ironSessionPassword: ironSessionPassword!,
    gmailPubsubTopic,
    gmailPubsubAudience,
  };
}
