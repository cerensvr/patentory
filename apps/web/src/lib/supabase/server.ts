import type { Database } from '@patent-knowledge/supabase/database.types';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { supabasePublishableKey, supabaseUrl } from './env';

type ClientDatabase = Omit<Database, '__InternalSupabase'>;

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<ClientDatabase>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot write cookies. Proxy refreshes the session.
        }
      },
    },
  });
}
