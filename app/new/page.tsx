"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MediaCard from "@/components/media-card";
import {
  getMediaType,
  getRandomBackdropUrl,
  getTrendingMediaPage,
} from "@/lib/tmdb";
import type { TMDBMedia } from "@/lib/tmdb";

const INITIAL_RESULT_COUNT = 18;
const RESULTS_PER_SCROLL = 18;

const MEDIA_FILTERS = [
  { value: "all", label: "All", icon: "grid" },
  { value: "tv", label: "TV", icon: "tv" },
  { value: "movie", label: "Movies", icon: "movie" },
] as const;

const MEDIA_SORTS = [
  { value: "relevance", label: "Relevance" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "az", label: "A–Z" },
  { value: "za", label: "Z–A" },
] as const;

function getUniqueMedia(results: TMDBMedia[]) {
  const seen = new Set<string>();
  return results.filter((media) => {
    const key = `${getMediaType(media)}-${media.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function NewPage() {
  const [trendingPages, setTrendingPages] = useState<TMDBMedia[][]>([]);
  const [loadedFilter, setLoadedFilter] = useState<
    (typeof MEDIA_FILTERS)[number]["value"] | null
  >(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [visibleCount, setVisibleCount] = useState(INITIAL_RESULT_COUNT);
  const [mediaFilter, setMediaFilter] =
    useState<(typeof MEDIA_FILTERS)[number]["value"]>("all");
  const [mediaSort, setMediaSort] =
    useState<(typeof MEDIA_SORTS)[number]["value"]>("relevance");
  const loading = loadedFilter !== mediaFilter;
  const [showSort, setShowSort] = useState(false);
  const [pageBackdrop, setPageBackdrop] = useState("");
  const requestIdRef = useRef(0);
  const loadingMoreRequestRef = useRef<number | null>(null);
  const resultsEndRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const trendingMedia = useMemo(
    () => getUniqueMedia(trendingPages.flat()),
    [trendingPages],
  );
  const sortedTrendingMedia = useMemo(
    () =>
      trendingPages.flatMap((mediaPage) => {
        if (mediaSort === "relevance") return mediaPage;

        return [...mediaPage].sort((a, b) => {
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
      }),
    [mediaSort, trendingPages],
  );

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    loadingMoreRequestRef.current = null;

    const fetchTrending = async () => {
      try {
        const result = await getTrendingMediaPage(1, mediaFilter);
        if (requestId !== requestIdRef.current) return;

        const uniqueResults = getUniqueMedia(result.results);
        setTrendingPages([uniqueResults]);
        setPage(result.page);
        setTotalResults(result.total_results);
        setHasMore(result.page < result.total_pages);
        setVisibleCount(INITIAL_RESULT_COUNT);
        setLoadingMore(false);
        if (mediaFilter === "all") {
          setPageBackdrop(getRandomBackdropUrl(uniqueResults));
        }
        setLoadedFilter(mediaFilter);
      } catch (error) {
        console.error("Error loading trending media:", error);
        if (requestId !== requestIdRef.current) return;
        setTrendingPages([]);
        setPage(1);
        setTotalResults(0);
        setHasMore(false);
        setVisibleCount(INITIAL_RESULT_COUNT);
        setLoadingMore(false);
        setLoadedFilter(mediaFilter);
      }
    };

    void fetchTrending();

    return () => {
      if (requestId === requestIdRef.current) {
        requestIdRef.current += 1;
      }
    };
  }, [mediaFilter]);

  const loadMoreResults = useCallback(async () => {
    if (loading || loadingMoreRequestRef.current !== null) return;

    if (trendingMedia.length > visibleCount) {
      setVisibleCount((currentCount) => currentCount + RESULTS_PER_SCROLL);
      return;
    }

    if (!hasMore) return;

    const requestId = requestIdRef.current;
    loadingMoreRequestRef.current = requestId;
    setLoadingMore(true);
    const nextPage = page + 1;

    try {
      const result = await getTrendingMediaPage(nextPage, mediaFilter);
      if (requestId !== requestIdRef.current) return;

      setTrendingPages((currentPages) => {
        const existingKeys = new Set(
          currentPages
            .flat()
            .map((media) => `${getMediaType(media)}-${media.id}`),
        );
        const newPage = getUniqueMedia(result.results).filter((media) => {
          const key = `${getMediaType(media)}-${media.id}`;
          if (existingKeys.has(key)) return false;
          existingKeys.add(key);
          return true;
        });
        return [...currentPages, newPage];
      });
      setPage(result.page);
      setHasMore(result.page < result.total_pages);
      setTotalResults(result.total_results);
    } finally {
      if (loadingMoreRequestRef.current === requestId) {
        loadingMoreRequestRef.current = null;
        if (requestId === requestIdRef.current) {
          setLoadingMore(false);
        }
      }
    }
  }, [hasMore, loading, mediaFilter, page, trendingMedia.length, visibleCount]);

  useEffect(() => {
    const sentinel = resultsEndRef.current;
    if (
      !sentinel ||
      loading ||
      (!hasMore && trendingMedia.length <= visibleCount)
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMoreResults();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [hasMore, loadMoreResults, loading, trendingMedia.length, visibleCount]);

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

  const visibleMedia = sortedTrendingMedia.slice(0, visibleCount);

  return (
    <div className="relative flex flex-col flex-1 items-center font-sans min-h-screen bg-black overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-black/70 via-black/40 to-black/80">
        {pageBackdrop && (
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40"
            style={{ backgroundImage: `url(${pageBackdrop})` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/50 to-black/80" />
      </div>

      <main className="relative z-10 w-full max-w-[1650px] mx-auto px-4 sm:px-6 lg:px-8 py-16 flex-1">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">
            New & Trending
          </h1>
          <p className="text-xl text-zinc-400">
            Discover the latest movies and TV shows everyone is watching
          </p>
        </div>

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-fit items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/80 p-1">
            {MEDIA_FILTERS.map(({ value, label, icon }) => (
              <button
                key={value}
                type="button"
                aria-pressed={mediaFilter === value}
                onClick={() => setMediaFilter(value)}
                className={`flex items-center cursor-pointer gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
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
                      <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
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
                  aria-label="Sort trending media"
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
                        index === MEDIA_SORTS.length - 1 ? "rounded-b-xl" : ""
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
          <div className="grid grid-cols-3 gap-3 animate-pulse sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {Array.from({ length: INITIAL_RESULT_COUNT }, (_, index) => (
              <div
                key={`trending-skeleton-${index}`}
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
        ) : visibleMedia.length > 0 ? (
          <>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {visibleMedia.map((media) => (
                <MediaCard
                  key={`${getMediaType(media)}-${media.id}`}
                  media={media}
                />
              ))}
            </div>
            <div
              ref={resultsEndRef}
              className="flex min-h-12 items-center justify-center py-4"
              aria-hidden="true"
            >
              {loadingMore && (
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-violet-300" />
              )}
            </div>
          </>
        ) : (
          <p className="text-zinc-400">
            No trending media available at the moment.
          </p>
        )}
      </main>
    </div>
  );
}
