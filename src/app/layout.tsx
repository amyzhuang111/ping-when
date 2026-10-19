import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

/* Self-hosted Geist and Bodoni Moda (both SIL OFL 1.1, licences in ./fonts), no font CDN. */
const sans = localFont({
  src: "./fonts/Geist-Variable.woff2",
  variable: "--font-geist",
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
    <html lang="en" className={`${sans.variable} ${mono.variable} ${bodoni.variable} h-full`}>
      <body className="min-h-full bg-white text-[#0a0a0a] antialiased">{children}</body>
    </html>
  );
}
