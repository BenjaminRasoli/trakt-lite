"use client";

import { useState, useEffect } from "react";
import { useSupabase } from "@/components/supabase-provider";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import MediaCard from "@/components/media-card";
import { searchMedia } from "@/lib/tmdb";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const supabase = useSupabase();
  const router = useRouter();
  const searchParams = useSearchParams();

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

  useEffect(() => {
    const query = searchParams.get("q");
    if (query) {
      setSearchQuery(query);
      setSearching(true);
      searchMedia(query).then((results) => {
        setSearchResults(results);
        setSearching(false);
      });
    }
  }, [searchParams]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    router.push(`/?q=${encodeURIComponent(searchQuery)}`);
    setSearching(true);
    const results = await searchMedia(searchQuery);
    setSearchResults(results);
    setSearching(false);
  };

  const username = user?.user_metadata?.username || user?.email?.split("@")[0] || "User";
  const capitalizedUsername = username.charAt(0).toUpperCase() + username.slice(1);

  if (loading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center font-sans min-h-screen bg-black">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center font-sans min-h-screen relative overflow-hidden">
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage:
              "url(https://image.tmdb.org/t/p/original/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80"></div>
        </div>

        <main className="relative z-10 flex flex-col items-center justify-center w-full max-w-4xl px-8 py-16 gap-12 flex-1">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
              Trakt Lite
            </h1>
            <p className="text-xl text-zinc-300 max-w-2xl mb-8">
              Track your favorite movies and TV shows
            </p>
            <Link
              href="/auth"
              className="inline-block cursor-pointer px-8 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-violet-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-violet-500/25"
            >
              Get Started
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 items-center font-sans min-h-screen bg-black">
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex-1">
        <div className="mb-12">
          <div className="flex items-center gap-4 mb-8">
            <h1 className="text-3xl font-bold text-white">Welcome</h1>
            <p className="text-3xl text-violet-400 font-semibold">{capitalizedUsername}</p>
          </div>

          <form onSubmit={handleSearch} className="flex gap-4 max-w-2xl">
            <input
              type="text"
              placeholder="Search for movies and TV shows..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-6 py-4 bg-zinc-800/50 border border-zinc-600/50 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent transition-all text-lg"
            />
            <button
              type="submit"
              disabled={searching}
              className="px-8 py-4 cursor-pointer bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-violet-500/25"
            >
              {searching ? "Searching..." : "Search"}
            </button>
          </form>
        </div>

        {searchResults.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">Search Results</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {searchResults.map((media) => (
                <MediaCard key={media.id} media={media} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
