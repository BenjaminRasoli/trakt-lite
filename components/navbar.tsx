"use client";

import { useState, useEffect } from "react";
import { useSupabase } from "./supabase-provider";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useSupabase();
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth");
  };

  const username = user?.user_metadata?.username || user?.email?.split("@")[0] || "User";

  return (
    <nav className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 border-b border-zinc-700/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <a
              href="/"
              className="text-2xl font-bold text-white hover:text-violet-400 transition-colors cursor-pointer"
            >
              Trakt Lite
            </a>
          </div>

          <div className="flex items-center gap-4">
            {loading ? (
              <div className="text-zinc-400">Loading...</div>
            ) : user ? (
              <>
                <div className="text-zinc-300">
                  Welcome back, <span className="text-violet-400 font-semibold">{username}</span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 cursor-pointer bg-zinc-700/50 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-all text-sm"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <a
                href="/auth"
                className="px-4 py-2 cursor-pointer bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-violet-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-violet-500/25"
              >
                Sign In
              </a>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}