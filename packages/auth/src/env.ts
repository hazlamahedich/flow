export interface AuthEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  appUrl: string;
}

export function validateAuthEnv(): AuthEnv {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  const missing: string[] = [];
  if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseAnonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!supabaseServiceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  if (missing.length > 0) {
    throw new Error(`Missing required auth environment variables: ${missing.join(', ')}`);
  }

  try {
    new URL(supabaseUrl!);
  } catch {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not a valid URL');
  }

  try {
    new URL(appUrl);
  } catch {
    throw new Error('APP_URL is not a valid URL');
  }

  return {
    supabaseUrl: supabaseUrl!,
    supabaseAnonKey: supabaseAnonKey!,
    supabaseServiceRoleKey: supabaseServiceRoleKey!,
    appUrl,
  };
}
