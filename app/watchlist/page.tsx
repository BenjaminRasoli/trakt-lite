"use client";

import { useEffect, useState, Suspense } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSupabase } from "@/components/supabase-provider";
import {
  getPosterUrl,
  getRandomBackdropUrl,
  getTrendingMedia,
} from "@/lib/tmdb";

interface WatchlistItem {
  id: string;
  mediaId: number;
  createdAt: string;
  media: {
    id: number;
    tmdbId: number;
    title: string;
    mediaType: "movie" | "tv";
    posterPath: string | null;
    backdropPath: string | null;
    overview: string | null;
    releaseDate: string | null;
  };
}

function WatchlistPageContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(true);
  const [pageBackdrop, setPageBackdrop] = useState("");
  const [isFilterChanging, setIsFilterChanging] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useSupabase();

  const filter = (searchParams.get("filter") as "all" | "movie" | "tv") || "all";

  const filteredWatchlist = watchlist.filter((item) => {
    if (filter === "all") return true;
    return item.media.mediaType === filter;
  });

  const handleTitleClick = (
    e: React.MouseEvent,
    tmdbId: number,
    mediaType: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/media/${tmdbId}?type=${mediaType}`);
  };

  const handleRemoveFromWatchlist = (
    e: React.MouseEvent,
    tmdbId: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setItemToDelete(tmdbId);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteWatchlist = async () => {
    if (!itemToDelete) return;

    try {
      const response = await fetch(`/api/watchlist?tmdbId=${itemToDelete}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setWatchlist((current) =>
          current.filter((item) => item.media.tmdbId !== itemToDelete),
        );
      }
    } catch (error) {
      console.error("Error removing from watchlist:", error);
    } finally {
      setShowDeleteConfirm(false);
      setItemToDelete(null);
    }
  };

  const fetchWatchlist = async () => {
    if (!user) return;

    setIsFilterChanging(true);

    try {
      const response = await fetch("/api/watchlist");

      if (!response.ok) {
        setWatchlist([]);
        return;
      }

      const data = await response.json();
      setWatchlist(Array.isArray(data.watchlist) ? data.watchlist : []);
    } catch (error) {
      console.error("Error fetching watchlist:", error);
      setWatchlist([]);
    } finally {
      setWatchlistLoading(false);
      setIsFilterChanging(false);
    }
  };

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
      void fetchWatchlist();
    } else {
      setWatchlist([]);
    }
  }, [user, filter]);

  useEffect(() => {
    if (!showDeleteConfirm) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowDeleteConfirm(false);
        setItemToDelete(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showDeleteConfirm]);

  useEffect(() => {
    const isAnyModalOpen = showDeleteConfirm;
    document.body.style.overflow = isAnyModalOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [showDeleteConfirm]);

  if (loading || (watchlistLoading && watchlist.length === 0)) {
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
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-violet-400/80">
              saved for later
            </p>
            <h1 className="text-3xl font-bold text-white md:text-4xl">
              Watchlist
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/80 p-1">
              <Link
                href="/watchlist?filter=all"
                className={`flex items-center cursor-pointer gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  filter === "all"
                    ? "bg-violet-500/20 text-violet-200"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
                All
              </Link>
              <Link
                href="/watchlist?filter=tv"
                className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  filter === "tv"
                    ? "bg-violet-500/20 text-violet-200"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
                  <polyline points="17 2 12 7 7 2" />
                </svg>
                TV
              </Link>
              <Link
                href="/watchlist?filter=movie"
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  filter === "movie"
                    ? "bg-violet-500/20 text-violet-200"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect
                    x="2"
                    y="2"
                    width="20"
                    height="20"
                    rx="2.18"
                    ry="2.18"
                  />
                  <line x1="7" y1="2" x2="7" y2="22" />
                  <line x1="17" y1="2" x2="17" y2="22" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <line x1="2" y1="7" x2="7" y2="7" />
                  <line x1="2" y1="17" x2="7" y2="17" />
                  <line x1="17" y1="17" x2="22" y2="17" />
                  <line x1="17" y1="7" x2="22" y2="7" />
                </svg>
                Movies
              </Link>
            </div>
            <Link
              href="/"
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20"
            >
              Back home
            </Link>
          </div>
        </div>

        {isFilterChanging ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3 text-violet-300">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-violet-300" />
              <span className="text-sm font-medium uppercase tracking-[0.2em]">
                Loading
              </span>
            </div>
          </div>
        ) : filteredWatchlist.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/60 p-12 text-center">
            <h2 className="text-2xl font-semibold text-white">
              {filter === "all" ? "Your watchlist is empty" : `No ${filter}s in watchlist`}
            </h2>
            <p className="mt-3 text-zinc-400">
              {filter === "all"
                ? "Add movies and TV shows you want to watch later."
                : `Add ${filter}s you want to watch later.`}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
            {filteredWatchlist.map((item) => {
              const releaseDate = item.media.releaseDate
                ? new Date(item.media.releaseDate)
                : null;

              return (
                <div
                  key={item.id}
                  className="group relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/80 transition hover:-translate-y-0.5 hover:border-violet-500/50"
                >
                  <Link
                    href={`/media/${item.media.tmdbId}?type=${item.media.mediaType}`}
                    className="block"
                  >
                    <div className="relative aspect-[2/3] overflow-hidden">
                      <img
                        src={getPosterUrl(item.media.posterPath || null)}
                        alt={item.media.title}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        onError={(e) => {
                          e.currentTarget.src = "/placeholder-poster.svg";
                        }}
                      />
                    </div>

                    <div className="space-y-1 border-t border-zinc-800 px-2 py-2">
                      {releaseDate && (
                        <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-violet-300">
                          {releaseDate.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>
                      )}
                      <div className="line-clamp-1 text-xs font-semibold text-white">
                        <span
                          onClick={(e) =>
                            handleTitleClick(
                              e,
                              item.media.tmdbId,
                              item.media.mediaType,
                            )
                          }
                          className="hover:underline hover:text-violet-200 transition-colors cursor-pointer"
                        >
                          {item.media.title}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-400 capitalize">
                        {item.media.mediaType}
                      </div>
                    </div>
                  </Link>

                  <button
                    onClick={(e) =>
                      handleRemoveFromWatchlist(e, item.media.tmdbId)
                    }
                    className="absolute top-2 right-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm opacity-60 transition-opacity hover:bg-red-500/80 hover:opacity-100 group-hover:opacity-100"
                    title="Remove from watchlist"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowDeleteConfirm(false);
              setItemToDelete(null);
            }
          }}
        >
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2">
              Remove from Watchlist
            </h3>
            <p className="text-zinc-300 mb-6">
              Are you sure you want to remove this item from your watchlist?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setItemToDelete(null);
                }}
                className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteWatchlist}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition cursor-pointer"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WatchlistPageWithSuspense() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-black text-white">Loading...</div>}>
      <WatchlistPageContent />
    </Suspense>
  );
}

export default WatchlistPageWithSuspense;
