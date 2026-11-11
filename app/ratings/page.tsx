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

interface RatingItem {
  id: string;
  subjectKey: string;
  seasonNumber: number | null;
  episodeNumber: number | null;
  score: number;
  updatedAt: string;
  seasonPosterPath: string | null;
  seasonName: string | null;
  episodeName: string | null;
  media: {
    tmdbId: number;
    title: string;
    mediaType: "movie" | "tv";
    posterPath: string | null;
  };
}

function RatingsPageContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [ratingsResult, setRatingsResult] = useState<{
    userId: string;
    items: RatingItem[];
    errorMessage: string | null;
  } | null>(null);
  const [visibleCount, setVisibleCount] = useState(42);
  const [pageBackdrop, setPageBackdrop] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useSupabase();

  const requestedFilter = searchParams.get("filter");
  const filter =
    requestedFilter === "movie" || requestedFilter === "tv"
      ? requestedFilter
      : "all";
  const currentRatingsResult =
    ratingsResult?.userId === user?.id ? ratingsResult : null;
  const ratings = currentRatingsResult?.items ?? [];
  const errorMessage = currentRatingsResult?.errorMessage ?? null;
  const filteredRatings = ratings.filter(
    (rating) => filter === "all" || rating.media.mediaType === filter,
  );
  const visibleRatings = filteredRatings.slice(0, visibleCount);

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
        data: { user: authenticatedUser },
      } = await supabase.auth.getUser();
      if (!isMounted) return;
      updateUser(authenticatedUser);
      setLoading(false);
    };

    void getUser().catch((error: unknown) => {
      console.error("Error checking current user on ratings page:", error);
      if (isMounted) setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) updateUser(session?.user ?? null);
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

    const controller = new AbortController();

    const fetchRatings = async () => {
      try {
        const response = await fetch("/api/ratings", {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Could not load your ratings.");
        }
        if (!Array.isArray(data.items)) {
          throw new Error("The ratings response was invalid.");
        }
        setRatingsResult({
          userId: user.id,
          items: data.items,
          errorMessage: null,
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Error fetching ratings:", error);
        setRatingsResult({
          userId: user.id,
          items: [],
          errorMessage: "Your ratings could not be loaded. Please try again.",
        });
      }
    };

    void fetchRatings();
    return () => controller.abort();
  }, [user]);

  if (loading || (user && !currentRatingsResult)) {
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
    <div className="relative min-h-screen overflow-x-hidden bg-black text-white">
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
              your activity
            </p>
            <h1 className="text-3xl font-bold text-white md:text-4xl">
              Your ratings
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/80 p-1 ${
                ratings.length === 0 ? "hidden" : ""
              }`}
            >
              {(
                [
                  ["all", "All"],
                  ["tv", "TV"],
                  ["movie", "Movies"],
                ] as const
              ).map(([value, label]) => (
                <Link
                  key={value}
                  href={value === "all" ? "/ratings" : `/ratings?filter=${value}`}
                  onClick={() => setVisibleCount(42)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    filter === value
                      ? "bg-violet-500/20 text-violet-200"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {value === "all" ? (
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
                  ) : value === "tv" ? (
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
                  ) : (
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
                  )}
                  {label}
                </Link>
              ))}
            </div>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20"
            >
              Back home
            </Link>
          </div>
        </div>

        {errorMessage ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-500/30 bg-red-950/30 p-8 text-center text-red-200"
          >
            {errorMessage}
          </div>
        ) : filteredRatings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/60 p-12 text-center">
            <h2 className="text-2xl font-semibold text-white">
              No ratings yet
            </h2>
            <p className="mt-3 text-zinc-400">
              Rate movies and shows you have watched to see them here.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
              {visibleRatings.map((rating) => {
                const isTv = rating.media.mediaType === "tv";
                const isSeason = isTv && rating.seasonNumber !== null;
                const isEpisode = isSeason && rating.episodeNumber !== null;
                const imagePath = isSeason
                  ? rating.seasonPosterPath || rating.media.posterPath
                  : rating.media.posterPath;
                const href = isEpisode
                  ? `/media/${rating.media.tmdbId}/season/${rating.seasonNumber}/episode/${rating.episodeNumber}?type=tv`
                  : isSeason
                    ? `/media/${rating.media.tmdbId}/season/${rating.seasonNumber}?type=tv`
                    : `/media/${rating.media.tmdbId}?type=${rating.media.mediaType}`;

                const seasonLabel =
                  rating.seasonNumber === 0
                  ? "Season 0"
                    : `Season ${rating.seasonNumber}`;
                const subtitle = isEpisode
                  ? rating.episodeName || `Episode ${rating.episodeNumber}`
                  : isSeason
                    ? rating.seasonName || seasonLabel
                    : null;

                return (
                  <Link
                    key={rating.id}
                    href={href}
                    aria-label={`${rating.media.title}${subtitle ? `, ${subtitle}` : ""}, rated ${rating.score.toFixed(1)} out of 10`}
                    className="group flex h-full flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/80 transition hover:-translate-y-0.5 hover:border-violet-500/50"
                  >
                    <div className="relative aspect-[2/3] shrink-0 overflow-hidden">
                      <img
                        src={getPosterUrl(imagePath)}
                        alt={
                          isSeason
                            ? `${rating.media.title} ${seasonLabel}`
                            : rating.media.title
                        }
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        onError={(event) => {
                          event.currentTarget.src = "/placeholder-poster.svg";
                        }}
                      />
                    </div>
                    <div className="h-20 shrink-0 border-t border-zinc-800 px-2 py-1.5">
                      <div className="h-4 text-[10px] font-semibold text-violet-200">
                        ★ {rating.score.toFixed(1)}
                      </div>
                      <div className="h-4 truncate text-xs font-semibold text-white">
                        {rating.media.title}
                      </div>
                      {subtitle && (
                        <div className="h-4 truncate text-[10px] text-zinc-300">
                          {subtitle}
                        </div>
                      )}
                      {isEpisode && (
                        <div className="h-4 text-[10px] text-zinc-400">
                          S{rating.seasonNumber} • E{rating.episodeNumber}
                        </div>
                      )}
                      {isSeason && !isEpisode && (
                        <div className="h-4 text-[10px] text-zinc-400">
                          {seasonLabel}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
            {visibleCount < filteredRatings.length && (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((count) => count + 42)}
                  className="rounded-full border border-violet-500/40 bg-violet-500/10 px-5 py-2.5 text-sm font-semibold text-violet-200 transition hover:border-violet-400 hover:bg-violet-500/20"
                >
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function RatingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black text-white">
          Loading...
        </div>
      }
    >
      <RatingsPageContent />
    </Suspense>
  );
}
