import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

import type { Database } from '@patent-knowledge/supabase/database.types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && publishableKey);

const chunkSize = 1800;
const secureKey = (key: string) => `pk.${key.replace(/[^A-Za-z0-9._-]/g, '_')}`;
const manifestKey = (key: string) => `${secureKey(key)}.manifest`;
const chunkKey = (key: string, index: number) => `${secureKey(key)}.chunk.${index}`;

const secureStorage = {
  async getItem(key: string) {
    const manifest = await SecureStore.getItemAsync(manifestKey(key));
    if (!manifest) return SecureStore.getItemAsync(secureKey(key));

    const count = Number.parseInt(manifest, 10);
    if (!Number.isFinite(count) || count < 1) return null;

    const chunks = await Promise.all(
      Array.from({ length: count }, (_, index) =>
        SecureStore.getItemAsync(chunkKey(key, index)),
      ),
    );

    return chunks.every((chunk) => chunk !== null) ? chunks.join('') : null;
  },
  async setItem(key: string, value: string) {
    await this.removeItem(key);
    const chunks = Array.from(
      { length: Math.ceil(value.length / chunkSize) },
      (_, index) => value.slice(index * chunkSize, (index + 1) * chunkSize),
    );

    await Promise.all(
      chunks.map((chunk, index) =>
        SecureStore.setItemAsync(chunkKey(key, index), chunk),
      ),
    );
    await SecureStore.setItemAsync(manifestKey(key), String(chunks.length));
  },
  async removeItem(key: string) {
    const manifest = await SecureStore.getItemAsync(manifestKey(key));
    const count = manifest ? Number.parseInt(manifest, 10) : 0;

    await Promise.all([
      SecureStore.deleteItemAsync(secureKey(key)),
      SecureStore.deleteItemAsync(manifestKey(key)),
      ...Array.from({ length: Number.isFinite(count) ? count : 0 }, (_, index) =>
        SecureStore.deleteItemAsync(chunkKey(key, index)),
      ),
    ]);
  },
};

export const supabase = createClient<Database>(
  url ?? 'https://example.supabase.co',
  publishableKey ?? 'sb_publishable_missing',
  {
    auth: {
      storage: secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
