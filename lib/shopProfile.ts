import type { ShopSettings } from './types';

/**
 * Accent colour helpers.
 *
 * The shop picks one accent colour in Settings and it is pushed to the browser
 * as `--accent` (see app/layout.tsx). Everything else in the app — POS chrome,
 * storefront, invoices, receipts, PWA banner — reads that variable, so a single
 * change repaints the whole product.
 *
 * This module is free of any database import so it can be used from both
 * server and client components.
 */

/** Fallback used when the shop has never chosen a colour. */
export const DEFAULT_ACCENT = '#C5A059';

/** Preset swatches offered in Settings, featuring champagne gold, charcoal, warm ivory, and premium jewel accents. */
export const ACCENT_PRESETS: string[] = [
  '#C5A059', '#D4AF37', '#DFBA6B', '#B89047', '#99732B',
  '#27272A', '#18181B', '#3F3F46', '#52525B', '#71717A',
  '#0F766E', '#1E3A8A', '#701A75', '#831843', '#991B1B',
  '#B91C1C', '#C2410C', '#D97706', '#059669', '#475569',
];

/** Normalise user input to `#RRGGBB`, or return null when unusable. */
export function normalizeHex(input: string): string | null {
  const raw = (input || '').trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw
      .split('')
      .map((c) => c + c)
      .join('')
      .toUpperCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toUpperCase()}`;
  return null;
}

/** Parse `#RRGGBB` into 0-255 channels. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

/**
 * Relative luminance (WCAG). Used to decide whether text sitting on the accent
 * should be white or near-black, so light accents stay readable.
 */
export function isLightColor(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const luminance = 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
  return luminance > 0.45;
}

/**
 * Build the full set of CSS custom properties derived from one accent colour.
 * Returned as an inline `style` object so it can be spread onto <html>.
 */
export function accentCssVars(accent: string): Record<string, string> {
  const hex = normalizeHex(accent) || DEFAULT_ACCENT;
  return {
    '--accent': hex,
    // Hover / pressed state: mix toward black.
    '--accent-strong': `color-mix(in srgb, ${hex} 82%, #000000)`,
    // Softer tint for borders, chips and hover fills.
    '--accent-soft': `color-mix(in srgb, ${hex} 22%, #FFFFFF)`,
    '--accent-softer': `color-mix(in srgb, ${hex} 10%, #FFFFFF)`,
    // Translucent wash for highlights behind text.
    '--accent-wash': `color-mix(in srgb, ${hex} 12%, #FFFFFF)`,
    // Readable text colour on top of a solid accent fill - always white for high-contrast action buttons.
    '--accent-on': '#FFFFFF',
  };
}

/**
 * Default shop profile. These values are seeded into the database on first run
 * and used as a fallback whenever the database is unreachable.
 *
 * This module is intentionally free of any database import so it can also be
 * used from client components.
 */
export const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  owner_name: 'Ajay Kumar',
  shop_name: 'NIDHULAN',
  tagline: 'THE PRECIOUS PEARLS',
  phone: '9871480705 / 8920980965',
  owner_phone: '',
  email: 'nidhulan21@gmail.com',
  address: 'Door Number 615A, Salem Road, Namakkal – 637212',
  location: 'Namakkal, Tamil Nadu',
  instagram_url: 'https://www.instagram.com/nidhulan.official/',
  business_hours: '10:00 AM – 9:00 PM • Open Daily',
  services:
    'Precious Pearls • Exclusive Pearl Jewelry • Custom Pearl Necklaces & Bangles • Bridal & Traditional Pearl Sets',
  gstin: '',
  accent_color: DEFAULT_ACCENT,
  logo_data_url: null,
};

/** Logo src to render: uploaded logo when present, otherwise the bundled asset. */
export const shopLogoSrc = (settings: ShopSettings): string =>
  settings.logo_data_url || '/nidulan-logo.jpeg';

/** Phone formatter for invoice headers & contacts, supporting single or dual numbers */
export const formatPhone = (phone: string): string => {
  if (!phone) return '';
  if (phone.includes('/') || phone.includes(',')) {
    const parts = phone.split(/[/,]/).map((p) => p.trim());
    return parts
      .map((p) => {
        const digits = p.replace(/\D/g, '');
        const local = digits.length > 10 ? digits.slice(-10) : digits;
        return local.length === 10 ? `+91 ${local.slice(0, 5)} ${local.slice(5)}` : p;
      })
      .join(' • ');
  }
  const digits = phone.replace(/\D/g, '');
  const local = digits.length > 10 ? digits.slice(-10) : digits;
  if (local.length !== 10) return phone;
  return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
};
