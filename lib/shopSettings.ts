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
  if (error instanceof Error) return `${error.name}: ${error.message}`;

  if (typeof error === 'object' && error !== null) {
    const parts: string[] = [];
    if ('code' in error && typeof error.code === 'string') parts.push(`code=${error.code}`);
    if ('message' in error && typeof error.message === 'string') parts.push(error.message);
    if ('hint' in error && typeof error.hint === 'string') parts.push(`hint=${error.hint}`);
    if (parts.length > 0) return parts.join(': ');
  }

  return String(error);
}

/** Read the shop profile, seeding defaults on first run. */
export const getShopSettings = cache(async (): Promise<ShopSettings> => {
  if (!isDatabaseConfigured()) return DEFAULT_SHOP_SETTINGS;
  const client = getSupabaseClient();

  try {
    const { data, error } = await client
      .from('shop_settings')
      .select('*')
      .eq('id', SETTINGS_ID)
      .maybeSingle();
    if (error) throw error;
    if (data) return toSettings(data);

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
    if (seeded) return toSettings(seeded);
    return DEFAULT_SHOP_SETTINGS;
  } catch (err) {
    console.error(`Failed to load shop settings from Supabase: ${describeSettingsError(err)}`);
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
  return toSettings(data);
}
