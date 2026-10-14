import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export class DatabaseUnavailableError extends Error {
  code = 'DATABASE_UNAVAILABLE';

  constructor(message = 'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.') {
    super(message);
    this.name = 'DatabaseUnavailableError';
  }
}

export class DatabaseQueryError extends Error {
  code: string | undefined;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'DatabaseQueryError';
    this.code = code;
  }
}

let client: SupabaseClient | undefined;

export function isDatabaseConfigured(): boolean {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key || key.includes('YOUR_') || key.includes('example')) return false;

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

export function getSanitizedSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL;
  if (!url) return '[NOT CONFIGURED]';
  try {
    return new URL(url).origin;
  } catch {
    return '[INVALID FORMAT]';
  }
}

export function getSupabaseClient(): SupabaseClient {
  if (!isDatabaseConfigured()) throw new DatabaseUnavailableError();
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new DatabaseUnavailableError();

  client = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  return client;
}

export async function checkDatabaseConnection(): Promise<void> {
  const { error } = await getSupabaseClient().from('categories').select('id').limit(1);
  if (error) throw new DatabaseQueryError(error.message, error.code);
}
