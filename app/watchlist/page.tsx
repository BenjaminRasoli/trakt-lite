"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSupabase } from "@/components/supabase-provider";
import {
  getPosterUrl,
  getRandomBackdropUrl,
  getTrendingMedia,
} from "@/lib/tmdb";
import WatchlistButton from "@/components/watchlist-button";
import MediaFilterTabs from "@/components/media-filter-tabs";
import WatchlistRemoveModal from "@/components/watchlist-remove-modal";
import { notifyWatchlistChanged } from "@/components/watchlist-state";

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
  const [itemToDelete, setItemToDelete] = useState<WatchlistItem | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useSupabase();

  const requestedFilter = searchParams.get("filter");
  const urlFilter =
    requestedFilter === "movie" || requestedFilter === "tv"
      ? requestedFilter
      : "all";
  const [activeFilter, setActiveFilter] = useState<"all" | "movie" | "tv">(
    urlFilter,
  );
  const [prevUrlFilter, setPrevUrlFilter] = useState(urlFilter);
  if (prevUrlFilter !== urlFilter) {
    setPrevUrlFilter(urlFilter);
    setActiveFilter(urlFilter);
  }
  const filter = activeFilter;

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

  const handleRemoveFromWatchlist = (item: WatchlistItem) => {
    setItemToDelete(item);
    setRemoveError(null);
  };

  const confirmDeleteWatchlist = async () => {
    if (!itemToDelete || isRemoving) return;

    setIsRemoving(true);
    setRemoveError(null);
    try {
      const response = await fetch(
        `/api/watchlist?tmdbId=${itemToDelete.media.tmdbId}`,
        {
          method: "DELETE",
        },
      );
      const data = await response.json();

      if (response.status === 401) {
        router.push("/auth");
        return;
      }
      if (!response.ok) {
        throw new Error(data.error || "Failed to remove from watchlist.");
      }

      setWatchlist((current) =>
        current.filter(
          (item) => item.media.tmdbId !== itemToDelete.media.tmdbId,
        ),
      );
      notifyWatchlistChanged();
      setItemToDelete(null);
    } catch (error) {
      console.error("Error removing from watchlist:", error);
      setRemoveError(
        error instanceof Error
          ? error.message
          : "Failed to remove from watchlist.",
      );
    } finally {
      setIsRemoving(false);
    }
  };

  const cancelDeleteWatchlist = useCallback(() => {
    if (isRemoving) return;
    setItemToDelete(null);
    setRemoveError(null);
  }, [isRemoving]);

  useEffect(() => {
    let isMounted = true;

    const updateUser = (nextUser: User | null) => {
      if (!nextUser) {
        setWatchlist([]);
      }
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
    if (!user) return;

    let isMounted = true;
    fetch("/api/watchlist")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch watchlist.");
        }
        return Array.isArray(data.watchlist) ? data.watchlist : [];
      })
      .then((data: WatchlistItem[]) => {
        if (isMounted) setWatchlist(data);
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        console.error("Error fetching watchlist:", error);
        setWatchlist([]);
      })
      .finally(() => {
        if (isMounted) setWatchlistLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user, filter]);

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
            <MediaFilterTabs
              value={filter}
              onChange={(next) => {
                setActiveFilter(next);
                window.history.replaceState(
                  null,
                  "",
                  `/watchlist?filter=${next}`,
                );
              }}
              className={watchlist.length === 0 ? "hidden" : ""}
            />
            <Link
              href="/"
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20"
            >
              Back home
            </Link>
          </div>
        </div>

        {watchlistLoading ? (
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
          <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {filteredWatchlist.map((item) => {
              const releaseDate = item.media.releaseDate
                ? new Date(item.media.releaseDate)
                : null;

              return (
                <div
                  key={item.id}
                  className="group relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/80 transition hover:border-violet-500/50"
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
                      <div className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-violet-400 backdrop-blur-sm">
                        {item.media.mediaType}
                      </div>
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
                    </div>
                  </Link>

                  <WatchlistButton
                    isInWatchlist
                    itemTitle={item.media.title}
                    onClick={() => handleRemoveFromWatchlist(item)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </main>

      <WatchlistRemoveModal
        itemTitle={itemToDelete?.media.title ?? null}
        loading={isRemoving}
        error={removeError}
        onCancel={cancelDeleteWatchlist}
        onConfirm={confirmDeleteWatchlist}
      />
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
