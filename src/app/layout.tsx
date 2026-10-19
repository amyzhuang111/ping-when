import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

/* Self-hosted Geist and Geist Mono (SIL OFL 1.1, licence in ./fonts/Geist-OFL.txt). No font CDN. */
const sans = localFont({
  src: "./fonts/Geist-Variable.woff2",
  variable: "--font-geist",
  weight: "100 900",
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
    <html lang="en" className={`${sans.variable} ${mono.variable} h-full`}>
      <body className="min-h-full bg-[var(--paper)] text-[var(--body)] antialiased">{children}</body>
    </html>
  );
}
