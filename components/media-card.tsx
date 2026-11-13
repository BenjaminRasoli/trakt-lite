"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getPosterUrl,
  getMediaTitle,
  getMediaDate,
  getMediaType,
} from "@/lib/tmdb";
import type { TMDBMedia } from "@/lib/tmdb";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/components/supabase-provider";
import WatchlistButton from "@/components/watchlist-button";
import WatchlistRemoveModal from "@/components/watchlist-remove-modal";
import {
  getWatchlistIds,
  notifyWatchlistChanged,
} from "@/components/watchlist-state";
import { getWatchedIds } from "@/components/watched-state";

interface MediaCardProps {
  media: TMDBMedia;
  subtitle?: string;
  hideGenres?: boolean;
}

const GENRE_MAP: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
};

export default function MediaCard({ media, subtitle, hideGenres = false }: MediaCardProps) {
  const router = useRouter();
  const supabase = useSupabase();
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [isWatched, setIsWatched] = useState(false);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const title = getMediaTitle(media);
  const date = getMediaDate(media);
  const mediaType = getMediaType(media);
  const posterUrl = getPosterUrl(media.poster_path);
  const rating =
    typeof media.vote_average === "number"
      ? media.vote_average.toFixed(1)
      : "N/A";
  const genres = (media.genre_ids ?? [])
    .slice(0, 3)
    .map((id) => GENRE_MAP[id])
    .filter(Boolean);

  const typeToUse = media.media_type || mediaType;

  useEffect(() => {
    let isMounted = true;
    let currentUserId: string | null = null;

    const syncWatched = async (userId: string | null) => {
      if (!userId) {
        setIsWatched(false);
        return;
      }

      try {
        const ids = await getWatchedIds(userId);
        if (isMounted) setIsWatched(ids.has(media.id));
      } catch (error) {
        console.error("Error checking media card watched status:", error);
      }
    };

    const syncWatchlist = async (userId: string | null) => {
      currentUserId = userId;
      void syncWatched(userId);
      if (!userId) {
        setIsInWatchlist(false);
        return;
      }

      try {
        const ids = await getWatchlistIds(userId);
        if (isMounted) setIsInWatchlist(ids.has(media.id));
      } catch (error) {
        console.error("Error checking media card watchlist:", error);
      }
    };

    const getUser = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error) throw error;
      if (isMounted) void syncWatchlist(user?.id ?? null);
    };

    const handleWatchedUpdate = () => {
      if (!currentUserId) return;
      void getWatchedIds(currentUserId)
        .then((ids) => {
          if (isMounted) setIsWatched(ids.has(media.id));
        })
        .catch((error: unknown) => {
          console.error("Error refreshing media card watched status:", error);
        });
    };

    const handleWatchlistUpdate = () => {
      if (!currentUserId) return;
      void getWatchlistIds(currentUserId)
        .then((ids) => {
          if (isMounted) setIsInWatchlist(ids.has(media.id));
        })
        .catch((error: unknown) => {
          console.error("Error refreshing media card watchlist:", error);
        });
    };

    void getUser().catch((error: unknown) => {
        console.error("Error checking current user for media card:", error);
    });
    const {
        data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
        void syncWatchlist(session?.user.id ?? null);
    });
    window.addEventListener("watchlist-updated", handleWatchlistUpdate);
    window.addEventListener("watch-history-updated", handleWatchedUpdate);

    return () => {
        isMounted = false;
        subscription.unsubscribe();
        window.removeEventListener("watchlist-updated", handleWatchlistUpdate);
        window.removeEventListener("watch-history-updated", handleWatchedUpdate);
    };
  }, [media.id, supabase]);

  const handleWatchlistButtonClick = async () => {
    if (isInWatchlist) {
      setWatchlistError(null);
      setShowRemoveConfirm(true);
      return;
    }

    setWatchlistLoading(true);
    setWatchlistError(null);

    try {
      const response = await fetch("/api/watchlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tmdbId: media.id,
          mediaType: typeToUse,
        }),
      });

      if (response.status === 401) {
        router.push("/auth");
        return;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to add to watchlist.");
      }

      setIsInWatchlist(true);
      notifyWatchlistChanged();
    } catch (error) {
      console.error("Error adding media card to watchlist:", error);
      setWatchlistError(
        error instanceof Error ? error.message : "Failed to add to watchlist.",
      );
    } finally {
      setWatchlistLoading(false);
    }
  };

  const handleConfirmRemove = async () => {
    setWatchlistLoading(true);
    setWatchlistError(null);

    try {
      const response = await fetch(`/api/watchlist?tmdbId=${media.id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (response.status === 401) {
        router.push("/auth");
        return;
      }
      if (!response.ok) {
        throw new Error(data.error || "Failed to remove from watchlist.");
      }

      setIsInWatchlist(false);
      setShowRemoveConfirm(false);
      notifyWatchlistChanged();
    } catch (error) {
      console.error("Error removing media card from watchlist:", error);
      setWatchlistError(
        error instanceof Error
          ? error.message
          : "Failed to remove from watchlist.",
      );
    } finally {
      setWatchlistLoading(false);
    }
  };

  const cancelRemoveConfirm = useCallback(() => {
    if (watchlistLoading) return;
    setShowRemoveConfirm(false);
    setWatchlistError(null);
  }, [watchlistLoading]);

  return (
    <>
      <div className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-zinc-700/50 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 backdrop-blur-sm transition-all hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-500/10">
        <Link href={`/media/${media.id}?type=${typeToUse}`} className="block flex-1">
          <div className="relative aspect-[2/3] overflow-hidden">
            <img
              src={posterUrl}
              alt={title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={(e) => {
                e.currentTarget.src = "/placeholder-poster.svg";
              }}
            />
            <div className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-violet-400 backdrop-blur-sm">
              {mediaType}
            </div>
            {isWatched && (
              <div
                className="absolute bottom-2 left-2 flex h-5 w-5 items-center justify-center rounded bg-violet-600/60 text-violet-100 shadow-sm backdrop-blur-sm"
                title="Watched"
                aria-label="Watched"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            )}
          </div>

          <div className="p-3">
            <h3 className="mb-1.5 line-clamp-1 text-sm font-bold text-white">
              {title}
            </h3>

            {(subtitle || hideGenres) && (
              <p
                className={`mb-1.5 line-clamp-2 break-words text-xs leading-relaxed text-zinc-400 ${
                  hideGenres ? "min-h-10" : ""
                }`}
              >
                {subtitle}
              </p>
            )}

            <div className="mb-1.5 flex flex-col items-start gap-1.5 md:flex-row md:items-center">
              <div className="flex items-center gap-0.5">
                <span className="text-xs text-yellow-400">★</span>
                <span className="text-xs text-zinc-300">{rating}</span>
              </div>
              <span className="hidden text-xs text-zinc-500 md:block">•</span>
              <span className="text-xs text-zinc-400">{date}</span>
            </div>

            {!hideGenres && (
              <div className="flex flex-wrap gap-1.5">
                {genres.slice(0, 2).map((genre, index) => (
                  <span
                    key={`${genre}-${index}`}
                    className="rounded bg-zinc-700/50 px-1.5 py-0.5 text-[10px] text-zinc-300"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Link>
        {watchlistError && !showRemoveConfirm && (
          <p role="alert" className="px-3 pb-3 text-center text-xs text-red-300">
            {watchlistError}
          </p>
        )}
        <WatchlistButton
          isInWatchlist={isInWatchlist}
          loading={watchlistLoading}
          itemTitle={title}
          onClick={handleWatchlistButtonClick}
        />
      </div>
      <WatchlistRemoveModal
        itemTitle={showRemoveConfirm ? title : null}
        loading={watchlistLoading}
        error={watchlistError}
        onCancel={cancelRemoveConfirm}
        onConfirm={handleConfirmRemove}
      />
    </>
  );
}
