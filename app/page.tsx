"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useSupabase } from "@/components/supabase-provider";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import MediaCard from "@/components/media-card";
import {
  getPosterUrl,
  getRandomBackdropUrl,
  getTrendingMedia,
  searchMedia,
} from "@/lib/tmdb";

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

function HomeContent() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
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

  const handleTitleClick = (
    e: React.MouseEvent,
    tmdbId: number,
    mediaType: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/media/${tmdbId}?type=${mediaType}`);
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
    const query = searchParams.get("q");
    if (query) {
      setSearchQuery(query);
      setSearching(true);
      setRecentHistory([]);
      setNextUp([]);
      searchMedia(query).then((results) => {
        setSearchResults(results);
        setSearching(false);
      });
    } else {
      setSearchResults([]);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;

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
  }, [user]);

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
      } catch {
        // Silently fail for live session updates
      }
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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    router.push(`/?q=${encodeURIComponent(searchQuery)}`);
    setSearching(true);
    setRecentHistory([]);
    setNextUp([]);
    setUpcoming([]);
    const results = await searchMedia(searchQuery);
    setSearchResults(results);
    setSearching(false);
  };

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
  const hasSearchResults = searchResults.length > 0 || searching;

  if (!initialCheckDone) {
    return (
      <div className="flex flex-col flex-1 items-center font-sans min-h-screen bg-black overflow-hidden">
        <div className="w-full max-w-[1650px] mx-auto px-4 sm:px-6 lg:px-8 py-16 flex-1 animate-pulse">
          <div className="mb-12">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-12 w-32 rounded-md bg-zinc-800" />
              <div className="h-12 w-24 rounded-md bg-zinc-800" />
            </div>
            <div className="mb-8 h-14 w-full max-w-2xl rounded-lg bg-zinc-800" />
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
          <div className="flex items-center gap-4 mb-8">
            <h1 className="text-3xl font-bold text-white">Welcome</h1>
            <p className="text-3xl text-violet-400 font-semibold">
              {capitalizedUsername}
            </p>
          </div>

          <form
            onSubmit={handleSearch}
            className="flex items-stretch gap-4 max-w-2xl"
          >
            <input
              type="text"
              placeholder="Search for movies and TV shows..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 h-[58px] px-6 py-4 bg-zinc-800/50 border border-zinc-600/50 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-transparent transition-all text-lg"
            />
            <button
              type="submit"
              disabled={searching}
              className="inline-flex h-[58px] w-[58px] cursor-pointer items-center justify-center rounded-xl border border-violet-500/40 bg-violet-500/10 text-violet-100 shadow-lg shadow-violet-500/10 transition hover:border-violet-400 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="flex h-5 w-5 items-center justify-center">
                {searching ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-violet-200" />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.3-4.3"></path>
                  </svg>
                )}
              </div>
            </button>
          </form>
        </div>

        {!searching && historyLoading ? (
          <RecentHistorySkeleton />
        ) : (
          <>
            {!searching && liveSession && (
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
                        {liveSession.mediaType === "tv"
                          ? liveSession.seriesName || liveSession.title
                          : liveSession.title}
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

            {!searching && (visibleNextUp.length > 0 || historyLoading) && (
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
                  {historyLoading
                    ? Array.from({ length: 6 }).map((_, index) => (
                        <div
                          key={`nextup-skeleton-${index}`}
                          className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/80 animate-pulse"
                        >
                          <div className="relative aspect-[2/3] bg-zinc-800" />
                          <div className="space-y-1 border-t border-zinc-800 px-2 py-2">
                            <div className="h-2.5 w-10 rounded-full bg-zinc-700" />
                            <div className="h-3 w-20 rounded-full bg-zinc-700" />
                            <div className="h-2.5 w-14 rounded-full bg-zinc-700" />
                          </div>
                        </div>
                      ))
                    : visibleNextUp.map((item) => (
                        <Link
                          key={`${item.tmdbId}-${item.seasonNumber}-${item.episodeNumber}`}
                          href={`/media/${item.tmdbId}/season/${item.seasonNumber}/episode/${item.episodeNumber}?type=tv`}
                          className="group w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/80 transition hover:-translate-y-0.5 hover:border-violet-500/50"
                        >
                          <div className="relative aspect-[2/3] overflow-hidden">
                            <img
                              src={getPosterUrl(item.posterPath || null)}
                              alt={item.episodeTitle}
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                              onError={(e) => {
                                e.currentTarget.src = "/placeholder-poster.svg";
                              }}
                            />
                          </div>

                          <div className="space-y-1 border-t border-zinc-800 px-2 py-2">
                            <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-violet-300">
                              S{item.seasonNumber} • E{item.episodeNumber}
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
                          </div>
                        </Link>
                      ))}
                </div>
              </section>
            )}

            {!searching && (visibleUpcoming.length > 0 || historyLoading) && (
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
                  {historyLoading
                    ? Array.from({ length: 6 }).map((_, index) => (
                        <div
                          key={`upcoming-skeleton-${index}`}
                          className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/80 animate-pulse"
                        >
                          <div className="relative aspect-[2/3] bg-zinc-800" />
                          <div className="space-y-1 border-t border-zinc-800 px-2 py-2">
                            <div className="h-2.5 w-10 rounded-full bg-zinc-700" />
                            <div className="h-3 w-20 rounded-full bg-zinc-700" />
                            <div className="h-2.5 w-14 rounded-full bg-zinc-700" />
                          </div>
                        </div>
                      ))
                    : visibleUpcoming.map((item) => (
                        <Link
                          key={`${item.tmdbId}-${item.seasonNumber}-${item.episodeNumber}-${item.airDate || "unknown"}`}
                          href={`/media/${item.tmdbId}/season/${item.seasonNumber}/episode/${item.episodeNumber}?type=tv`}
                          className="group w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/80 transition hover:-translate-y-0.5 hover:border-violet-500/50"
                        >
                          <div className="relative aspect-[2/3] overflow-hidden">
                            <img
                              src={getPosterUrl(item.posterPath || null)}
                              alt={item.episodeTitle}
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                              onError={(e) => {
                                e.currentTarget.src = "/placeholder-poster.svg";
                              }}
                            />
                          </div>

                          <div className="space-y-1 border-t border-zinc-800 px-2 py-2">
                            <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-violet-300">
                              {item.airDate
                                ? new Date(item.airDate).toLocaleDateString(
                                    undefined,
                                    {
                                      month: "short",
                                      day: "numeric",
                                    },
                                  )
                                : "Coming soon"}
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
                          </div>
                        </Link>
                      ))}
                </div>
              </section>
            )}

            {!searching && (visibleHistory.length > 0 || historyLoading) && (
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
                  {historyLoading
                    ? Array.from({ length: 6 }).map((_, index) => (
                        <div
                          key={`history-skeleton-${index}`}
                          className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/80 animate-pulse"
                        >
                          <div className="relative aspect-[2/3] bg-zinc-800" />
                          <div className="space-y-1 border-t border-zinc-800 px-2 py-2">
                            <div className="h-2.5 w-10 rounded-full bg-zinc-700" />
                            <div className="h-3 w-20 rounded-full bg-zinc-700" />
                            <div className="h-2.5 w-14 rounded-full bg-zinc-700" />
                          </div>
                        </div>
                      ))
                    : visibleHistory.map((historyItem) => {
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
                            className="group w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/80 transition hover:-translate-y-0.5 hover:border-violet-500/50"
                          >
                            <div className="relative aspect-[2/3] overflow-hidden">
                              <img
                                src={getPosterUrl(media.posterPath || null)}
                                alt={media.title}
                                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                                onError={(e) => {
                                  e.currentTarget.src =
                                    "/placeholder-poster.svg";
                                }}
                              />
                            </div>

                            <div className="space-y-1 border-t border-zinc-800 px-2 py-2">
                              <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-violet-300">
                                {watchedDate.toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                })}{" "}
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
                                  className="hover:underline hover:text-violet-200 transition-colors cursor-pointer"
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

        {searchResults.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">
              Search Results
            </h2>
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
