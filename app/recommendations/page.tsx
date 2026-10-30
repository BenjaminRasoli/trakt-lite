"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MediaCard from "@/components/media-card";
import { useSupabase } from "@/components/supabase-provider";
import {
  getMediaType,
  getRandomBackdropUrl,
} from "@/lib/tmdb";
import type { TMDBMedia } from "@/lib/tmdb";

type Recommendation = TMDBMedia & {
  recommendationReason: string;
  recommendationScore: number;
};

type RecommendationSeed = {
  tmdbId: number;
  title: string;
  mediaType: "movie" | "tv";
};

const INITIAL_RESULT_COUNT = 18;
const RESULTS_PER_SCROLL = 18;

const MEDIA_FILTERS = [
  { value: "all", label: "All", icon: "grid" },
  { value: "tv", label: "TV", icon: "tv" },
  { value: "movie", label: "Movies", icon: "movie" },
] as const;

const MEDIA_SORTS = [
  { value: "relevance", label: "Best match" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "az", label: "A–Z" },
  { value: "za", label: "Z–A" },
] as const;

export default function RecommendationsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [basedOn, setBasedOn] = useState<RecommendationSeed[]>([]);
  const [hasWatchHistory, setHasWatchHistory] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [mediaFilter, setMediaFilter] =
    useState<(typeof MEDIA_FILTERS)[number]["value"]>("all");
  const [mediaSort, setMediaSort] =
    useState<(typeof MEDIA_SORTS)[number]["value"]>("relevance");
  const [showSort, setShowSort] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_RESULT_COUNT);
  const [pageBackdrop, setPageBackdrop] = useState("");

  const supabase = useSupabase();
  const router = useRouter();
  const sortRef = useRef<HTMLDivElement>(null);
  const resultsEndRef = useRef<HTMLDivElement>(null);

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
      try {
        const {
          data: { user: authenticatedUser },
        } = await supabase.auth.getUser();
        if (!isMounted) return;
        updateUser(authenticatedUser);
      } catch (authError) {
        console.error("Error checking authentication:", authError);
      } finally {
        if (isMounted) setAuthLoading(false);
      }
    };

    void getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) updateUser(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/auth");
    }
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user) return;

    const controller = new AbortController();

    async function fetchRecommendations() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/recommendations", {
          signal: controller.signal,
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Could not load recommendations.");
        }

        const results = Array.isArray(data.recommendations)
          ? (data.recommendations as Recommendation[])
          : [];
        setRecommendations(results);
        setBasedOn(Array.isArray(data.basedOn) ? data.basedOn : []);
        setHasWatchHistory(data.hasWatchHistory === true);
        setPageBackdrop(getRandomBackdropUrl(results));
        setVisibleCount(INITIAL_RESULT_COUNT);
      } catch (fetchError) {
        if (
          fetchError instanceof DOMException &&
          fetchError.name === "AbortError"
        ) {
          return;
        }
        console.error("Error loading recommendations:", fetchError);
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Could not load recommendations.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void fetchRecommendations();
    return () => controller.abort();
  }, [retryCount, user]);

  useEffect(() => {
    if (!showSort) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setShowSort(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowSort(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showSort]);

  const filteredRecommendations = useMemo(
    () =>
      recommendations.filter(
        (media) =>
          mediaFilter === "all" || getMediaType(media) === mediaFilter,
      ),
    [mediaFilter, recommendations],
  );

  const sortedRecommendations = useMemo(() => {
    if (mediaSort === "relevance") return filteredRecommendations;

    return [...filteredRecommendations].sort((a, b) => {
      if (mediaSort === "az" || mediaSort === "za") {
        const titleOrder = (a.title || a.name || "").localeCompare(
          b.title || b.name || "",
          undefined,
          { sensitivity: "base" },
        );
        return mediaSort === "az" ? titleOrder : -titleOrder;
      }

      const dateA = a.release_date || a.first_air_date || "";
      const dateB = b.release_date || b.first_air_date || "";
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return mediaSort === "newest"
        ? dateB.localeCompare(dateA)
        : dateA.localeCompare(dateB);
    });
  }, [filteredRecommendations, mediaSort]);

  useEffect(() => {
    const sentinel = resultsEndRef.current;
    if (!sentinel || loading || sortedRecommendations.length <= visibleCount) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((count) => count + RESULTS_PER_SCROLL);
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [loading, sortedRecommendations.length, visibleCount]);

  const visibleMedia = sortedRecommendations.slice(0, visibleCount);

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-black font-sans">
        <div className="flex items-center gap-3 text-violet-300">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-violet-300" />
          <span className="text-sm font-medium uppercase tracking-[0.2em]">
            Loading
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-1 flex-col items-center overflow-x-hidden bg-black font-sans">
      <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-black/70 via-black/40 to-black/80">
        {pageBackdrop && (
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40"
            style={{ backgroundImage: `url(${pageBackdrop})` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/50 to-black/80" />
      </div>

      <main className="relative z-10 mx-auto w-full max-w-[1650px] flex-1 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-12">
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-white">
            Picked for you
          </h1>
          <p className="text-xl text-zinc-400">
            Recommendations shaped by the movies and shows you watch
          </p>
        </div>

        {!loading && !error && !hasWatchHistory ? (
          <div className="rounded-2xl border border-zinc-700/60 bg-zinc-900/70 px-6 py-12 text-center">
            <h2 className="mb-3 text-xl font-semibold text-white">
              Your recommendations start with your watch history
            </h2>
            <p className="mx-auto mb-6 max-w-xl text-sm leading-relaxed text-zinc-400">
              Log a few movies or episodes and we’ll use them to find titles
              that match what you enjoy.
            </p>
            <Link
              href="/new"
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-5 py-2.5 text-sm font-semibold text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20"
            >
              Explore new titles
            </Link>
          </div>
        ) : (
          <>
            {basedOn.length > 0 && !loading && (
              <div className="mb-6">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Based on your recent watches
                </p>
                <div className="flex flex-wrap gap-2">
                  {basedOn.slice(0, 6).map((seed) => (
                    <Link
                      key={`${seed.mediaType}-${seed.tmdbId}`}
                      href={`/media/${seed.tmdbId}?type=${seed.mediaType}`}
                      className="rounded-full border border-zinc-700/70 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-violet-500/60 hover:text-violet-200"
                    >
                      {seed.title}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex w-fit items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/80 p-1">
                {MEDIA_FILTERS.map(({ value, label, icon }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={mediaFilter === value}
                    onClick={() => {
                      setMediaFilter(value);
                      setVisibleCount(INITIAL_RESULT_COUNT);
                    }}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      mediaFilter === value
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
                      aria-hidden="true"
                    >
                      {icon === "grid" ? (
                        <>
                          <rect x="3" y="3" width="7" height="7" />
                          <rect x="14" y="3" width="7" height="7" />
                          <rect x="14" y="14" width="7" height="7" />
                          <rect x="3" y="14" width="7" height="7" />
                        </>
                      ) : icon === "tv" ? (
                        <>
                          <rect
                            x="2"
                            y="7"
                            width="20"
                            height="15"
                            rx="2"
                            ry="2"
                          />
                          <polyline points="17 2 12 7 7 2" />
                        </>
                      ) : (
                        <>
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
                        </>
                      )}
                    </svg>
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
                <div className="relative w-fit" ref={sortRef}>
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={showSort}
                    onClick={() => setShowSort((current) => !current)}
                    className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20"
                  >
                    Sort:{" "}
                    {MEDIA_SORTS.find(({ value }) => value === mediaSort)?.label}
                    <svg
                      className={`h-4 w-4 transition-transform duration-200 ${
                        showSort ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                  {showSort && (
                    <div
                      role="menu"
                      aria-label="Sort recommendations"
                      className="absolute right-0 z-50 mt-2 w-40 rounded-xl border border-zinc-700 bg-zinc-900/95 shadow-xl backdrop-blur-sm"
                    >
                      {MEDIA_SORTS.map(({ value, label }, index) => (
                        <button
                          key={value}
                          type="button"
                          role="menuitemradio"
                          aria-checked={mediaSort === value}
                          onClick={() => {
                            setMediaSort(value);
                            setShowSort(false);
                          }}
                          className={`w-full cursor-pointer px-4 py-2 text-left text-sm transition hover:bg-zinc-800 ${
                            mediaSort === value
                              ? "text-violet-300"
                              : "text-zinc-300"
                          } ${index === 0 ? "rounded-t-xl" : ""} ${
                            index === MEDIA_SORTS.length - 1
                              ? "rounded-b-xl"
                              : ""
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {loading ? (
              <div className="grid animate-pulse grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                {Array.from({ length: INITIAL_RESULT_COUNT }, (_, index) => (
                  <div
                    key={`recommendation-skeleton-${index}`}
                    className="overflow-hidden rounded-lg border border-zinc-700/50 bg-zinc-900/80"
                  >
                    <div className="aspect-[2/3] bg-zinc-800" />
                    <div className="space-y-2 p-3">
                      <div className="h-3 w-4/5 rounded bg-zinc-700" />
                      <div className="h-2.5 w-2/3 rounded bg-zinc-700" />
                      <div className="flex gap-1.5">
                        <div className="h-4 w-10 rounded bg-zinc-700" />
                        <div className="h-4 w-10 rounded bg-zinc-700" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-6 text-center">
                <p className="mb-4 text-sm text-red-200">{error}</p>
                <button
                  type="button"
                  onClick={() => setRetryCount((count) => count + 1)}
                  className="inline-flex cursor-pointer items-center justify-center rounded-full border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20"
                >
                  Try again
                </button>
              </div>
            ) : visibleMedia.length > 0 ? (
              <>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                  {visibleMedia.map((media) => (
                    <MediaCard
                      key={`${getMediaType(media)}-${media.id}`}
                      media={media}
                      subtitle={media.recommendationReason}
                    />
                  ))}
                </div>
                <div
                  ref={resultsEndRef}
                  className="flex min-h-12 items-center justify-center py-4"
                  aria-hidden="true"
                >
                  {sortedRecommendations.length > visibleCount && (
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-violet-300" />
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/70 px-6 py-10 text-center">
                <p className="text-zinc-300">
                  {filteredRecommendations.length === 0 &&
                  recommendations.length > 0
                    ? "No recommendations match this filter."
                    : "We couldn’t find recommendations from your recent watches yet."}
                </p>
                {filteredRecommendations.length === 0 &&
                  recommendations.length === 0 && (
                    <Link
                      href="/new"
                      className="mt-5 inline-flex cursor-pointer items-center justify-center rounded-full border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20"
                    >
                      Explore new titles
                    </Link>
                  )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
