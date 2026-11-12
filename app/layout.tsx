import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SupabaseProvider from "@/components/supabase-provider";
import NavbarServer from "@/components/navbar-server";
import ScrollToTop from "@/components/scroll-to-top";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Trakt Lite - Track Movies & TV Shows",
  description: "Track your favorite movies and TV shows with Trakt Lite",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.svg",
    apple: [
      { url: "/favicon.svg", sizes: "any" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Trakt Lite",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-black text-white">
        <SupabaseProvider>
          <ScrollToTop />
          <Suspense fallback={null}>
            <NavbarServer />
          </Suspense>
          {children}
        </SupabaseProvider>
      </body>
    </html>
  );
}
