export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateGmailEnv } = await import('@flow/auth/gmail-env');
    try {
      validateGmailEnv();
    } catch (err) {
      console.error('[startup] Gmail env validation failed:', err);
    }
  }
}
