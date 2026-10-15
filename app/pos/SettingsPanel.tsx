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
  Sparkles,
  Hash,
  ImageIcon,
  Upload,
  Trash2,
  Plus,
  Save,
  Loader2,
  Check,
  AlertCircle,
  Package,
  Pencil,
  Palette,
} from "lucide-react";
import type { Category, Product, ShopSettings, ItemType } from "@/lib/types";
import {
  createCategory,
  createProduct,
  editProduct,
  removeProduct,
  updateShopSettings,
} from "@/app/pos/actions";

import {
  ACCENT_PRESETS,
  DEFAULT_ACCENT,
  accentCssVars,
  isLightColor,
  normalizeHex,
} from "@/lib/shopProfile";

const MAX_LOGO_EDGE = 512;

interface SettingsPanelProps {
  shop: ShopSettings;
  products: Product[];
  categories: Category[];
  onSaved: (settings: ShopSettings) => void;
  onCatalogueChanged: () => void;
  onOpenInventory: () => void;
}

const inputCls =
  "w-full bg-[#181820] border border-[#C5A059]/25 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#FAF7F2] placeholder:text-[#B8B5AE]/40 focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-colors";

const labelCls =
  "block text-[10px] font-extrabold uppercase tracking-widest text-[#B8B5AE] mb-1.5";

const emptyDraft = {
  name: "",
  category: "",
  price: "",
  gst: "5",
  hsn: "",
  cost: "",
  stock: "0",
  lowStock: "0",
  offerPct: "",
  type: "PRODUCT" as ItemType,
};

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
      <label className={labelCls} htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B8B5AE]/60 pointer-events-none">
            {icon}
          </span>
        )}
        <input
          id={id}
          value={value}
          inputMode={inputMode}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
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
      <label className={labelCls} htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-3 text-[#B8B5AE]/60 pointer-events-none">
            {icon}
          </span>
        )}
        <textarea
          id={id}
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${inputCls} ${icon ? "pl-9" : ""} resize-none`}
        />
      </div>
    </div>
  );
}

/* ── Accent colour picker ───────────────────────────────────────── */

/**
 * Picks the single accent colour used across the entire app. Selecting a swatch
 * applies the derived CSS variables to <html> immediately (live preview) so the
 * admin sees the whole POS — and any open invoice tab — repaint before saving.
 */
function ThemePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
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
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
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
              className={`w-7 h-7 rounded-md transition-transform cursor-pointer ${
                active
                  ? "ring-2 ring-offset-2 ring-[var(--accent)] scale-110"
                  : "hover:scale-110"
              }`}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label
          className="relative w-11 h-9 rounded-lg overflow-hidden border border-[#C5A059]/30 cursor-pointer shrink-0 shadow-sm"
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
          className="w-32 bg-[#181820] border border-[#C5A059]/25 rounded-lg px-3 py-2 text-sm font-mono font-semibold text-[#FAF7F2] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-colors"
        />
        <button
          type="button"
          onClick={() => onChange(DEFAULT_ACCENT)}
          className="text-[10px] font-extrabold uppercase tracking-wider text-[#B8B5AE] hover:text-[var(--accent)] underline underline-offset-2 cursor-pointer transition-colors"
        >
          Reset
        </button>
      </div>

      {/* Live preview card */}
      <div
        style={previewVars}
        className="mt-4 rounded-xl overflow-hidden border border-[#C5A059]/20"
      >
        <div className="p-4 text-center" style={{ backgroundColor: current, color: isLightColor(current) ? "#0C0C0E" : "#FAF7F2" }}>
          <p className="text-sm font-black uppercase tracking-tight">Card Preview</p>
          <p className="text-[10px] font-semibold opacity-80 mt-0.5">
            Buttons, links, totals and invoice headers use this colour.
          </p>
        </div>
        <div className="bg-[#181820] p-3 flex items-center gap-2">
          <span
            className="px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider"
            style={{ backgroundColor: current, color: isLightColor(current) ? "#0C0C0E" : "#FAF7F2" }}
          >
            Button
          </span>
          <span className="text-[10px] font-bold" style={{ color: current }}>
            Accent link
          </span>
          <span
            className="ml-auto text-[10px] font-extrabold px-2.5 py-1 rounded-md"
            style={{ backgroundColor: `color-mix(in srgb, ${current} 18%, #181820)`, color: current }}
          >
            Total ₹1,250
          </span>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPanel({
  shop,
  products,
  categories,
  onSaved,
  onCatalogueChanged,
  onOpenInventory,
}: SettingsPanelProps) {
  const [form, setForm] = useState<ShopSettings>(shop);
  const [status, setStatus] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const logoInputRef = React.useRef<HTMLInputElement | null>(null);

  const setField = <K extends keyof ShopSettings>(key: K, value: ShopSettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setStatus(null);
  };

  /**
   * Live theme preview: write the derived accent variables onto <html> the moment
   * a colour is picked, so the admin sees the entire POS repaint instantly. The
   * persisted value only changes on Save.
   */
  React.useEffect(() => {
    const root = document.documentElement;
    const vars = accentCssVars(form.accent_color);
    Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
    return () => {
      Object.keys(vars).forEach((key) => root.style.removeProperty(key));
    };
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
    <div className="flex-1 flex flex-col max-w-[1400px] mx-auto w-full pb-8 pr-2 animate-in fade-in duration-300 gap-6">
      <div className="bg-[#131317] border border-[#C5A059]/20 rounded-2xl px-5 py-4 flex items-center gap-3 shadow-sm">
        <div className="w-9 h-9 rounded-xl bg-[var(--accent)] text-[#0C0C0E] flex items-center justify-center shrink-0">
          <Settings2 className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-sm font-black text-[#FAF7F2] uppercase tracking-tight">
            Shop Settings
          </h2>
          <p className="text-[10px] text-[#B8B5AE] font-semibold">
            Update the shop profile, logo and product catalogue used across the POS,
            invoices and the public store page.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* Appearance / theme */}
        <div className="bg-[#131317] border border-[#C5A059]/20 rounded-2xl p-5 sm:p-6 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-widest text-[var(--accent)] flex items-center gap-2 mb-1">
            <Palette className="w-4 h-4" /> Appearance
          </h3>
          <p className="text-[10px] text-[#B8B5AE] font-semibold mb-5">
            One accent colour drives the whole app — POS, storefront, invoices,
            receipts and the installed app.
          </p>
          <ThemePicker
            value={form.accent_color}
            onChange={(v) => setField("accent_color", v)}
          />
        </div>

        {/* ── Shop profile ─────────────────────────────────────────── */}
        <div className="bg-[#131317] border border-[#C5A059]/20 rounded-2xl p-5 sm:p-6 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-widest text-[var(--accent)] flex items-center gap-2 mb-5">
            <Store className="w-4 h-4" /> Shop Profile
          </h3>

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
            />
          </div>

          {/* Logo uploader */}
          <div className="mt-6 pt-5 border-t border-[#C5A059]/15">
            <p className={`${labelCls} flex items-center gap-1.5`}>
              <ImageIcon className="w-3.5 h-3.5" /> Shop Logo
            </p>
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white border border-[#D4AF37]/40 shadow-sm flex items-center justify-center p-2 shrink-0 overflow-hidden">
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
                    className="inline-flex items-center gap-1.5 bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] hover:brightness-110 active:scale-[0.98] text-[#0C0C0E] border border-[#E5C378] text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-lg cursor-pointer transition-colors shadow-sm"
                  >
                    <Upload className="w-3.5 h-3.5" /> Upload Logo
                  </button>
                  {form.logo_data_url && (
                    <button
                      type="button"
                      onClick={() => setField("logo_data_url", null)}
                      className="inline-flex items-center gap-1.5 bg-[#181820] hover:bg-[#202028] border border-[#C5A059]/20 text-[#FAF7F2] text-[10px] font-extrabold uppercase tracking-wider px-3 py-2 rounded-lg cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Reset Logo
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-[#B8B5AE] font-semibold">
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

          {/* Save */}
          <div className="mt-6 pt-5 border-t border-[#C5A059]/15 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] hover:brightness-110 active:scale-[0.98] text-[#0C0C0E] border border-[#E5C378] disabled:opacity-50 text-[11px] font-black uppercase tracking-wider px-5 py-2.5 rounded-xl cursor-pointer transition-all shadow-[0_4px_16px_rgba(197,160,89,0.25)]"
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

        <CatalogueEditor
          products={products}
          categories={categories}
          onChanged={onCatalogueChanged}
          onOpenInventory={onOpenInventory}
        />
      </div>
    </div>
  );
}

/* ── Catalogue editor (products & categories) ────────────────────── */

function CatalogueEditor({
  products,
  categories,
  onChanged,
  onOpenInventory,
}: {
  products: Product[];
  categories: Category[];
  onChanged: () => void;
  onOpenInventory: () => void;
}) {
  const [draft, setDraft] = useState(emptyDraft);
  const [editing, setEditing] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const sorted = [...products].sort((a, b) => a.name.localeCompare(b.name));

  const startEdit = (p: Product) => {
    setEditing(p.id);
    setDraft({
      name: p.name,
      category: p.category,
      price: String(Number(p.selling_price)),
      gst: String(Number(p.gst_rate)),
      hsn: p.hsn_code || "",
      cost: String(Number(p.cost_price) || 0),
      stock: String(Number(p.current_stock) || 0),
      lowStock: String(Number(p.low_stock_alert) || 0),
      offerPct: String(Number(p.offer_discount_pct) || 0),
      type: p.item_type || "PRODUCT",
    });
  };

  const handleAdd = async () => {
    if (isBusy) return;
    if (!draft.name.trim() || !draft.category.trim() || Number(draft.price) <= 0) {
      alert("Enter an item name, a category and a price greater than 0.");
      return;
    }
    const isService = draft.type === "SERVICE";
    setIsBusy(true);
    try {
      await createProduct({
        name: draft.name.trim(),
        description: null,
        category: draft.category.trim(),
        gst_rate: Number(draft.gst) || 0,
        hsn_code: draft.hsn.trim() || null,
        selling_price: Number(draft.price),
        item_type: draft.type,
        cost_price: Number(draft.cost) || 0,
        // Services never hold stock.
        current_stock: isService ? null : Number(draft.stock) || 0,
        low_stock_alert: isService ? null : Number(draft.lowStock) || 0,
        offer_discount_pct: Number(draft.offerPct) || 0,
        offer_price:
          Number(draft.offerPct) > 0
            ? Math.round(
                (Number(draft.price) - (Number(draft.price) * Number(draft.offerPct)) / 100) *
                  100,
              ) / 100
            : null,
        is_active: true,
      });
      setDraft({ ...emptyDraft, category: draft.category, type: draft.type });
      onChanged();
    } catch (err) {
      console.error(err);
      alert("Could not add the catalogue item.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveEdit = async (id: string) => {
    if (isBusy) return;
    if (!draft.name.trim() || Number(draft.price) <= 0) {
      alert("Enter a name and a price greater than 0.");
      return;
    }
    const isService = draft.type === "SERVICE";
    setIsBusy(true);
    try {
      await editProduct(id, {
        name: draft.name.trim(),
        category: draft.category.trim(),
        selling_price: Number(draft.price),
        gst_rate: Number(draft.gst) || 0,
        hsn_code: draft.hsn.trim() || null,
        item_type: draft.type,
        cost_price: Number(draft.cost) || 0,
        current_stock: isService ? null : Number(draft.stock) || 0,
        low_stock_alert: isService ? null : Number(draft.lowStock) || 0,
        offer_discount_pct: Number(draft.offerPct) || 0,
        offer_price:
          Number(draft.offerPct) > 0
            ? Math.round(
                (Number(draft.price) - (Number(draft.price) * Number(draft.offerPct)) / 100) *
                  100,
              ) / 100
            : null,
      });
      setEditing(null);
      onChanged();
    } catch (err) {
      console.error(err);
      alert("Could not update the catalogue item.");
    } finally {
      setIsBusy(false);
    }
  };

  /** Quick toggle for "visible in Billing Panel" straight from the list. */
  const handleToggleActive = async (p: Product) => {
    setIsBusy(true);
    try {
      await editProduct(p.id, { is_active: !p.is_active });
      onChanged();
    } catch (err) {
      console.error(err);
      alert("Could not update visibility.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleDelete = async (item: Product) => {
    if (!window.confirm(`Delete "${item.name}" from the catalogue?`)) return;
    setIsBusy(true);
    try {
      await removeProduct(item.id);
      onChanged();
    } catch (err) {
      console.error(err);
      alert("Could not delete the catalogue item.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    setIsBusy(true);
    try {
      await createCategory(newCategory.trim());
      setNewCategory("");
      onChanged();
    } catch (err) {
      console.error(err);
      alert("Could not add the category.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="bg-[#131317] border border-[#C5A059]/20 rounded-2xl p-5 sm:p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-5">
        <h3 className="text-xs font-black uppercase tracking-widest text-[var(--accent)] flex items-center gap-2">
          <Package className="w-4 h-4" /> Product Catalogue
        </h3>
        <button
          type="button"
          onClick={onOpenInventory}
          className="text-[9px] font-extrabold uppercase tracking-widest text-[var(--accent)] hover:underline underline-offset-2 cursor-pointer shrink-0"
        >
          Full inventory view
        </button>
      </div>

      {/* Categories */}
      <div className="mb-5">
        <p className={labelCls}>Categories</p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {categories.length === 0 && (
            <span className="text-[10px] text-[#B8B5AE]/60 font-semibold">
              No categories yet.
            </span>
          )}
          {categories.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center bg-[var(--accent)]/10 border border-[var(--accent)]/25 text-[var(--accent)] text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full"
            >
              {c.name}
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className={inputCls}
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
            placeholder="e.g. Blouses"
          />
          <button
            type="button"
            onClick={handleAddCategory}
            className="inline-flex items-center gap-1.5 bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] hover:brightness-110 active:scale-[0.98] text-[#0C0C0E] border border-[#E5C378] text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-lg cursor-pointer transition-colors shrink-0 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
      </div>

      {/* Add item */}
      <div className="mb-5 pb-5 border-b border-[#C5A059]/15">
        <p className={labelCls}>Add catalogue item</p>

        {/* Product ⇄ Service switch */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            type="button"
            onClick={() => setDraft({ ...draft, type: "PRODUCT" })}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer border ${
              draft.type === "PRODUCT"
                ? "bg-[var(--accent)] text-[#0C0C0E] border-[var(--accent)]"
                : "bg-[#181820] text-[#B8B5AE] border-[#C5A059]/20 hover:border-[#C5A059]/40 hover:text-[#FAF7F2]"
            }`}
          >
            <Package className="w-3.5 h-3.5" /> Product
          </button>
          <button
            type="button"
            onClick={() => setDraft({ ...draft, type: "SERVICE" })}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer border ${
              draft.type === "SERVICE"
                ? "bg-[var(--accent-strong)] text-[#0C0C0E] border-[var(--accent-strong)]"
                : "bg-[#181820] text-[#B8B5AE] border-[#C5A059]/20 hover:border-[#C5A059]/40 hover:text-[#FAF7F2]"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" /> Service
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
          <input
            className={`${inputCls} sm:col-span-2`}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder={draft.type === "SERVICE" ? "Service name" : "Item name"}
          />
          <input
            className={`${inputCls} sm:col-span-2`}
            list="catalogue-categories"
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            placeholder="Category"
          />
          <datalist id="catalogue-categories">
            {categories.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
          <input
            className={inputCls}
            type="number"
            min="0"
            step="0.01"
            value={draft.price}
            onChange={(e) => setDraft({ ...draft, price: e.target.value })}
            placeholder="Price"
          />
          <input
            className={inputCls}
            type="number"
            min="0"
            step="0.01"
            value={draft.cost}
            onChange={(e) => setDraft({ ...draft, cost: e.target.value })}
            placeholder="Cost"
          />
          {/* Stock only applies to products */}
          {draft.type === "PRODUCT" && (
            <>
              <input
                className={inputCls}
                type="number"
                min="0"
                step="1"
                value={draft.stock}
                onChange={(e) => setDraft({ ...draft, stock: e.target.value })}
                placeholder="Stock"
              />
              <input
                className={inputCls}
                type="number"
                min="0"
                step="1"
                value={draft.lowStock}
                onChange={(e) => setDraft({ ...draft, lowStock: e.target.value })}
                placeholder="Low stock"
              />
            </>
          )}
          <input
            className={inputCls}
            type="number"
            min="0"
            step="1"
            max="100"
            value={draft.offerPct}
            onChange={(e) => setDraft({ ...draft, offerPct: e.target.value })}
            placeholder="Offer %"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={isBusy}
            className="sm:col-span-6 inline-flex items-center justify-center gap-1.5 bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] hover:brightness-110 active:scale-[0.98] disabled:opacity-50 text-[#0C0C0E] border border-[#E5C378] text-[10px] font-black uppercase tracking-wider px-3 py-2.5 rounded-lg cursor-pointer transition-all shadow-[0_2px_10px_rgba(197,160,89,0.2)]"
          >
            <Plus className="w-3.5 h-3.5" />
            {draft.type === "SERVICE" ? "Add Service" : "Add to catalogue"}
          </button>
        </div>
      </div>

      {/* Item list */}
      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {sorted.length === 0 && (
          <p className="text-[10px] text-[#B8B5AE] font-semibold py-4 text-center">
            Catalogue is empty. Add your first item above.
          </p>
        )}
        {sorted.map((p) =>
          editing === p.id ? (
            <div
              key={p.id}
              className="border border-[var(--accent)]/40 bg-[var(--accent)]/10 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-6 gap-2"
            >
              <input
                className={`${inputCls} sm:col-span-2`}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Item name"
              />
              <input
                className={`${inputCls} sm:col-span-2`}
                list="catalogue-categories"
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                placeholder="Category"
              />
              <input
                className={inputCls}
                type="number"
                min="0"
                step="0.01"
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                placeholder="Price"
              />
              <input
                className={inputCls}
                type="number"
                min="0"
                step="0.01"
                value={draft.gst}
                onChange={(e) => setDraft({ ...draft, gst: e.target.value })}
                placeholder="GST %"
              />
              <div className="sm:col-span-6 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveEdit(p.id)}
                  className="inline-flex items-center gap-1.5 bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] hover:brightness-110 active:scale-[0.98] text-[#0C0C0E] border border-[#E5C378] text-[10px] font-black uppercase tracking-wider px-3 py-2 rounded-lg cursor-pointer transition-colors shadow-sm"
                >
                  <Check className="w-3.5 h-3.5" /> Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="inline-flex items-center gap-1.5 bg-[#181820] hover:bg-[#202028] border border-[#C5A059]/20 text-[#FAF7F2] text-[10px] font-extrabold uppercase tracking-wider px-3 py-2 rounded-lg cursor-pointer transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              key={p.id}
              className="flex items-center gap-3 border border-[#C5A059]/20 bg-[#181820] rounded-xl px-3 py-2.5 hover:border-[var(--accent)]/40 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-extrabold text-[#FAF7F2] truncate flex items-center gap-1.5">
                  {p.name}
                  {p.item_type === "SERVICE" && (
                    <span className="text-[8px] font-black uppercase tracking-widest text-[var(--accent-strong)] bg-[var(--accent-strong)]/10 border border-[var(--accent-strong)]/25 px-1.5 py-0.5 rounded shrink-0">
                      Service
                    </span>
                  )}
                  {!p.is_active && (
                    <span className="text-[8px] font-black uppercase tracking-widest text-[#B8B5AE] bg-[#131317] border border-[#C5A059]/20 px-1.5 py-0.5 rounded shrink-0">
                      Inactive
                    </span>
                  )}
                  {Number(p.offer_discount_pct) > 0 && (
                    <span className="text-[8px] font-black uppercase tracking-widest text-[#15803D] bg-[#15803D]/10 border border-[#15803D]/25 px-1.5 py-0.5 rounded shrink-0">
                      −{Number(p.offer_discount_pct)}%
                    </span>
                  )}
                </p>
                <p className="text-[9px] text-[#B8B5AE] font-semibold uppercase tracking-wider truncate">
                  {p.category}
                  {p.item_type === "SERVICE"
                    ? " • No stock"
                    : ` • Stock ${Number(p.current_stock) || 0}`}
                  {p.item_type === "PRODUCT" && p.low_stock_alert !== null
                    ? ` (alert < ${Number(p.low_stock_alert)})`
                    : ""}
                </p>
              </div>
              <span className="font-mono text-[11px] font-bold text-[#FAF7F2]">
                ₹{Number(p.selling_price).toLocaleString("en-IN")}
              </span>
              <button
                type="button"
                onClick={() => handleToggleActive(p)}
                title={p.is_active ? "Hide from Billing Panel" : "Show in Billing Panel"}
                className={`cursor-pointer ${
                  p.is_active ? "text-[#15803D]" : "text-[#B8B5AE]/40 hover:text-[#B8B5AE]"
                }`}
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => startEdit(p)}
                title="Edit item"
                className="text-[#B8B5AE] hover:text-[var(--accent)] cursor-pointer transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(p)}
                title="Delete item"
                className="text-[#B8B5AE] hover:text-[#EF4444] cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
