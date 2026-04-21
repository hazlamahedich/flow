import { createServerClient } from '@flow/db';
import { cookies as nextCookies } from 'next/headers';

export async function getServerSupabase() {
  const cookieStore = await nextCookies();

  return createServerClient({
    getAll() {
      return cookieStore.getAll().map((c) => ({ name: c.name, value: c.value }));
    },
    set(name: string, value: string, options?: Record<string, unknown>) {
      try {
        cookieStore.set(name, value, { ...options, path: '/' });
      } catch {
        // Cookie setting can fail in read-only contexts (Server Components)
      }
    },
  });
}
