import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

/* Self-hosted Inter (body), Bodoni Moda (display) and Geist Mono (code), all SIL OFL 1.1, licences in ./fonts. No font CDN. */
const inter = localFont({
  src: "./fonts/Inter-latin-wght.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

const bodoni = localFont({
  src: "./fonts/BodoniModa-latin-wght.woff2",
  variable: "--font-bodoni",
  weight: "400 900",
  display: "swap",
});

const mono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ping when",
  description:
    "Sourcing is automated. Timing is not. Ranks the roster you import by when to reach out. Nothing is sent.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} ${bodoni.variable} h-full`}>
      <body className="min-h-full bg-[var(--paper)] text-[var(--ink)] antialiased">{children}</body>
    </html>
  );
}
