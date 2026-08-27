'use client';

import type { Database } from '@patent-knowledge/supabase/database.types';
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import { supabasePublishableKey, supabaseUrl } from './env';

type ClientDatabase = Omit<Database, '__InternalSupabase'>;

let browserClient: SupabaseClient<ClientDatabase> | undefined;

export function createClient() {
  browserClient ??= createBrowserClient<ClientDatabase>(supabaseUrl, supabasePublishableKey);
  return browserClient;
}
