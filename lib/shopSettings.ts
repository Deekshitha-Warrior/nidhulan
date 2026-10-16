import { cache } from 'react';
import { getSupabaseClient, isDatabaseConfigured } from './db';
import type { ShopSettings } from './types';
import { DEFAULT_SHOP_SETTINGS, DEFAULT_ACCENT, normalizeHex } from './shopProfile';

export {
  DEFAULT_SHOP_SETTINGS,
  shopLogoSrc,
  formatPhone,
  DEFAULT_ACCENT,
  ACCENT_PRESETS,
  accentCssVars,
  isLightColor,
  normalizeHex,
} from './shopProfile';

const SETTINGS_ID = 'default';

const toSettings = (row: Record<string, unknown>): ShopSettings => {
  const isOldDefault = row.shop_name === 'Dhanyas Boutique' || row.owner_name === 'Ananthi M';
  return {
    owner_name: (!isOldDefault && (row.owner_name as string)) || DEFAULT_SHOP_SETTINGS.owner_name,
    shop_name: (!isOldDefault && (row.shop_name as string)) || DEFAULT_SHOP_SETTINGS.shop_name,
    tagline: (!isOldDefault && (row.tagline as string)) || DEFAULT_SHOP_SETTINGS.tagline,
    phone: (!isOldDefault && (row.phone as string)) || DEFAULT_SHOP_SETTINGS.phone,
    owner_phone: (row.owner_phone as string) || DEFAULT_SHOP_SETTINGS.owner_phone,
    email: (!isOldDefault && (row.email as string)) || DEFAULT_SHOP_SETTINGS.email,
    address: (!isOldDefault && (row.address as string)) || DEFAULT_SHOP_SETTINGS.address,
    location: (!isOldDefault && (row.location as string)) || DEFAULT_SHOP_SETTINGS.location,
    instagram_url:
      (!isOldDefault && (row.instagram_url as string)) || DEFAULT_SHOP_SETTINGS.instagram_url,
    business_hours:
      (!isOldDefault && (row.business_hours as string)) || DEFAULT_SHOP_SETTINGS.business_hours,
    services: (!isOldDefault && (row.services as string)) || DEFAULT_SHOP_SETTINGS.services,
    gstin: (row.gstin as string) || DEFAULT_SHOP_SETTINGS.gstin,
    accent_color:
      (!isOldDefault && normalizeHex((row.accent_color as string) || '')) ||
      DEFAULT_SHOP_SETTINGS.accent_color,
    logo_data_url: (row.logo_data_url as string) || null,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  };
};

function describeSettingsError(error: unknown): string {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    if (cause) {
      return `${error.name}: ${error.message} (cause: ${String(cause)})`;
    }
    return `${error.name}: ${error.message}`;
  }

  if (typeof error === 'object' && error !== null) {
    const parts: string[] = [];
    const obj = error as Record<string, unknown>;
    if (typeof obj.code === 'string' && obj.code.trim()) parts.push(`code=${obj.code}`);
    if (typeof obj.message === 'string' && obj.message.trim()) parts.push(obj.message);
    if (typeof obj.hint === 'string' && obj.hint.trim()) parts.push(`hint=${obj.hint}`);
    if (typeof obj.details === 'string' && obj.details.trim()) parts.push(`details=${obj.details}`);
    if (parts.length > 0) return parts.join(': ');
  }

  return String(error);
}

// In-memory cache to prevent repeated database queries across rapid requests
// and serve gracefully if connection drops momentarily.
let memoryCache: { settings: ShopSettings; timestamp: number } | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

/** Read the shop profile, seeding defaults on first run. */
export const getShopSettings = cache(async (): Promise<ShopSettings> => {
  if (memoryCache && Date.now() - memoryCache.timestamp < CACHE_TTL_MS) {
    return memoryCache.settings;
  }

  if (!isDatabaseConfigured()) return memoryCache?.settings || DEFAULT_SHOP_SETTINGS;
  const client = getSupabaseClient();

  try {
    const { data, error } = await client
      .from('shop_settings')
      .select('*')
      .eq('id', SETTINGS_ID)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      const parsed = toSettings(data);
      memoryCache = { settings: parsed, timestamp: Date.now() };
      return parsed;
    }

    const { data: seeded, error: seedError } = await client
      .from('shop_settings')
      .upsert(
        {
          id: SETTINGS_ID,
          ...DEFAULT_SHOP_SETTINGS,
          accent_color: DEFAULT_ACCENT,
        },
        { onConflict: 'id', ignoreDuplicates: true },
      )
      .select('*')
      .maybeSingle();
    if (seedError) throw seedError;
    if (seeded) {
      const parsed = toSettings(seeded);
      memoryCache = { settings: parsed, timestamp: Date.now() };
      return parsed;
    }
    return DEFAULT_SHOP_SETTINGS;
  } catch (err) {
    console.error(`Failed to load shop settings from Supabase: ${describeSettingsError(err)}`);
    // Fall back to memory cache if available, otherwise default settings
    if (memoryCache) {
      return memoryCache.settings;
    }
    return DEFAULT_SHOP_SETTINGS;
  }
});

/** Upsert the shop profile. */
export async function saveShopSettings(input: ShopSettings): Promise<ShopSettings> {
  const { data, error } = await getSupabaseClient()
    .from('shop_settings')
    .upsert(
      {
        id: SETTINGS_ID,
        owner_name: input.owner_name,
        shop_name: input.shop_name,
        tagline: input.tagline,
        phone: input.phone,
        owner_phone: input.owner_phone,
        email: input.email,
        address: input.address,
        location: input.location,
        instagram_url: input.instagram_url,
        business_hours: input.business_hours,
        services: input.services,
        gstin: input.gstin,
        logo_data_url: input.logo_data_url,
        accent_color: input.accent_color,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
    .select('*')
    .single();

  if (error) throw error;
  if (!data) throw new Error('Supabase did not return the saved shop settings.');
  const parsed = toSettings(data);
  memoryCache = { settings: parsed, timestamp: Date.now() };
  return parsed;
}
