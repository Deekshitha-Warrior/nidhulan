"use client";

import React, { useState } from "react";
import {
  Settings2,
  Store,
  User,
  Phone,
  Mail,
  MapPin,
  Clock,
  Camera,
  Gem,
  Hash,
  ImageIcon,
  Upload,
  Trash2,
  Save,
  Loader2,
  Check,
  AlertCircle,
  Palette,
} from "lucide-react";
import type { Category, Product, ShopSettings } from "@/lib/types";
import { updateShopSettings } from "@/app/pos/actions";
import {
  ACCENT_PRESETS,
  DEFAULT_ACCENT,
  accentCssVars,
  normalizeHex,
} from "@/lib/shopProfile";

const MAX_LOGO_EDGE = 512;

interface SettingsPanelProps {
  shop: ShopSettings;
  products?: Product[];
  categories?: Category[];
  onSaved: (settings: ShopSettings) => void;
  onCatalogueChanged?: () => void;
  onOpenInventory?: () => void;
}

const inputCls =
  "w-full bg-white border border-[#C5A059]/40 rounded-lg px-3 py-2.5 text-sm font-semibold text-black placeholder:text-zinc-400 focus:outline-none focus:border-black focus:ring-2 focus:ring-black/10 transition-colors shadow-xs";

const labelCls =
  "block text-[10px] font-black uppercase tracking-widest text-black mb-1.5";

/** Downscale + re-encode an uploaded image so the stored data URL stays small. */
const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("That file is not a valid image."));
      image.onload = () => {
        const scale = Math.min(1, MAX_LOGO_EDGE / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Image processing is not supported here."));
          return;
        }
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });

/* ── Labelled field helpers ──────────────────────────────────────── */

function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  icon,
  className = "",
  mono = false,
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
  mono?: boolean;
  inputMode?: "text" | "tel" | "email" | "url" | "numeric";
}) {
  return (
    <div className={className}>
      <label
        className={labelCls}
        htmlFor={id}
        style={{ color: "#000000", WebkitTextFillColor: "#000000" }}
      >
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-700 pointer-events-none"
            style={{ color: "#000000" }}
          >
            {icon}
          </span>
        )}
        <input
          id={id}
          value={value}
          inputMode={inputMode}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ color: "#000000", WebkitTextFillColor: "#000000" }}
          className={`${inputCls} ${icon ? "pl-9" : ""} ${mono ? "font-mono" : ""}`}
        />
      </div>
    </div>
  );
}

function TextAreaField({
  id,
  label,
  value,
  onChange,
  placeholder,
  icon,
  className = "",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label
        className={labelCls}
        htmlFor={id}
        style={{ color: "#000000", WebkitTextFillColor: "#000000" }}
      >
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span
            className="absolute left-3 top-3 text-zinc-700 pointer-events-none"
            style={{ color: "#000000" }}
          >
            {icon}
          </span>
        )}
        <textarea
          id={id}
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ color: "#000000", WebkitTextFillColor: "#000000" }}
          className={`${inputCls} ${icon ? "pl-9" : ""} resize-none`}
        />
      </div>
    </div>
  );
}

/* ── Accent colour picker ───────────────────────────────────────── */

/**
 * Picks the single accent colour used across the entire app. Selecting a swatch
 * applies the derived CSS variables to <html> immediately (live preview) and
 * saves the selection permanently into the database and localStorage.
 */
function ThemePicker({
  value,
  onChange,
  onSave,
  colorStatus,
}: {
  value: string;
  onChange: (hex: string) => void;
  onSave: (hex: string) => void;
  colorStatus?: { tone: "ok" | "loading" | "err"; text: string } | null;
}) {
  const current = normalizeHex(value) || DEFAULT_ACCENT;
  const [prevCurrent, setPrevCurrent] = React.useState(current);
  const [custom, setCustom] = React.useState(current);

  // Keep the hex box in sync when a preset is chosen without cascading renders
  if (prevCurrent !== current) {
    setPrevCurrent(current);
    setCustom(current);
  }

  const previewVars = accentCssVars(current) as React.CSSProperties;

  const commitCustom = (raw: string) => {
    setCustom(raw);
    const normalized = normalizeHex(raw);
    if (normalized) onChange(normalized);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Preset Swatches */}
      <div>
        <label
          className={labelCls}
          style={{ color: "#000000", WebkitTextFillColor: "#000000" }}
        >
          Curated Palettes
        </label>
        <div className="flex flex-wrap gap-2.5">
          {ACCENT_PRESETS.map((preset) => {
            const active = normalizeHex(preset) === current;
            return (
              <button
                key={preset}
                type="button"
                title={preset}
                aria-label={`Use accent ${preset}`}
                aria-pressed={active}
                onClick={() => onChange(preset)}
                style={{ backgroundColor: preset }}
                className={`w-7 h-7 rounded-lg transition-all cursor-pointer border ${
                  active
                    ? "ring-2 ring-black ring-offset-2 ring-offset-white scale-110 border-black shadow-md"
                    : "border-black/30 hover:scale-105 opacity-90 hover:opacity-100"
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Custom Picker & Controls */}
      <div>
        <label
          className={labelCls}
          style={{ color: "#000000", WebkitTextFillColor: "#000000" }}
        >
          Custom Hex Color
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <label
            className="relative w-10 h-10 rounded-lg overflow-hidden border border-[#C5A059]/40 cursor-pointer shrink-0 shadow-sm transition-transform hover:scale-105"
            style={{ backgroundColor: current }}
            title="Pick a custom colour"
          >
            <input
              type="color"
              value={current}
              onChange={(e) => onChange(e.target.value.toUpperCase())}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              aria-label="Custom accent colour"
            />
          </label>
          <input
            value={custom}
            onChange={(e) => commitCustom(e.target.value)}
            placeholder="#C5A059"
            spellCheck={false}
            style={{ color: "#000000", WebkitTextFillColor: "#000000" }}
            className="w-28 sm:w-32 bg-white border border-[#C5A059]/40 rounded-lg px-3 py-2 text-sm font-mono font-bold text-black focus:outline-none focus:border-black focus:ring-2 focus:ring-black/10 transition-colors shadow-xs"
          />
          <button
            type="button"
            onClick={() => onChange(DEFAULT_ACCENT)}
            className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-600 hover:text-black underline underline-offset-2 cursor-pointer transition-colors px-1"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => onSave(current)}
            style={{ backgroundColor: "#000000", color: "#ffffff", WebkitTextFillColor: "#ffffff" }}
            className="px-4 py-2 rounded-lg bg-black hover:bg-zinc-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-sm border border-zinc-700 active:scale-[0.98]"
          >
            <Save className="w-3.5 h-3.5" style={{ color: "#ffffff", stroke: "#ffffff" }} />
            <span style={{ color: "#ffffff", WebkitTextFillColor: "#ffffff" }}>Save Color</span>
          </button>
          {colorStatus && (
            <span
              className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${
                colorStatus.tone === "loading"
                  ? "text-zinc-500"
                  : colorStatus.tone === "ok"
                    ? "text-[#15803D]"
                    : "text-[#B91C1C]"
              }`}
            >
              {colorStatus.tone === "loading" && <Loader2 className="w-3 h-3 animate-spin" />}
              {colorStatus.tone === "ok" && <Check className="w-3.5 h-3.5 text-[#15803D]" />}
              {colorStatus.tone === "err" && <AlertCircle className="w-3.5 h-3.5 text-[#B91C1C]" />}
              {colorStatus.text}
            </span>
          )}
        </div>
      </div>

      {/* Live Preview Card */}
      <div>
        <label
          className={labelCls}
          style={{ color: "#000000", WebkitTextFillColor: "#000000" }}
        >
          Live Component Preview
        </label>
        <div
          style={previewVars}
          className="rounded-xl overflow-hidden border border-[#C5A059]/30 shadow-md"
        >
          <div
            className="p-4 text-center transition-colors duration-200"
            style={{ backgroundColor: current, color: "#ffffff", WebkitTextFillColor: "#ffffff" }}
          >
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: "#ffffff", WebkitTextFillColor: "#ffffff" }}>
              Active Theme: {current}
            </p>
            <p className="text-[10px] font-medium opacity-90 mt-0.5" style={{ color: "#ffffff", WebkitTextFillColor: "#ffffff" }}>
              Buttons, highlights, badges, and invoice headers will adapt to this tone.
            </p>
          </div>
          <div
            className="bg-[#181820] p-4 flex flex-wrap items-center gap-3"
            style={{ backgroundColor: "#181820", color: "#ffffff" }}
          >
            <span
              className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-xs transition-colors"
              style={{ backgroundColor: current, color: "#ffffff", WebkitTextFillColor: "#ffffff" }}
            >
              Action Button
            </span>
            <span
              className="text-[10px] font-bold underline underline-offset-2"
              style={{ color: "#ffffff", WebkitTextFillColor: "#ffffff" }}
            >
              Accent link
            </span>
            <span
              className="px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider"
              style={{
                backgroundColor: `color-mix(in srgb, ${current} 20%, #181820)`,
                color: "#ffffff",
                WebkitTextFillColor: "#ffffff",
                border: `1px solid color-mix(in srgb, ${current} 35%, transparent)`,
              }}
            >
              Badge Sample
            </span>
            <span
              className="ml-auto text-[11px] font-black font-mono px-3 py-1 rounded-lg shadow-xs"
              style={{
                backgroundColor: `color-mix(in srgb, ${current} 35%, #181820)`,
                color: "#ffffff",
                WebkitTextFillColor: "#ffffff",
                border: `1px solid ${current}`,
              }}
            >
              Total ₹1,250
            </span>
          </div>
        </div>
      </div>

      {/* Theme Info & Tokens Guide */}
      <div className="bg-[#FAF7F2] rounded-xl p-4 border border-[#C5A059]/25 flex flex-col gap-2.5 text-[10px] text-zinc-600">
        <div className="flex items-center justify-between font-mono">
          <span className="font-bold text-black uppercase tracking-wider" style={{ color: "#000000", WebkitTextFillColor: "#000000" }}>
            Theme Token
          </span>
          <span className="font-bold text-black" style={{ color: "#000000", WebkitTextFillColor: "#000000" }}>
            {current}
          </span>
        </div>
        <div className="flex items-center justify-between font-mono">
          <span className="font-bold text-black uppercase tracking-wider" style={{ color: "#000000", WebkitTextFillColor: "#000000" }}>
            Button Text Fill
          </span>
          <span className="font-bold text-black" style={{ color: "#000000", WebkitTextFillColor: "#000000" }}>
            Pure White (#FFFFFF)
          </span>
        </div>
        <p className="text-[10px] text-zinc-600 leading-relaxed pt-1 border-t border-[#C5A059]/20">
          Saved colours are stored in your cloud database and applied in real time to the POS, store catalog, and printed receipts.
        </p>
      </div>
    </div>
  );
}

export default function SettingsPanel({
  shop,
  onSaved,
}: SettingsPanelProps) {
  const [form, setForm] = useState<ShopSettings>(shop);
  const [status, setStatus] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [colorStatus, setColorStatus] = useState<{ tone: "ok" | "loading" | "err"; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const logoInputRef = React.useRef<HTMLInputElement | null>(null);

  const setField = <K extends keyof ShopSettings>(key: K, value: ShopSettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setStatus(null);
  };

  /**
   * Handle color selection:
   * 1. Applies CSS variables to <html> instantly.
   * 2. Saves to localStorage for immediate client hydration.
   * 3. Saves to Supabase DB via updateShopSettings action.
   */
  const handleColorSave = async (newColor: string) => {
    const valid = normalizeHex(newColor) || DEFAULT_ACCENT;
    setField("accent_color", valid);

    // Apply CSS variables immediately
    const root = document.documentElement;
    const vars = accentCssVars(valid);
    Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));

    // Save to localStorage
    try {
      localStorage.setItem("nidhulan_accent_color", valid);
    } catch {}

    // Auto-save to Supabase DB
    setColorStatus({ tone: "loading", text: "Saving to database..." });
    try {
      const updated = await updateShopSettings({ ...form, accent_color: valid });
      setForm(updated);
      onSaved(updated);
      setColorStatus({ tone: "ok", text: "Color saved to database!" });
      setTimeout(() => setColorStatus(null), 3000);
    } catch (err) {
      console.error("Failed to auto-save accent color to database:", err);
      setColorStatus({ tone: "err", text: "Saved locally. (DB error)" });
    }
  };

  /**
   * Synchronize accent CSS variables onto <html> whenever accent_color changes
   */
  React.useEffect(() => {
    const root = document.documentElement;
    const vars = accentCssVars(form.accent_color);
    Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
  }, [form.accent_color]);

  const handleLogoPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus({ tone: "err", text: "Please choose an image file (PNG or JPG)." });
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setField("logo_data_url", dataUrl);
      setStatus({ tone: "ok", text: "Logo updated — remember to save your changes." });
    } catch (err) {
      setStatus({ tone: "err", text: (err as Error).message });
    }
  };

  const handleSave = async () => {
    if (isSaving) return;
    if (!form.shop_name.trim()) {
      setStatus({ tone: "err", text: "Shop name is required." });
      return;
    }
    setIsSaving(true);
    setStatus(null);
    try {
      const saved = await updateShopSettings(form);
      setForm(saved);
      onSaved(saved);
      setStatus({ tone: "ok", text: "Shop details saved." });
    } catch (err) {
      console.error("Failed to save shop settings:", err);
      setStatus({ tone: "err", text: "Could not save settings. Please try again." });
    } finally {
      setIsSaving(false);
    }
  };

  const logoPreview = form.logo_data_url || "/nidulan-logo.jpeg";

  return (
    <div className="flex-1 flex flex-col max-w-[1400px] mx-auto w-full pb-8 px-2 sm:px-4 animate-in fade-in duration-300 gap-6">
      {/* Top Banner */}
      <div className="bg-white border border-[#C5A059]/30 rounded-2xl px-5 py-4 flex items-center gap-3.5 shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-[var(--accent)] text-white flex items-center justify-center shrink-0 shadow-sm">
          <Settings2 className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h2
            className="text-sm font-black text-black uppercase tracking-tight"
            style={{ color: "#000000", WebkitTextFillColor: "#000000" }}
          >
            Shop Settings &amp; Customization
          </h2>
          <p className="text-[11px] text-zinc-600 font-semibold truncate">
            Configure your brand identity, shop profile, logo, and theme colours across the POS and invoices.
          </p>
        </div>
      </div>

      {/* Main 2-column balanced responsive grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Appearance / Theme */}
        <div className="bg-white border border-[#C5A059]/30 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col gap-5">
          <div>
            <h3
              className="text-xs font-black uppercase tracking-widest text-black flex items-center gap-2 mb-1"
              style={{ color: "#000000", WebkitTextFillColor: "#000000" }}
            >
              <Palette className="w-4 h-4 text-black" /> Appearance &amp; Brand Theme
            </h3>
            <p className="text-[10px] text-zinc-600 font-semibold">
              Select or customize the primary accent colour used across the POS terminal, buttons, totals, receipts, and printed invoices.
            </p>
          </div>

          <ThemePicker
            value={form.accent_color}
            onChange={handleColorSave}
            onSave={handleColorSave}
            colorStatus={colorStatus}
          />
        </div>

        {/* Shop profile & Brand details (Right Side Card) */}
        <div className="bg-white border border-[#C5A059]/30 rounded-2xl p-5 sm:p-6 shadow-sm">
          <h3
            className="text-xs font-black uppercase tracking-widest text-black flex items-center gap-2 mb-1"
            style={{ color: "#000000", WebkitTextFillColor: "#000000" }}
          >
            <Store className="w-4 h-4 text-black" /> Shop Profile &amp; Brand
          </h3>
          <p className="text-[10px] text-zinc-600 font-semibold mb-5">
            Details shown on printed bills, WhatsApp receipts, and the customer-facing storefront.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField
              id="set-owner"
              label="Shop Owner Name"
              icon={<User className="w-3.5 h-3.5" />}
              value={form.owner_name}
              placeholder="Ajay Kumar"
              onChange={(v) => setField("owner_name", v)}
            />
            <TextField
              id="set-shop"
              label="Shop Name"
              icon={<Store className="w-3.5 h-3.5" />}
              value={form.shop_name}
              placeholder="NIDHULAN"
              onChange={(v) => setField("shop_name", v)}
            />
            <TextField
              id="set-tagline"
              label="Tagline / Sub-heading"
              value={form.tagline}
              placeholder="THE PRECIOUS PEARLS"
              onChange={(v) => setField("tagline", v)}
              className="sm:col-span-2"
            />
            <TextField
              id="set-phone"
              label="Contact Numbers"
              icon={<Phone className="w-3.5 h-3.5" />}
              value={form.phone}
              placeholder="9871480705 / 8920980965"
              inputMode="tel"
              onChange={(v) => setField("phone", v)}
            />
            <TextField
              id="set-email"
              label="Email ID"
              icon={<Mail className="w-3.5 h-3.5" />}
              value={form.email}
              placeholder="nidhulan21@gmail.com"
              inputMode="email"
              onChange={(v) => setField("email", v)}
            />
            <TextAreaField
              id="set-address"
              label="Shop Address"
              icon={<MapPin className="w-3.5 h-3.5" />}
              value={form.address}
              placeholder="Door Number 615A, Salem Road, Namakkal – 637212"
              onChange={(v) => setField("address", v)}
              className="sm:col-span-2"
            />
            <TextField
              id="set-location"
              label="City / Location"
              value={form.location}
              placeholder="Namakkal, Tamil Nadu"
              onChange={(v) => setField("location", v)}
            />
            <TextField
              id="set-hours"
              label="Business Hours"
              icon={<Clock className="w-3.5 h-3.5" />}
              value={form.business_hours}
              placeholder="10:00 AM – 9:00 PM • Open Daily"
              onChange={(v) => setField("business_hours", v)}
            />
            <TextField
              id="set-instagram"
              label="Instagram Link"
              icon={<Camera className="w-3.5 h-3.5" />}
              value={form.instagram_url}
              placeholder="https://www.instagram.com/nidhulan.official/"
              onChange={(v) => setField("instagram_url", v)}
              className="sm:col-span-2"
            />
            <TextAreaField
              id="set-services"
              label="Catalogue Headline / Services"
              icon={<Gem className="w-3.5 h-3.5" />}
              value={form.services}
              placeholder="Precious Pearls • Exclusive Pearl Jewelry • Custom Pearl Necklaces & Bangles"
              onChange={(v) => setField("services", v)}
              className="sm:col-span-2"
            />
            <TextField
              id="set-gstin"
              label="GSTIN (on GST invoices)"
              icon={<Hash className="w-3.5 h-3.5" />}
              value={form.gstin}
              placeholder="Optional"
              mono
              onChange={(v) => setField("gstin", v)}
              className="sm:col-span-2"
            />
          </div>

          {/* Logo uploader */}
          <div className="mt-6 pt-5 border-t border-[#C5A059]/20">
            <p
              className={`${labelCls} flex items-center gap-1.5`}
              style={{ color: "#000000", WebkitTextFillColor: "#000000" }}
            >
              <ImageIcon className="w-3.5 h-3.5 text-black" /> Shop Logo
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white border border-[#C5A059]/40 shadow-sm flex items-center justify-center p-2 shrink-0 overflow-hidden">
                <img
                  src={logoPreview}
                  alt="Shop logo preview"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex flex-col gap-2 min-w-0">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    style={{ color: "#ffffff", WebkitTextFillColor: "#ffffff" }}
                    className="inline-flex items-center gap-1.5 bg-[var(--accent)] hover:bg-[var(--accent-strong)] active:scale-[0.98] border border-[var(--accent-strong)] text-[10px] font-black uppercase tracking-wider px-3.5 py-2 rounded-lg cursor-pointer transition-colors shadow-sm"
                  >
                    <Upload className="w-3.5 h-3.5" /> Upload Logo
                  </button>
                  {form.logo_data_url && (
                    <button
                      type="button"
                      onClick={() => setField("logo_data_url", null)}
                      className="inline-flex items-center gap-1.5 bg-black hover:bg-zinc-800 border border-zinc-700 text-white text-[10px] font-extrabold uppercase tracking-wider px-3.5 py-2 rounded-lg cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-white" /> Reset Logo
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-zinc-600 font-semibold">
                  PNG or JPG, auto-resized to 512px. Used on the store page,
                  invoices, receipts and the installed app icon.
                </p>
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoPick}
                className="hidden"
              />
            </div>
          </div>

          {/* Save Shop Details Button */}
          <div className="mt-6 pt-5 border-t border-[#C5A059]/20 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              style={{ color: "#ffffff", WebkitTextFillColor: "#ffffff" }}
              className="inline-flex items-center gap-2 bg-[var(--accent)] hover:bg-[var(--accent-strong)] active:scale-[0.98] border border-[var(--accent-strong)] disabled:opacity-50 text-[11px] font-black uppercase tracking-wider px-5 py-2.5 rounded-xl cursor-pointer transition-all shadow-[0_4px_16px_rgba(0,0,0,0.15)]"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {isSaving ? "Saving..." : "Save Shop Details"}
            </button>
            {status && (
              <span
                className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${
                  status.tone === "ok" ? "text-[#15803D]" : "text-[#B91C1C]"
                }`}
              >
                {status.tone === "ok" ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5" />
                )}
                {status.text}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
