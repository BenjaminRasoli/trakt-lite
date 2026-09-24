import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Auth - Trakt Lite",
  description: "Sign in or create an account to track movies and TV shows",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}