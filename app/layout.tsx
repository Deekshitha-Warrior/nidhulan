import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import PWAHandler from "./components/PWAHandler";
import { getShopSettings, shopLogoSrc, accentCssVars, normalizeHex, DEFAULT_ACCENT } from "@/lib/shopSettings";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export async function generateViewport(): Promise<Viewport> {
  const shop = await getShopSettings();
  return {
    themeColor: normalizeHex(shop.accent_color) || DEFAULT_ACCENT,
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  };
}

// Shop profile drives the installed-app name and icon.
export async function generateMetadata(): Promise<Metadata> {
  const shop = await getShopSettings();
  const logo = shopLogoSrc(shop);

  return {
    title: `${shop.shop_name} - POS`,
    description: `${shop.shop_name} Billing, Inventory & Digital Invoices`,
    manifest: "/manifest.json",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: shop.shop_name,
    },
    icons: {
      icon: logo,
      apple: logo,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const shop = await getShopSettings();
  const logo = shopLogoSrc(shop);

  return (
    <html
      lang="en"
      className={`${poppins.variable} h-full antialiased`}
      style={accentCssVars(shop.accent_color) as React.CSSProperties}
      suppressHydrationWarning
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={shop.shop_name} />
        <link rel="apple-touch-icon" href={logo} />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var c=localStorage.getItem("nidhulan_accent_color");if(c&&/^#[0-9A-Fa-f]{3,6}$/.test(c)){var r=document.documentElement;r.style.setProperty("--accent",c);r.style.setProperty("--accent-strong","color-mix(in srgb, "+c+" 82%, #000000)");r.style.setProperty("--accent-soft","color-mix(in srgb, "+c+" 22%, #FFFFFF)");r.style.setProperty("--accent-softer","color-mix(in srgb, "+c+" 10%, #FFFFFF)");r.style.setProperty("--accent-wash","color-mix(in srgb, "+c+" 12%, #FFFFFF)");var h=c.replace("#","");if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];var n=parseInt(h,16);var lum=(0.2126*(n>>16)+0.7152*((n>>8)&255)+0.0722*(n&255))/255;r.style.setProperty("--accent-on",lum>0.45?"#1C1917":"#FFFFFF");}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
        <PWAHandler shopName={shop.shop_name} logo={logo} />
      </body>
    </html>
  );
}
