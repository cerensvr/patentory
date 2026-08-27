const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const configuredPublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!configuredUrl || !configuredPublishableKey) {
  throw new Error('Supabase public environment variables are missing.');
}

export const supabaseUrl: string = configuredUrl;
export const supabasePublishableKey: string = configuredPublishableKey;
