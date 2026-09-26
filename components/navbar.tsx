"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSupabase } from "./supabase-provider";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useSupabase();
  const router = useRouter();

  useEffect(() => {
    const updateUser = (nextUser: any) => {
      setUser((currentUser: any) => {
        if (!nextUser) return null;
        if (currentUser?.id === nextUser.id) return currentUser;
        return nextUser;
      });
    };

    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      updateUser(user);
      setLoading(false);
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      updateUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth");
  };

  const username =
    user?.user_metadata?.username || user?.email?.split("@")[0] || "User";
  const capitalizedUsername =
    username.charAt(0).toUpperCase() + username.slice(1);

  return (
    <nav className="sticky top-0 z-40 border-b border-zinc-700/50 bg-zinc-950/85 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-0 sm:h-16">
          <div className="flex flex-wrap items-center gap-2 sm:gap-8">
            <Link
              href="/"
              className="text-xl font-bold text-white transition-colors hover:text-violet-400 sm:text-2xl"
            >
              Trakt <span className="text-violet-400">Lite</span>
            </Link>
            {user && (
              <>
                <Link
                  href="/new"
                  className="text-sm font-medium text-zinc-300 transition-colors hover:text-violet-400 sm:text-base"
                >
                  New
                </Link>
                <Link
                  href="/next-up"
                  className="text-sm font-medium text-zinc-300 transition-colors hover:text-violet-400 sm:text-base"
                >
                  Next Up
                </Link>
                <Link
                  href="/calendar"
                  className="text-sm font-medium text-zinc-300 transition-colors hover:text-violet-400 sm:text-base"
                >
                  Calendar
                </Link>
                <Link
                  href="/history"
                  className="text-sm font-medium text-zinc-300 transition-colors hover:text-violet-400 sm:text-base"
                >
                  History
                </Link>
                <Link
                  href="/profile"
                  className="text-sm font-medium text-zinc-300 transition-colors hover:text-violet-400 sm:text-base"
                >
                  Profile
                </Link>
                <Link
                  href="/settings"
                  className="text-sm font-medium text-zinc-300 transition-colors hover:text-violet-400 sm:text-base"
                >
                  Settings
                </Link>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
            {loading ? (
              <div className="flex items-center gap-2 text-violet-300">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-violet-300" />
                <span className="text-[10px] font-medium uppercase tracking-[0.2em] sm:text-xs">
                  Loading
                </span>
              </div>
            ) : user ? (
              <>
                <div className="max-w-[150px] truncate text-xs text-zinc-300 sm:max-w-none sm:text-sm">
                  Welcome back,{" "}
                  <span className="font-semibold text-violet-400">
                    {capitalizedUsername}
                  </span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20 sm:px-4 sm:py-2 sm:text-sm"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                href="/auth"
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 shadow-lg shadow-violet-500/10 transition hover:border-violet-400 hover:bg-violet-500/20"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
