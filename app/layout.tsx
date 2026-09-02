import type { Metadata, Viewport } from "next";
import { DM_Sans, DM_Serif_Display } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });
const dmSerif = DM_Serif_Display({ subsets: ["latin"], weight: "400", variable: "--font-dm-serif" });

// Appliqué avant le premier rendu pour éviter un flash de thème clair.
const THEME_SCRIPT = `(function(){var t="dark";try{if(localStorage.getItem("sumeria-theme")==="light")t="light"}catch(e){}document.documentElement.setAttribute("data-theme",t)})();`;

export const metadata: Metadata = {
  title: "My Sumeria",
  description: "Suivi des entrées/sorties du sous-compte",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "My Sumeria",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a3440",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="fr"
      data-theme="dark"
      suppressHydrationWarning
      className={`${dmSans.variable} ${dmSerif.variable} font-sans`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      {/* suppressHydrationWarning : des extensions (ColorZilla, Grammarly…) ajoutent des attributs sur <body> */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
