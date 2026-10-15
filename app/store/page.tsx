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
    <div className="min-h-screen bg-[#F7F7F8] text-[#171717] font-sans flex flex-col justify-between selection:bg-[var(--accent)] selection:text-[#171717] relative overflow-hidden">
      {/* Background ambient luxury lighting */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-36 left-1/2 -translate-x-1/2 w-[720px] h-[400px] bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.08),transparent_70%)] blur-3xl opacity-80" />
        <div className="absolute -bottom-48 right-1/4 w-[500px] h-[350px] bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.06),transparent_70%)] blur-3xl opacity-60" />
      </div>

      {/* Header */}
      <header className="border-b border-[#C5A059]/20 py-4 sm:py-5 px-6 sm:px-12 flex justify-between items-center bg-white/90 backdrop-blur-md sticky top-0 z-40 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center p-1 border border-[#D4AF37]/40 shadow-xs overflow-hidden shrink-0">
            <img
              src={logo}
              alt={`${shop.shop_name} Emblem`}
              className="w-full h-full object-contain rounded-lg"
            />
          </div>
          <div>
            <span className="text-base font-black text-[#171717] tracking-[0.2em] uppercase block">
              {shop.shop_name}
            </span>
            <span className="text-[10px] text-[#A47B16] font-bold tracking-[0.28em] block uppercase -mt-0.5">
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
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#F3F4F6] border border-[#C5A059]/30 text-[#171717] hover:border-[#D4AF37] hover:text-[#A47B16] transition-all"
          >
            <MessageCircle className="w-3.5 h-3.5 text-[#A47B16]" />
            WhatsApp
          </a>
          <a
            href="https://www.instagram.com/nidhulan.official/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#D4AF37] text-[#171717] hover:bg-[#C5A02E] transition-all font-bold shadow-xs"
          >
            <Camera className="w-3.5 h-3.5" />
            Instagram
          </a>
        </div>
      </header>

      {/* Main Luxury Presentation */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 flex flex-col justify-center items-center py-10 sm:py-16 relative z-10">
        <div className="bg-white border border-[#D4AF37]/35 rounded-3xl p-6 sm:p-12 shadow-[0_20px_50px_rgba(23,23,23,0.06)] w-full text-center relative overflow-hidden">
          {/* Subtle top gold accent line */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />

          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-[#D4AF37]/10 border border-[#D4AF37]/35 text-[#8A6815] text-[10px] font-bold rounded-full tracking-[0.2em] uppercase mb-6 shadow-xs">
            <Sparkles className="w-3 h-3 text-[#A47B16]" />
            Fine Pearl Jewelry &amp; Collections
          </div>

          {/* Logo Showcase - Perfectly proportioned square emblem */}
          <div className="relative mx-auto mb-6 w-36 h-36 sm:w-44 sm:h-44 rounded-3xl bg-white border border-[#D4AF37]/40 shadow-sm p-3 overflow-hidden flex items-center justify-center">
            <img
              src={logo}
              alt={`${shop.shop_name} - THE PRECIOUS PEARLS`}
              className="w-full h-full object-contain rounded-2xl"
            />
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#171717] leading-tight tracking-[0.18em] mb-1 uppercase font-serif">
            {shop.shop_name}
          </h1>
          <p className="text-xs sm:text-sm text-[#A47B16] font-bold tracking-[0.3em] uppercase mb-8">
            {shop.tagline || "THE PRECIOUS PEARLS"}
          </p>

          {/* Core Info Cards */}
          <div className="space-y-4 text-left max-w-lg mx-auto text-sm border-t border-[#C5A059]/20 pt-7">
            {/* Offerings */}
            {shop.services && (
              <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB] hover:border-[#D4AF37]/40 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Gem className="w-4 h-4 text-[#8A6815]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-[#8A6815] uppercase tracking-[0.2em] mb-1">
                    What We Offer
                  </p>
                  <p className="text-[#374151] leading-relaxed text-xs sm:text-sm font-medium">
                    {shop.services}
                  </p>
                </div>
              </div>
            )}

            {/* Proprietor & Phones Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB] hover:border-[#D4AF37]/40 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-[#8A6815]" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#8A6815] uppercase tracking-[0.2em]">
                    Proprietor
                  </p>
                  <p className="text-[#171717] font-semibold text-xs sm:text-sm mt-0.5">
                    {shop.owner_name}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB] hover:border-[#D4AF37]/40 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center shrink-0">
                  <Phone className="w-4 h-4 text-[#8A6815]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-[#8A6815] uppercase tracking-[0.2em]">
                    Primary Contact
                  </p>
                  <a
                    href={`tel:${primaryPhone}`}
                    className="text-[#171717] hover:text-[#8A6815] font-semibold text-xs sm:text-sm mt-0.5 block transition-colors"
                  >
                    +91 {primaryPhone}
                  </a>
                </div>
              </div>
            </div>

            {/* Shop Contact & Email Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB] hover:border-[#D4AF37]/40 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center shrink-0">
                  <Store className="w-4 h-4 text-[#8A6815]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-[#8A6815] uppercase tracking-[0.2em]">
                    Shop Contact
                  </p>
                  <a
                    href={`tel:${shopPhone}`}
                    className="text-[#171717] hover:text-[#8A6815] font-semibold text-xs sm:text-sm mt-0.5 block transition-colors"
                  >
                    +91 {shopPhone}
                  </a>
                </div>
              </div>

              {shop.email && (
                <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB] hover:border-[#D4AF37]/40 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-[#8A6815]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-[#8A6815] uppercase tracking-[0.2em]">
                      Email ID
                    </p>
                    <a
                      href={`mailto:${shop.email}`}
                      className="text-[#171717] hover:text-[#8A6815] font-semibold text-xs sm:text-sm mt-0.5 block truncate transition-colors"
                    >
                      {shop.email}
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Address */}
            {shop.address && (
              <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB] hover:border-[#D4AF37]/40 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-4 h-4 text-[#8A6815]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-[#8A6815] uppercase tracking-[0.2em] mb-1">
                    Store Address
                  </p>
                  <p className="text-[#374151] text-xs sm:text-sm leading-relaxed">
                    {shop.address}
                  </p>
                  <a
                    href="https://www.google.com/maps/search/?api=1&query=615A+Salem+Road+Namakkal+637212"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#8A6815] hover:underline mt-2"
                  >
                    Open in Google Maps <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}

            {/* Instagram & Hours */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {shop.instagram_url && (
                <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB] hover:border-[#D4AF37]/40 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center shrink-0">
                    <Camera className="w-4 h-4 text-[#8A6815]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-[#8A6815] uppercase tracking-[0.2em]">
                      Instagram
                    </p>
                    <a
                      href={shop.instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#8A6815] font-semibold text-xs sm:text-sm mt-0.5 block hover:underline truncate"
                    >
                      @nidhulan.official
                    </a>
                  </div>
                </div>
              )}

              {shop.business_hours && (
                <div className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB] hover:border-[#D4AF37]/40 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 text-[#8A6815]" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[#8A6815] uppercase tracking-[0.2em]">
                      Visiting Hours
                    </p>
                    <p className="text-[#171717] font-semibold text-xs sm:text-sm mt-0.5">
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
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#D4AF37] hover:bg-[#C5A02E] text-[#171717] font-bold text-xs uppercase tracking-wider transition-all shadow-sm border border-[#C5A02E]"
              >
                <Phone className="w-4 h-4" /> Call Store
              </a>
              <a
                href={`https://api.whatsapp.com/send?phone=91${primaryPhone}&text=Hello%20Ajay%20Kumar%20/%20NIDHULAN,%20I%20would%20like%20to%20inquire%20about%20your%20pearls.`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#F3F4F6] hover:bg-[#E5E7EB] border border-[#C5A059]/40 text-[#171717] font-bold text-xs uppercase tracking-wider transition-all"
              >
                <MessageCircle className="w-4 h-4 text-[#8A6815]" /> WhatsApp
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#C5A059]/15 py-6 text-center bg-white/90 backdrop-blur-md relative z-10 text-zinc-600">
        <p className="text-xs font-bold text-[#8A6815] tracking-[0.2em] uppercase">
          {shop.shop_name} • {shop.tagline || "THE PRECIOUS PEARLS"}
        </p>
        <p className="text-[10px] font-medium text-zinc-500 tracking-wider mt-1.5 uppercase">
          © {new Date().getFullYear()} {shop.owner_name} • Door No 615A, Salem Road, Namakkal – 637212
        </p>
      </footer>
    </div>
  );
}
