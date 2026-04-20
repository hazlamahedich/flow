import { createServerClient } from './client';

export async function getConfig<T>(
  key: string,
  parser: (value: unknown) => T,
  cookieStore: { getAll: () => Array<{ name: string; value: string }>; set: (name: string, value: string, options?: Record<string, unknown>) => void },
): Promise<T> {
  const client = createServerClient(cookieStore);

  const { data, error } = await client
    .from('app_config')
    .select('value')
    .eq('key', key)
    .single();

  if (error) {
    throw new Error(`Config key "${key}" not found: ${error.message}`);
  }

  try {
    return parser(data.value);
  } catch (parseErr) {
    throw new Error(
      `Config key "${key}" has invalid value: ${(parseErr as Error).message}`,
    );
  }
}
