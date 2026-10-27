"use client";

import {
  useState,
  useEffect,
  Suspense,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { useSupabase } from "@/components/supabase-provider";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import MediaCard from "@/components/media-card";
import EpisodeTypeBadge from "@/components/episode-type-badge";
import NextUpEpisodeInfo, {
  isSpecialEpisodeType,
} from "@/components/next-up-episode-info";
import {
  getPosterUrl,
  getRandomBackdropUrl,
  getTrendingMedia,
  getMediaType,
  searchMediaPage,
} from "@/lib/tmdb";
import type { TMDBMedia } from "@/lib/tmdb";

const SEARCH_FILTERS = [
  { value: "all", label: "All", icon: "grid" },
  { value: "tv", label: "TV", icon: "tv" },
  { value: "movie", label: "Movies", icon: "movie" },
] as const;

const SEARCH_SORTS = [
  { value: "relevance", label: "Relevance" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "az", label: "A–Z" },
  { value: "za", label: "Z–A" },
] as const;

function RecentHistorySkeleton() {
  return (
    <>
      <section className="mb-8 animate-pulse">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <div className="mb-2 h-2.5 w-24 rounded-full bg-zinc-700" />
            <div className="h-7 w-28 rounded-md bg-zinc-700" />
          </div>
          <div className="h-8 w-20 rounded-full bg-zinc-700" />
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`next-up-skeleton-${index}`}
              className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/80"
            >
              <div className="relative aspect-[2/3] bg-zinc-800" />
              <div className="space-y-1 border-t border-zinc-800 px-2 py-2">
                <div className="h-2.5 w-10 rounded-full bg-zinc-700" />
                <div className="h-3 w-20 rounded-full bg-zinc-700" />
                <div className="h-2.5 w-14 rounded-full bg-zinc-700" />
                <div className="pt-1 h-2.5 w-10 rounded-full bg-zinc-700" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8 animate-pulse">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <div className="mb-2 h-2.5 w-24 rounded-full bg-zinc-700" />
            <div className="h-7 w-28 rounded-md bg-zinc-700" />
          </div>
          <div className="h-8 w-20 rounded-full bg-zinc-700" />
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`history-skeleton-${index}`}
              className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/80"
            >
              <div className="relative aspect-[2/3] bg-zinc-800" />
              <div className="space-y-1 border-t border-zinc-800 px-2 py-2">
                <div className="h-2.5 w-10 rounded-full bg-zinc-700" />
                <div className="h-3 w-20 rounded-full bg-zinc-700" />
                <div className="h-2.5 w-14 rounded-full bg-zinc-700" />
                <div className="pt-1 h-2.5 w-10 rounded-full bg-zinc-700" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function SearchResultsSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-3 gap-3 animate-pulse sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={`search-skeleton-${index}`}
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
  );
}

function getUniqueMedia(results: TMDBMedia[]) {
  const seen = new Set<string>();
  return results.filter((media) => {
    const key = `${getMediaType(media)}-${media.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getDaysUntil(dateInput: string | null | undefined) {
  if (!dateInput) return null;

  const [year, month, day] = dateInput.split("-").map(Number);
  if (!year || !month || !day) return null;

  const releaseDate = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.max(
    0,
    Math.round((releaseDate.getTime() - today.getTime()) / 86400000),
  );
}

function HomeContent() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const [searchResultPages, setSearchResultPages] = useState<TMDBMedia[][]>([]);
  const [searching, setSearching] = useState(false);
  const [searchLoadingMore, setSearchLoadingMore] = useState(false);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [searchTotalResults, setSearchTotalResults] = useState(0);
  const [searchFilter, setSearchFilter] =
    useState<(typeof SEARCH_FILTERS)[number]["value"]>("all");
  const [searchSort, setSearchSort] =
    useState<(typeof SEARCH_SORTS)[number]["value"]>("relevance");
  const [showSearchSort, setShowSearchSort] = useState(false);
  const [recentHistory, setRecentHistory] = useState<any[]>([]);
  const [nextUp, setNextUp] = useState<any[]>([]);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [liveSession, setLiveSession] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [historyLoading, setHistoryLoading] = useState(false);
  const [mediaCache, setMediaCache] = useState<Record<number, any>>({});
  const supabase = useSupabase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("q")?.trim() ?? "";
  const searchRequestIdRef = useRef(0);
  const isLoadingMoreSearchRef = useRef(false);
  const searchResultsEndRef = useRef<HTMLDivElement>(null);
  const searchSortRef = useRef<HTMLDivElement>(null);
  const searchResults = useMemo(
    () => getUniqueMedia(searchResultPages.flat()),
    [searchResultPages],
  );

  const handleTitleClick = (
    e: React.MouseEvent,
    tmdbId: number,
    mediaType: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/media/${tmdbId}?type=${mediaType}`);
  };

  const handleSeriesClick = (e: React.MouseEvent, tmdbId: number) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/media/${tmdbId}?type=tv`);
  };

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
      setInitialCheckDone(true);
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      updateUser(session?.user ?? null);
      setInitialCheckDone(true);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    const requestId = ++searchRequestIdRef.current;
    isLoadingMoreSearchRef.current = false;

    const fetchSearch = async () => {
      if (!searchQuery) {
        setSearchResultPages([]);
        setSearchTotalResults(0);
        setSearchPage(1);
        setSearchHasMore(false);
        setSearching(false);
        return;
      }

      setSearching(true);
      setSearchTotalResults(0);
      setSearchPage(1);
      setSearchHasMore(false);
      setRecentHistory([]);
      setNextUp([]);
      setUpcoming([]);

      const requestMediaType: "multi" | "movie" | "tv" =
        searchFilter === "all" ? "multi" : searchFilter;
      const [result, movieCount, tvCount] = await Promise.all([
        searchMediaPage(searchQuery, 1, requestMediaType),
        ...(searchFilter === "all"
          ? [
              searchMediaPage(searchQuery, 1, "movie"),
              searchMediaPage(searchQuery, 1, "tv"),
            ]
          : []),
      ]);
      if (requestId !== searchRequestIdRef.current) return;

      setSearchResultPages([getUniqueMedia(result.results)]);
      setSearchTotalResults(
        searchFilter === "all"
          ? Math.max(
              movieCount.total_results + tvCount.total_results,
              result.results.length,
            )
          : result.total_results,
      );
      setSearchPage(result.page);
      setSearchHasMore(result.page < result.total_pages);
      setSearching(false);
      setSearchLoadingMore(false);
    };

    void fetchSearch();

    return () => {
      if (requestId === searchRequestIdRef.current) {
        searchRequestIdRef.current += 1;
      }
    };
  }, [searchQuery, searchFilter]);

  const loadMoreSearchResults = useCallback(async () => {
    if (
      !searchQuery ||
      !searchHasMore ||
      isLoadingMoreSearchRef.current ||
      searching
    ) {
      return;
    }

    isLoadingMoreSearchRef.current = true;
    setSearchLoadingMore(true);
    const requestId = searchRequestIdRef.current;
    const nextPage = searchPage + 1;

    try {
      const requestMediaType = searchFilter === "all" ? "multi" : searchFilter;
      const result = await searchMediaPage(
        searchQuery,
        nextPage,
        requestMediaType,
      );
      if (requestId !== searchRequestIdRef.current) return;

      setSearchResultPages((currentPages) => {
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
      setSearchPage(result.page);
      setSearchHasMore(result.page < result.total_pages);
      if (searchFilter !== "all") {
        setSearchTotalResults(result.total_results);
      }
    } finally {
      if (requestId === searchRequestIdRef.current) {
        isLoadingMoreSearchRef.current = false;
        setSearchLoadingMore(false);
      }
    }
  }, [searchFilter, searchHasMore, searchPage, searchQuery, searching]);

  useEffect(() => {
    const sentinel = searchResultsEndRef.current;
    if (!sentinel || !searchHasMore || searching) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMoreSearchResults();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [loadMoreSearchResults, searchHasMore, searching]);

  useEffect(() => {
    if (!showSearchSort) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchSortRef.current &&
        !searchSortRef.current.contains(event.target as Node)
      ) {
        setShowSearchSort(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowSearchSort(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showSearchSort]);

  useEffect(() => {
    if (!user) return;
    // Don't fetch home data if search is active
    if (searchParams.get("q")) return;

    const fetchRecentHistory = async () => {
      setHistoryLoading(true);

      try {
        const [historyResponse, liveResponse] = await Promise.all([
          fetch(
            "/api/watch-history?limit=6&nextUpLimit=6&nextUp=true&upcoming=true",
          ),
          fetch("/api/jellyfin/live").catch(() => ({ ok: false })),
        ]);

        if (historyResponse.ok) {
          const responseData = await historyResponse.json();
          const data = Array.isArray(responseData.items)
            ? responseData.items
            : [];
          const nextUpItems = Array.isArray(responseData.nextUp)
            ? responseData.nextUp.slice(0, 6)
            : [];
          const upcomingItems = Array.isArray(responseData.upcoming)
            ? responseData.upcoming.slice(0, 6)
            : [];

          setNextUp(nextUpItems);
          setUpcoming(upcomingItems);
          setRecentHistory(data.slice(0, 6));
        } else {
          setRecentHistory([]);
          setNextUp([]);
          setUpcoming([]);
        }

        if (liveResponse.ok) {
          const data =
            liveResponse instanceof Response ? await liveResponse.json() : null;

          const nextSession = data?.active ?? null;
          setLiveSession(nextSession);
        } else {
          setLiveSession((current: any) => current ?? null);
        }
      } catch (error) {
        console.error("Error fetching recent history:", error);
        setRecentHistory([]);
        setNextUp([]);
        setUpcoming([]);
      } finally {
        setHistoryLoading(false);
      }
    };

    fetchRecentHistory();
  }, [user, searchParams]);

  useEffect(() => {
    if (!user) return;

    const fetchLiveSession = async () => {
      try {
        const response = await fetch("/api/jellyfin/live");
        if (response.ok) {
          const data = await response.json();
          const nextSession = data?.active ?? null;
          setLiveSession(nextSession);
        }
      } catch {}
    };

    const interval = setInterval(() => {
      void fetchLiveSession();
    }, 15000);

    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const [homeBackdrop, setHomeBackdrop] = useState<string>("");

  useEffect(() => {
    let isMounted = true;

    const loadBackdrop = async () => {
      try {
        const trendingMedia = await getTrendingMedia();
        if (!isMounted) return;
        setHomeBackdrop(getRandomBackdropUrl(trendingMedia));
      } catch (error) {
        console.error("Error loading backdrop:", error);
        if (!isMounted) return;
        setHomeBackdrop("");
      }
    };

    void loadBackdrop();

    return () => {
      isMounted = false;
    };
  }, []);

  const username =
    user?.user_metadata?.username || user?.email?.split("@")[0] || "User";
  const capitalizedUsername = useMemo(
    () => username.charAt(0).toUpperCase() + username.slice(1),
    [username],
  );
  const visibleNextUp = useMemo(() => nextUp.slice(0, 6), [nextUp]);
  const visibleHistory = useMemo(
    () => recentHistory.slice(0, 6),
    [recentHistory],
  );
  const visibleUpcoming = useMemo(() => upcoming.slice(0, 6), [upcoming]);
  const sortedSearchResults = useMemo(
    () =>
      searchResultPages.flatMap((page) => {
        if (searchSort === "relevance") return page;

        return [...page].sort((a, b) => {
          if (searchSort === "az" || searchSort === "za") {
            const titleOrder = (a.title || a.name || "").localeCompare(
              b.title || b.name || "",
              undefined,
              { sensitivity: "base" },
            );
            return searchSort === "az" ? titleOrder : -titleOrder;
          }

          const dateA = a.release_date || a.first_air_date || "";
          const dateB = b.release_date || b.first_air_date || "";
          if (!dateA && !dateB) return 0;
          if (!dateA) return 1;
          if (!dateB) return -1;
          return searchSort === "newest"
            ? dateB.localeCompare(dateA)
            : dateA.localeCompare(dateB);
        });
      }),
    [searchResultPages, searchSort],
  );

  if (!initialCheckDone) {
    return (
      <div className="flex flex-col flex-1 items-center font-sans min-h-screen bg-black overflow-hidden">
        <div className="w-full max-w-[1650px] mx-auto px-4 sm:px-6 lg:px-8 py-16 flex-1 animate-pulse">
          <div className="mb-12">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-12 w-32 rounded-md bg-zinc-800" />
              <div className="h-12 w-24 rounded-md bg-zinc-800" />
            </div>
          </div>
          <div className="mb-8">
            <div className="mb-4 h-4 w-28 rounded-full bg-zinc-700" />
            <div className="mb-4 h-7 w-32 rounded-md bg-zinc-700" />
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/80"
                >
                  <div className="relative aspect-[2/3] bg-zinc-800" />
                  <div className="space-y-1 border-t border-zinc-800 px-2 py-2">
                    <div className="h-2.5 w-10 rounded-full bg-zinc-700" />
                    <div className="h-3 w-20 rounded-full bg-zinc-700" />
                    <div className="h-2.5 w-14 rounded-full bg-zinc-700" />
                    <div className="pt-1 h-2.5 w-10 rounded-full bg-zinc-700" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center font-sans h-screen relative overflow-hidden">
        <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80">
          {homeBackdrop && (
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-70"
              style={{
                backgroundImage: `url(${homeBackdrop})`,
              }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/40 to-black/70"></div>
        </div>

        <main className="relative z-10 flex flex-col items-center justify-center w-full max-w-4xl px-8 py-16 gap-12 flex-1">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
              Trakt <span className="text-violet-400">Lite</span>
            </h1>
            <p className="text-xl text-zinc-300 max-w-2xl mb-8">
              Track your favorite movies and TV shows
            </p>
            <Link
              href="/auth"
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-8 py-3 text-base font-semibold text-violet-100 shadow-lg shadow-violet-500/10 transition hover:border-violet-400 hover:bg-violet-500/20"
            >
              Get Started
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col flex-1 items-center font-sans min-h-screen bg-black overflow-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-black/75 via-black/55 to-black/85">
        {homeBackdrop && (
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-50"
            style={{
              backgroundImage: `url(${homeBackdrop})`,
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/60 to-black/85" />
      </div>

      <main className="relative z-10 w-full max-w-[1650px] mx-auto px-4 sm:px-6 lg:px-8 py-16 flex-1">
        <div className="mb-12">
          {!searchQuery && (
            <div className="flex items-center gap-4 mb-8">
              <h1 className="text-3xl font-bold text-white">Welcome</h1>
              <p className="text-3xl text-violet-400 font-semibold">
                {capitalizedUsername}
              </p>
            </div>
          )}
        </div>

        {searchQuery ? (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">
              Search Results for &quot;
              <span className="text-violet-400">{searchQuery}</span>&quot;
            </h2>
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex w-fit items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/80 p-1">
                {SEARCH_FILTERS.map(({ value, label, icon }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={searchFilter === value}
                    onClick={() => setSearchFilter(value)}
                    className={`flex items-center cursor-pointer gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      searchFilter === value
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
                <p className="text-sm text-zinc-400" aria-live="polite">
                  {searching
                    ? "Searching..."
                    : `Showing ${Math.min(
                        searchResults.length,
                        searchTotalResults,
                      ).toLocaleString()} of ${searchTotalResults.toLocaleString()} ${
                        searchTotalResults === 1 ? "result" : "results"
                      }`}
                </p>
                <div className="relative w-fit" ref={searchSortRef}>
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={showSearchSort}
                    onClick={() => setShowSearchSort((current) => !current)}
                    className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20"
                  >
                    Sort: {SEARCH_SORTS.find(({ value }) => value === searchSort)?.label}
                    <svg
                      className={`h-4 w-4 transition-transform duration-200 ${
                        showSearchSort ? "rotate-180" : ""
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
                  {showSearchSort && (
                    <div
                      role="menu"
                      aria-label="Sort search results"
                      className="absolute right-0 z-50 mt-2 w-40 rounded-xl border border-zinc-700 bg-zinc-900/95 shadow-xl backdrop-blur-sm"
                    >
                      {SEARCH_SORTS.map(({ value, label }, index) => (
                        <button
                          key={value}
                          type="button"
                          role="menuitemradio"
                          aria-checked={searchSort === value}
                          onClick={() => {
                            setSearchSort(value);
                            setShowSearchSort(false);
                          }}
                          className={`w-full cursor-pointer px-4 py-2 text-left text-sm transition hover:bg-zinc-800 ${
                            searchSort === value
                              ? "text-violet-300"
                              : "text-zinc-300"
                          } ${index === 0 ? "rounded-t-xl" : ""} ${
                            index === SEARCH_SORTS.length - 1
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
            {searching ? (
              <SearchResultsSkeleton
                count={Math.max(6, searchResults.length)}
              />
            ) : searchResults.length > 0 ? (
              <>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                  {sortedSearchResults.map((media) => (
                    <MediaCard
                      key={`${getMediaType(media)}-${media.id}`}
                      media={media}
                    />
                  ))}
                </div>
                <div
                  ref={searchResultsEndRef}
                  className="flex min-h-12 items-center justify-center py-4"
                  aria-hidden="true"
                >
                  {searchLoadingMore && (
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-violet-300" />
                  )}
                </div>
              </>
            ) : (
              <p className="text-zinc-400">No results found.</p>
            )}
          </div>
        ) : (
          <>
            {historyLoading && <RecentHistorySkeleton />}

            {!historyLoading && liveSession && (
              <section className="mb-8">
                <Link
                  href={
                    liveSession.tmdbId
                      ? liveSession.seasonNumber && liveSession.episodeNumber
                        ? `/media/${liveSession.tmdbId}/season/${liveSession.seasonNumber}/episode/${liveSession.episodeNumber}?type=${liveSession.mediaType}`
                        : `/media/${liveSession.tmdbId}?type=${liveSession.mediaType}`
                      : "#"
                  }
                  className="w-full max-w-2xl block overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 transition hover:border-emerald-400 hover:bg-emerald-500/20"
                >
                  <div className="flex gap-4">
                    <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-xl border border-emerald-500/30 bg-zinc-900">
                      <img
                        src={liveSession.posterUrl}
                        alt={liveSession.title}
                        className="h-full w-full object-cover"
                        onError={(event) => {
                          event.currentTarget.src = "/placeholder-poster.svg";
                        }}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 [animation-duration:1.8s]" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.85)]" />
                        </span>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-200">
                          Now playing
                        </p>
                      </div>
                      <p className="text-lg font-bold text-white">
                        {liveSession.mediaType === "tv" ? (
                          <span
                            onClick={(e) =>
                              handleSeriesClick(e, liveSession.tmdbId)
                            }
                            className="hover:underline hover:text-violet-200 transition-colors cursor-pointer"
                          >
                            {liveSession.seriesName || liveSession.title}
                          </span>
                        ) : (
                          liveSession.title
                        )}
                      </p>
                      <p className="mt-1 text-sm">
                        {liveSession.mediaType === "tv" &&
                        liveSession.episodeLabel ? (
                          <>
                            <span className="text-emerald-200">
                              {liveSession.episodeLabel}
                            </span>
                            {" • "}
                            <span className="text-zinc-300">
                              {liveSession.episodeName || ""}
                            </span>
                          </>
                        ) : null}
                      </p>

                      <p className="mt-1 text-sm">
                        <span className="text-emerald-200">
                          {liveSession.remainingMinutes > 0
                            ? `${liveSession.remainingMinutes} min left`
                            : "Finishing up"}
                        </span>
                        {" • "}
                        <span className="text-zinc-300">
                          Ends at{" "}
                          {(() => {
                            const endTime = new Date(
                              currentTime.getTime() +
                                liveSession.remainingMinutes * 60000,
                            );

                            return endTime.toLocaleTimeString("en-US", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            });
                          })()}
                        </span>
                      </p>

                      <div className="mt-3 h-2 w-[85%] min-w-[140px] max-w-[450px] overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-400"
                          style={{
                            width: `${Math.min(100, Math.max(0, liveSession.percent))}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </Link>
              </section>
            )}

            {!historyLoading && visibleNextUp.length > 0 && (
              <section className="mb-8">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-violet-400/80">
                      Continue watching
                    </p>
                    <h2 className="text-xl font-bold text-white">Next up</h2>
                  </div>

                  <Link
                    href="/next-up"
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20"
                  >
                    View all
                  </Link>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                  {visibleNextUp.map((item) => (
                    <Link
                      key={`${item.tmdbId}-${item.seasonNumber}-${item.episodeNumber}`}
                      href={`/media/${item.tmdbId}/season/${item.seasonNumber}/episode/${item.episodeNumber}?type=tv`}
                      className="group w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/80 transition hover:border-violet-500/50"
                    >
                      <div className="relative aspect-[2/3] overflow-hidden">
                        {isSpecialEpisodeType(item.episodeType) && (
                          <EpisodeTypeBadge episodeType={item.episodeType} />
                        )}
                        <img
                          src={getPosterUrl(
                            item.seasonPosterPath || item.posterPath || null,
                          )}
                          alt={item.episodeTitle}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          onError={(e) => {
                            e.currentTarget.src = "/placeholder-poster.svg";
                          }}
                        />
                      </div>

                      <div className="space-y-1 border-t border-zinc-800 px-2 py-2">
                        <div className="text-[10px] font-medium uppercase text-violet-300">
                          S{item.seasonNumber} E{item.episodeNumber}
                        </div>
                        <div className="line-clamp-2 text-xs font-semibold text-white">
                          <span
                            onClick={(e) =>
                              handleTitleClick(e, item.tmdbId, "tv")
                            }
                            className="hover:underline hover:text-violet-200 transition-colors cursor-pointer"
                          >
                            {item.title}
                          </span>
                        </div>
                        <div className="line-clamp-1 text-[10px] text-zinc-400">
                          {item.episodeTitle}
                        </div>
                        <NextUpEpisodeInfo
                          episodeRuntimeMinutes={item.episodeRuntimeMinutes}
                          remainingEpisodeCount={item.remainingEpisodeCount}
                          remainingRuntimeMinutes={item.remainingRuntimeMinutes}
                        />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {!historyLoading && visibleUpcoming.length > 0 && (
              <section className="mb-8">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-violet-400/80">
                      Upcoming
                    </p>
                    <h2 className="text-xl font-bold text-white">Calendar</h2>
                  </div>

                  <Link
                    href="/calendar"
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20"
                  >
                    View all
                  </Link>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                  {visibleUpcoming.map((item) => {
                    const isMovie =
                      item.seasonNumber === null && item.episodeNumber === null;
                    const daysUntil = getDaysUntil(item.airDate);
                    const mediaType = isMovie ? "movie" : "tv";
                    const linkHref = isMovie
                      ? `/media/${item.tmdbId}?type=movie`
                      : `/media/${item.tmdbId}/season/${item.seasonNumber}/episode/${item.episodeNumber}?type=tv`;

                    return (
                      <Link
                        key={`${item.tmdbId}-${item.seasonNumber || "movie"}-${item.episodeNumber || "movie"}-${item.airDate || "unknown"}`}
                        href={linkHref}
                        className="group w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/80 transition hover:border-violet-500/50"
                      >
                        <div className="relative aspect-[2/3] overflow-hidden">
                          {!isMovie && (
                            <EpisodeTypeBadge episodeType={item.episodeType} />
                          )}
                          <img
                            src={getPosterUrl(
                              item.seasonPosterPath || item.posterPath || null,
                            )}
                            alt={isMovie ? item.title : item.episodeTitle}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                            onError={(e) => {
                              e.currentTarget.src = "/placeholder-poster.svg";
                            }}
                          />
                        </div>

                        <div className="space-y-1 border-t border-zinc-800 px-2 py-2">
                          <div className="flex flex-col items-start text-[10px] font-medium tracking-[0.15em] text-violet-300 sm:flex-row sm:items-center sm:gap-1">
                            <span>
                              {item.airDate
                                ? (() => {
                                    const date = new Date(item.airDate);
                                    const month = date.toLocaleDateString(
                                      "en-US",
                                      { month: "short" },
                                    );
                                    const day = date.getDate();
                                    return `${month.charAt(0).toUpperCase() + month.slice(1).toLowerCase()} ${day}`;
                                  })()
                                : "Coming soon"}
                            </span>
                            {daysUntil !== null && (
                              <span className="flex items-center gap-1 text-[9px] tracking-normal text-zinc-400/75">
                                <span className="hidden text-zinc-500 sm:inline">
                                  •
                                </span>
                                {daysUntil === 0
                                  ? "today"
                                  : `in ${daysUntil} ${daysUntil === 1 ? "day" : "days"}`}
                              </span>
                            )}
                          </div>
                          <div className="line-clamp-2 text-xs font-semibold text-white">
                            <span
                              onClick={(e) =>
                                handleTitleClick(e, item.tmdbId, mediaType)
                              }
                              className="hover:underline hover:text-violet-200 transition-colors cursor-pointer"
                            >
                              {item.title}
                            </span>
                          </div>
                          {!isMovie && item.episodeTitle && (
                            <div className="line-clamp-1 text-[10px] text-zinc-400">
                              {item.episodeTitle}
                            </div>
                          )}
                          {!isMovie &&
                            item.seasonNumber !== null &&
                            item.episodeNumber !== null && (
                              <div className="text-[10px] text-zinc-400">
                                S{item.seasonNumber} E{item.episodeNumber}
                              </div>
                            )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {!historyLoading && visibleHistory.length > 0 && (
              <section className="mb-8">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-violet-400/80">
                      Recently watched
                    </p>
                    <h2 className="text-xl font-bold text-white">History</h2>
                  </div>

                  <Link
                    href="/history"
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20"
                  >
                    View all
                  </Link>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                  {visibleHistory.map((historyItem) => {
                    const media = historyItem.media;
                    const watchedDate = new Date(historyItem.watchedAt);
                    const episodeLabel =
                      historyItem.seasonNumber !== null &&
                      historyItem.episodeNumber !== null
                        ? `S${historyItem.seasonNumber} E${historyItem.episodeNumber}`
                        : null;

                    const historyLink =
                      historyItem.seasonNumber !== null &&
                      historyItem.episodeNumber !== null
                        ? `/media/${media.tmdbId}/season/${historyItem.seasonNumber}/episode/${historyItem.episodeNumber}?type=${media.mediaType}`
                        : `/media/${media.tmdbId}?type=${media.mediaType}`;

                    return (
                      <Link
                        key={historyItem.id}
                        href={historyLink}
                        className="group w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/80 transition hover:border-violet-500/50"
                      >
                        <div className="relative aspect-[2/3] overflow-hidden">
                          <img
                            src={getPosterUrl(
                              historyItem.seasonPosterPath ||
                                media.posterPath ||
                                null,
                            )}
                            alt={media.title}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                            onError={(e) => {
                              e.currentTarget.src = "/placeholder-poster.svg";
                            }}
                          />
                        </div>

                        <div className="space-y-1 border-t border-zinc-800 px-2 py-2">
                          <div className="text-[10px] font-medium tracking-[0.15em] text-violet-300">
                            {(() => {
                              const month = watchedDate.toLocaleDateString(
                                "en-US",
                                { month: "short" },
                              );
                              const day = watchedDate.getDate();
                              return `${month.charAt(0).toUpperCase() + month.slice(1).toLowerCase()} ${day}`;
                            })()}{" "}
                          </div>
                          <div className="line-clamp-1 text-xs font-semibold text-white">
                            <span
                              onClick={(e) =>
                                handleTitleClick(
                                  e,
                                  media.tmdbId,
                                  media.mediaType,
                                )
                              }
                              className={`${media.mediaType === "tv" ? "hover:underline hover:text-violet-200" : ""} transition-colors cursor-pointer`}
                            >
                              {media.title}
                            </span>
                          </div>
                          {historyItem.episodeName && (
                            <div className="line-clamp-1 text-[10px] text-zinc-300">
                              {historyItem.episodeName}
                            </div>
                          )}
                          {episodeLabel && (
                            <div className="text-[10px] text-zinc-400">
                              {episodeLabel}
                            </div>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black text-white">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-violet-500/40 bg-violet-500/10 shadow-lg shadow-violet-500/10">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-violet-300" />
          </div>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
