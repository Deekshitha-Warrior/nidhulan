import {
  MapPin,
  Clock,
  Phone,
  Store,
  Gem,
  Camera,
  Mail,
  User,
  Sparkles,
  MessageCircle,
  ExternalLink,
} from "lucide-react";
import { getShopSettings, shopLogoSrc } from "@/lib/shopSettings";

export const dynamic = "force-dynamic";

export default async function Home() {
  const shop = await getShopSettings();
  const logo = shopLogoSrc(shop);

  const primaryPhone = "9871480705";
  const shopPhone = "8920980965";

  return (
    <div className="min-h-screen bg-[#0C0C0E] text-[#FAF7F2] font-sans flex flex-col justify-between selection:bg-[var(--accent)] selection:text-[#0C0C0E] relative overflow-hidden">
      {/* Background ambient luxury lighting */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-36 left-1/2 -translate-x-1/2 w-[720px] h-[400px] bg-[radial-gradient(ellipse_at_center,color-mix(in_srgb,var(--accent)_18%,transparent),transparent_70%)] blur-3xl opacity-80" />
        <div className="absolute -bottom-48 right-1/4 w-[500px] h-[350px] bg-[radial-gradient(ellipse_at_center,color-mix(in_srgb,var(--accent)_12%,transparent),transparent_70%)] blur-3xl opacity-60" />
      </div>

      {/* Header */}
      <header className="border-b border-[#C5A059]/20 py-4 sm:py-5 px-6 sm:px-12 flex justify-between items-center bg-[#111114]/85 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3.5">
          <div className="w-16 h-12 bg-black/95 rounded-xl flex items-center justify-center p-1 border border-[var(--accent)]/40 shadow-[0_0_15px_rgba(197,160,89,0.15)] overflow-hidden shrink-0">
            <img
              src={logo}
              alt={`${shop.shop_name} Emblem`}
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <span className="text-base font-black text-[#FAF7F2] tracking-[0.2em] uppercase block">
              {shop.shop_name}
            </span>
            <span className="text-[10px] text-[var(--accent)] font-semibold tracking-[0.28em] block uppercase -mt-0.5">
              {shop.tagline || "THE PRECIOUS PEARLS"}
            </span>
          </div>
        </div>

        {/* Header Quick Contact */}
        <div className="hidden sm:flex items-center gap-3">
          <a
            href={`https://api.whatsapp.com/send?phone=91${primaryPhone}&text=Hello%20NIDHULAN,%20I%20would%20like%20to%20inquire%20about%20your%20precious%20pearls%20collection.`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#1F1F24] border border-[var(--accent)]/30 text-[#FAF7F2] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all"
          >
            <MessageCircle className="w-3.5 h-3.5 text-[var(--accent)]" />
            WhatsApp
          </a>
          <a
            href="https://www.instagram.com/nidhulan.official/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[var(--accent)] text-[#0C0C0E] hover:bg-[#FAF7F2] transition-all font-bold"
          >
            <Camera className="w-3.5 h-3.5" />
            Instagram
          </a>
        </div>
      </header>

      {/* Main Luxury Presentation */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 flex flex-col justify-center items-center py-10 sm:py-16 relative z-10">
        <div className="bg-[#141417]/95 border border-[var(--accent)]/30 rounded-3xl p-6 sm:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.6)] w-full text-center relative overflow-hidden">
          {/* Subtle top gold accent line */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[var(--accent)] to-transparent" />

          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-[var(--accent)]/10 border border-[var(--accent)]/35 text-[var(--accent)] text-[10px] font-bold rounded-full tracking-[0.2em] uppercase mb-6 shadow-xs">
            <Sparkles className="w-3 h-3 text-[var(--accent)]" />
            Fine Pearl Jewelry & Collections
          </div>

          {/* Original Artwork Logo Signboard */}
          <div className="relative mx-auto mb-6 w-full max-w-sm sm:max-w-md rounded-2xl bg-[#09090B] border border-[var(--accent)]/40 shadow-2xl p-2.5 overflow-hidden flex items-center justify-center">
            <img
              src={logo}
              alt={`${shop.shop_name} - THE PRECIOUS PEARLS`}
              className="w-full h-auto max-h-64 object-contain rounded-xl"
            />
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#FAF7F2] leading-tight tracking-[0.18em] mb-1 uppercase font-serif">
            {shop.shop_name}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--accent)] font-semibold tracking-[0.3em] uppercase mb-8">
            {shop.tagline || "THE PRECIOUS PEARLS"}
          </p>

          {/* Core Info Cards */}
          <div className="space-y-5 text-left max-w-lg mx-auto text-sm border-t border-[#C5A059]/20 pt-7">
            {/* Offerings */}
            {shop.services && (
              <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-[#1A1A1F] border border-white/5">
                <div className="w-9 h-9 rounded-xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Gem className="w-4 h-4 text-[var(--accent)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-[0.2em] mb-1">
                    What We Offer
                  </p>
                  <p className="text-[#E8E2D8] leading-relaxed text-xs sm:text-sm font-medium">
                    {shop.services}
                  </p>
                </div>
              </div>
            )}

            {/* Proprietor & Phones Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-[#1A1A1F] border border-white/5">
                <div className="w-9 h-9 rounded-xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-[var(--accent)]" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-[0.2em]">
                    Proprietor
                  </p>
                  <p className="text-[#FAF7F2] font-semibold text-xs sm:text-sm mt-0.5">
                    {shop.owner_name}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-[#1A1A1F] border border-white/5">
                <div className="w-9 h-9 rounded-xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center shrink-0">
                  <Phone className="w-4 h-4 text-[var(--accent)]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-[0.2em]">
                    Primary Contact
                  </p>
                  <a
                    href={`tel:${primaryPhone}`}
                    className="text-[#FAF7F2] hover:text-[var(--accent)] font-semibold text-xs sm:text-sm mt-0.5 block transition-colors"
                  >
                    +91 {primaryPhone}
                  </a>
                </div>
              </div>
            </div>

            {/* Shop Contact & Email Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-[#1A1A1F] border border-white/5">
                <div className="w-9 h-9 rounded-xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center shrink-0">
                  <Store className="w-4 h-4 text-[var(--accent)]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-[0.2em]">
                    Shop Contact
                  </p>
                  <a
                    href={`tel:${shopPhone}`}
                    className="text-[#FAF7F2] hover:text-[var(--accent)] font-semibold text-xs sm:text-sm mt-0.5 block transition-colors"
                  >
                    +91 {shopPhone}
                  </a>
                </div>
              </div>

              {shop.email && (
                <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-[#1A1A1F] border border-white/5">
                  <div className="w-9 h-9 rounded-xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-[var(--accent)]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-[0.2em]">
                      Email ID
                    </p>
                    <a
                      href={`mailto:${shop.email}`}
                      className="text-[#FAF7F2] hover:text-[var(--accent)] font-semibold text-xs sm:text-sm mt-0.5 block truncate transition-colors"
                    >
                      {shop.email}
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Address */}
            {shop.address && (
              <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-[#1A1A1F] border border-white/5">
                <div className="w-9 h-9 rounded-xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-4 h-4 text-[var(--accent)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-[0.2em] mb-1">
                    Store Address
                  </p>
                  <p className="text-[#E8E2D8] text-xs sm:text-sm leading-relaxed">
                    {shop.address}
                  </p>
                  <a
                    href="https://www.google.com/maps/search/?api=1&query=615A+Salem+Road+Namakkal+637212"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--accent)] hover:underline mt-2"
                  >
                    Open in Google Maps <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}

            {/* Instagram & Hours */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {shop.instagram_url && (
                <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-[#1A1A1F] border border-white/5">
                  <div className="w-9 h-9 rounded-xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center shrink-0">
                    <Camera className="w-4 h-4 text-[var(--accent)]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-[0.2em]">
                      Instagram
                    </p>
                    <a
                      href={shop.instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--accent)] font-semibold text-xs sm:text-sm mt-0.5 block hover:underline truncate"
                    >
                      @nidhulan.official
                    </a>
                  </div>
                </div>
              )}

              {shop.business_hours && (
                <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-[#1A1A1F] border border-white/5">
                  <div className="w-9 h-9 rounded-xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 text-[var(--accent)]" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[var(--accent)] uppercase tracking-[0.2em]">
                      Visiting Hours
                    </p>
                    <p className="text-[#FAF7F2] font-semibold text-xs sm:text-sm mt-0.5">
                      {shop.business_hours}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Direct Connect Buttons */}
            <div className="pt-3 grid grid-cols-2 gap-3">
              <a
                href={`tel:${primaryPhone}`}
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[var(--accent)] hover:bg-[#FAF7F2] text-[#0C0C0E] font-bold text-xs uppercase tracking-wider transition-all shadow-[0_4px_15px_rgba(197,160,89,0.2)]"
              >
                <Phone className="w-4 h-4" /> Call Store
              </a>
              <a
                href={`https://api.whatsapp.com/send?phone=91${primaryPhone}&text=Hello%20Ajay%20Kumar%20/%20NIDHULAN,%20I%20would%20like%20to%20inquire%20about%20your%20pearls.`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#1F1F24] hover:bg-[#2A2A30] border border-[var(--accent)]/40 text-[var(--accent)] font-bold text-xs uppercase tracking-wider transition-all"
              >
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#C5A059]/15 py-6 text-center bg-[#0F0F12]/90 backdrop-blur-md relative z-10">
        <p className="text-xs font-bold text-[var(--accent)] tracking-[0.2em] uppercase">
          {shop.shop_name} • {shop.tagline || "THE PRECIOUS PEARLS"}
        </p>
        <p className="text-[10px] font-medium text-[#FAF7F2]/50 tracking-wider mt-1.5 uppercase">
          © {new Date().getFullYear()} {shop.owner_name} • Door No 615A, Salem Road, Namakkal – 637212
        </p>
      </footer>
    </div>
  );
}
