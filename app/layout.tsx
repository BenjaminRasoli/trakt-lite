import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SupabaseProvider from "@/components/supabase-provider";
import Navbar from "@/components/navbar";
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
  icons: {
    icon: "/favicon.svg",
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
          <Navbar />
          {children}
        </SupabaseProvider>
      </body>
    </html>
  );
}
