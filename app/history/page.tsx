"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/components/supabase-provider";
import {
  getPosterUrl,
  getRandomBackdropUrl,
  getTrendingMedia,
} from "@/lib/tmdb";

interface HistoryResponse {
  items: HistoryItem[];
  hasMore: boolean;
}

interface HistoryItem {
  id: string;
  mediaId: number;
  watchedAt: string;
  seasonNumber: number | null;
  episodeNumber: number | null;
  episodeName: string | null;
  media: {
    id: number;
    tmdbId: number;
    title: string;
    mediaType: "movie" | "tv";
    posterPath: string | null;
    backdropPath: string | null;
    overview: string | null;
  };
}

const PAGE_SIZE = 42;

export default function HistoryPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [pageBackdrop, setPageBackdrop] = useState("");
  const router = useRouter();
  const supabase = useSupabase();
  const historyLengthRef = useRef(0);
  const isLoadingRef = useRef(false);

  const fetchHistory = useCallback(
    async (append = false) => {
      if (!user || isLoadingRef.current) return;

      isLoadingRef.current = true;
      setHistoryLoading(!append);
      setLoadingMore(append);

      try {
        const offset = append ? historyLengthRef.current : 0;
        const response = await fetch(
          `/api/watch-history?limit=${PAGE_SIZE}&offset=${offset}`,
        );

        if (!response.ok) {
          console.error(
            "API response not OK:",
            response.status,
            response.statusText,
          );
          if (!append) setHistory([]);
          setHasMore(false);
          return;
        }

        const data: HistoryResponse = await response.json();

        if (!data || !Array.isArray(data.items)) {
          console.error("Invalid API response format:", data);
          if (!append) setHistory([]);
          setHasMore(false);
          return;
        }

        setHistory((current) => {
          const newHistory = append ? [...current, ...data.items] : data.items;
          historyLengthRef.current = newHistory.length;
          return newHistory;
        });
        setHasMore(data.hasMore);
      } catch (error) {
        console.error("Error fetching history:", error);
        if (!append) setHistory([]);
        setHasMore(false);
      } finally {
        setHistoryLoading(false);
        setLoadingMore(false);
        isLoadingRef.current = false;
      }
    },
    [user],
  );

  useEffect(() => {
    let isMounted = true;

    const updateUser = (nextUser: User | null) => {
      setUser((currentUser) => {
        if (!nextUser) return null;
        if (currentUser?.id === nextUser.id) return currentUser;
        return nextUser;
      });
    };

    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!isMounted) return;
      updateUser(user);
      setLoading(false);
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      updateUser(session?.user ?? null);
    });

    const fetchBackdrop = async () => {
      const trendingMedia = await getTrendingMedia();
      if (!isMounted) return;
      setPageBackdrop(getRandomBackdropUrl(trendingMedia));
    };

    void fetchBackdrop();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (user) {
      void fetchHistory(false);
    } else {
      setHistory([]);
      setHasMore(false);
    }
  }, [user, fetchHistory]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    const handleScroll = () => {
      if (loadingMore || !hasMore || !user) return;

      if (timeoutId) clearTimeout(timeoutId);

      timeoutId = setTimeout(() => {
        const scrollHeight = document.documentElement.scrollHeight;
        const scrollTop = document.documentElement.scrollTop;
        const clientHeight = document.documentElement.clientHeight;

        const nearBottom = scrollTop + clientHeight >= scrollHeight - 500;

        if (nearBottom) {
          void fetchHistory(true);
        }
      }, 200);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [fetchHistory, loadingMore, hasMore, user]);

  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime(),
  );

  const handleLoadMore = () => {
    if (loadingMore || !hasMore || !user) return;
    void fetchHistory(true);
  };

  if (loading || historyLoading) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-black">
        <div className="flex items-center gap-3 text-violet-300">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-violet-300" />
          <span className="text-sm font-medium uppercase tracking-[0.2em]">
            Loading
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    router.push("/auth");
    return null;
  }

  return (
    <div className="relative min-h-screen bg-black text-white overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-black/70 via-black/40 to-black/80">
        {pageBackdrop && (
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-35"
            style={{ backgroundImage: `url(${pageBackdrop})` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/55 to-black/80" />
      </div>

      <main className="relative z-10 mx-auto w-full max-w-[1650px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-violet-400/80">
              your activity
            </p>
            <h1 className="text-3xl font-bold text-white md:text-4xl">
              Watch history
            </h1>
          </div>

          <Link
            href="/"
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20"
          >
            Back home
          </Link>
        </div>

        {sortedHistory.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/60 p-12 text-center">
            <h2 className="text-2xl font-semibold text-white">
              No watched items yet
            </h2>
            <p className="mt-3 text-zinc-400">
              Start tracking shows and movies from the homepage or media pages.
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
              {sortedHistory.map((entry) => {
                const watchedDate = new Date(entry.watchedAt);
                const label =
                  entry.seasonNumber !== null && entry.episodeNumber !== null
                    ? `S${entry.seasonNumber} • E${entry.episodeNumber}`
                    : entry.media.mediaType === "tv"
                      ? "TV"
                      : "Movie";

                return (
                  <Link
                    key={entry.id}
                    href={`/media/${entry.media.tmdbId}?type=${entry.media.mediaType}`}
                    className="group overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/80 transition hover:-translate-y-0.5 hover:border-violet-500/50"
                  >
                    <div className="relative aspect-[2/3] overflow-hidden">
                      <img
                        src={getPosterUrl(entry.media.posterPath || null)}
                        alt={entry.media.title}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        onError={(e) => {
                          e.currentTarget.src = "/placeholder-poster.svg";
                        }}
                      />
                    </div>

                    <div className="space-y-1 border-t border-zinc-800 px-2 py-2">
                      <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-violet-300">
                        {watchedDate.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                      <div className="line-clamp-1 text-xs font-semibold text-white">
                        {entry.media.title}
                      </div>
                      {entry.episodeName && (
                        <div className="line-clamp-1 text-[10px] text-zinc-300">
                          {entry.episodeName}
                        </div>
                      )}
                      <div className="text-[10px] text-zinc-400">{label}</div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {hasMore && (
              <div className="mt-8 flex justify-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="rounded-full border border-violet-500/40 bg-violet-500/10 px-5 py-2.5 text-sm font-semibold text-violet-200 transition hover:border-violet-400 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingMore ? "Loading..." : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
