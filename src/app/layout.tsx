import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Digital Udaan Technologies | Secure Geofenced Survey & Voting",
  description:
    "Production-grade voter survey application with geofence verification and cryptographic SHA-256 ballot integrity.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
        <Providers>
          <Nav />
          <main className="flex-1 container mx-auto px-4 sm:px-6 py-8">
            {children}
          </main>
          <footer className="border-t border-zinc-200 dark:border-zinc-800 py-6 text-center text-xs text-zinc-500">
            <p>Digital Udaan Technologies Platform &copy; 2026. Cryptographically audited, geofenced voter verification.</p>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
