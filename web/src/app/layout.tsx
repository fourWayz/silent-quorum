import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { MotionProvider } from "@/components/motion-provider";

// Self-hosted at build time by next/font — no runtime request to Google
// Fonts, no external font CDN in production. Three distinct faces, each
// with one job: an editorial display serif for the protocol's voice, a
// humanist sans for interface text, and a technical mono for anything
// that is cryptographic data (hashes, ids, counters).
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz", "SOFT", "WONK"],
  display: "swap"
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap"
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap"
});

export const metadata: Metadata = {
  title: {
    default: "Silent Quorum — Atomic Threshold-Ignition Protocol",
    template: "%s · Silent Quorum"
  },
  description:
    "Private signals. Public consequence. Silent Quorum is an atomic threshold-ignition protocol for privacy-preserving collective action on Midnight.",
  metadataBase: undefined
};

export const viewport: Viewport = {
  themeColor: "#0a0c0f",
  colorScheme: "dark"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${manrope.variable} ${plexMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-ink-950 text-paper antialiased selection:bg-signal-600">
        <a
          href="#main-content"
          className="fixed left-3 top-3 z-[200] -translate-y-16 rounded-md bg-signal-400 px-4 py-2 text-sm font-medium text-ink-950 transition-transform focus:translate-y-0"
        >
          Skip to content
        </a>
        <div className="grain-overlay" aria-hidden="true" />
        <MotionProvider>
          <SiteHeader />
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </MotionProvider>
      </body>
    </html>
  );
}
