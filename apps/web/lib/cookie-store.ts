import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';
import { cookies as nextCookies } from 'next/headers';

interface IronSessionCookieStore {
  get: (name: string) => { name: string; value: string } | undefined;
  set: {
    (name: string, value: string, cookie?: Partial<ResponseCookie>): void;
    (options: ResponseCookie): void;
  };
}

export async function getCookieStore(): Promise<IronSessionCookieStore> {
  const store = await nextCookies();

  return {
    get: (name: string) => {
      const c = store.get(name);
      return c ? { name: c.name, value: c.value } : undefined;
    },
    set: (nameOrOptions: string | ResponseCookie, value?: string, options?: Partial<ResponseCookie>) => {
      try {
        if (typeof nameOrOptions === 'string') {
          store.set(nameOrOptions, value ?? '', { ...options, path: '/' });
        }
      } catch (err) {
        console.warn('[cookie-store] Failed to set cookie:', err);
      }
    },
  };
}
