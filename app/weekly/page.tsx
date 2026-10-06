"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/components/supabase-provider";
import {
  getMediaDetails,
  getPosterUrl,
  getRandomBackdropUrl,
  getTVSeasonDetails,
  getTrendingMedia,
} from "@/lib/tmdb";

interface WeeklyStats {
  thisWeekCount: number;
  lastWeekCount: number;
  thisWeekEpisodes: number;
  lastWeekEpisodes: number;
  thisWeekMovies: number;
  lastWeekMovies: number;
  thisWeekRuntimeMinutes: number | null;
  lastWeekRuntimeMinutes: number | null;
  thisWeekEpisodeRuntimeMinutes: number | null;
  lastWeekEpisodeRuntimeMinutes: number | null;
  thisWeekMovieRuntimeMinutes: number | null;
  lastWeekMovieRuntimeMinutes: number | null;
  change: number;
  episodeChange: number;
  movieChange: number;
}

interface WatchedItem {
  id: string;
  media: {
    tmdbId: number;
    title: string;
    posterPath: string | null;
    mediaType: string;
  };
  seasonNumber: number | null;
  episodeNumber: number | null;
  episodeName: string | null;
  watchedAt: Date;
}

interface RuntimeTask {
  load: () => Promise<Map<string, number | null>>;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (index < items.length) {
        const currentIndex = index++;
        results[currentIndex] = await mapper(items[currentIndex]);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

async function getRuntimeMinutes(
  items: WatchedItem[],
): Promise<Map<string, number | null>> {
  const movieGroups = new Map<number, WatchedItem[]>();
  const seasonGroups = new Map<string, WatchedItem[]>();

  for (const item of items) {
    if (item.seasonNumber === null) {
      const group = movieGroups.get(item.media.tmdbId) ?? [];
      group.push(item);
      movieGroups.set(item.media.tmdbId, group);
    } else if (item.episodeNumber !== null) {
      const key = `${item.media.tmdbId}:${item.seasonNumber}`;
      const group = seasonGroups.get(key) ?? [];
      group.push(item);
      seasonGroups.set(key, group);
    }
  }

  const tasks: RuntimeTask[] = [
    ...Array.from(movieGroups, ([tmdbId, group]) => ({
      load: async () => {
        const details = await getMediaDetails(tmdbId, "movie");
        const runtime = details?.runtime;
        return new Map(
          group.map((item) => [
            item.id,
            typeof runtime === "number" && runtime > 0 ? runtime : null,
          ]),
        );
      },
    })),
    ...Array.from(seasonGroups, ([key, group]) => ({
      load: async () => {
        const [tmdbId, seasonNumber] = key.split(":").map(Number);
        const details = (await getTVSeasonDetails(tmdbId, seasonNumber)) as {
          episodes?: Array<{
            episode_number: number;
            runtime?: number | null;
          }>;
        } | null;
        const episodes = new Map(
          (details?.episodes ?? []).map((episode) => [
            episode.episode_number,
            episode.runtime,
          ]),
        );
        return new Map(
          group.map((item) => {
            const runtime = episodes.get(item.episodeNumber!);
            return [
              item.id,
              typeof runtime === "number" && runtime > 0 ? runtime : null,
            ];
          }),
        );
      },
    })),
  ];

  const runtimeGroups = await mapWithConcurrency(tasks, 5, (task) =>
    task.load(),
  );
  return new Map(runtimeGroups.flatMap((group) => Array.from(group)));
}

export default function WeeklyPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [weeklyLoading, setWeeklyLoading] = useState(true);
  const [thisWeekItems, setThisWeekItems] = useState<WatchedItem[]>([]);
  const [lastWeekItems, setLastWeekItems] = useState<WatchedItem[]>([]);
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  const [pageBackdrop, setPageBackdrop] = useState("");
  const router = useRouter();
  const supabase = useSupabase();

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
    let isMounted = true;

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

    const fetchWeeklyData = async () => {
      setWeeklyLoading(true);

      try {
        const response = await fetch("/api/watch-history?limit=all");

        if (!response.ok) {
          setThisWeekItems([]);
          setLastWeekItems([]);
          setStats(null);
          return;
        }

        const data = await response.json();
        const allItems: WatchedItem[] = Array.isArray(data.items)
          ? data.items
          : [];

        const now = new Date();
        const currentDay = now.getDay();
        const diffToMonday = currentDay === 0 ? 6 : currentDay - 1;
        const thisWeekStart = new Date(now);
        thisWeekStart.setDate(now.getDate() - diffToMonday);
        thisWeekStart.setHours(0, 0, 0, 0);

        const lastWeekStart = new Date(thisWeekStart);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);
        const lastWeekEnd = new Date(thisWeekStart);
        lastWeekEnd.setMilliseconds(lastWeekEnd.getMilliseconds() - 1);

        const thisWeek: WatchedItem[] = allItems.filter((item) => {
          const watchedDate = new Date(item.watchedAt);
          return watchedDate >= thisWeekStart;
        });

        const lastWeek: WatchedItem[] = allItems.filter((item) => {
          const watchedDate = new Date(item.watchedAt);
          return watchedDate >= lastWeekStart && watchedDate < thisWeekStart;
        });

        const thisWeekEpisodes = thisWeek.filter(
          (item: WatchedItem) => item.seasonNumber !== null,
        ).length;
        const lastWeekEpisodes = lastWeek.filter(
          (item: WatchedItem) => item.seasonNumber !== null,
        ).length;
        const thisWeekMovies = thisWeek.filter(
          (item: WatchedItem) => item.seasonNumber === null,
        ).length;
        const lastWeekMovies = lastWeek.filter(
          (item: WatchedItem) => item.seasonNumber === null,
        ).length;

        const thisWeekRuntimeByItemId = await getRuntimeMinutes(thisWeek);
        const lastWeekRuntimeByItemId = await getRuntimeMinutes(lastWeek);
        const getTotalRuntimeMinutes = (
          watchedItems: WatchedItem[],
          runtimeMap: Map<string, number | null>,
        ) => {
          const runtimes = watchedItems.map((item) => runtimeMap.get(item.id));
          const knownRuntimes = runtimes.filter(
            (runtime): runtime is number => typeof runtime === "number",
          );
          if (knownRuntimes.length !== runtimes.length) {
            return null;
          }
          return knownRuntimes.reduce((total, runtime) => total + runtime, 0);
        };
        const thisWeekRuntimeMinutes = getTotalRuntimeMinutes(
          thisWeek,
          thisWeekRuntimeByItemId,
        );
        const lastWeekRuntimeMinutes = getTotalRuntimeMinutes(
          lastWeek,
          lastWeekRuntimeByItemId,
        );
        const thisWeekEpisodeRuntimeMinutes = getTotalRuntimeMinutes(
          thisWeek.filter((item) => item.seasonNumber !== null),
          thisWeekRuntimeByItemId,
        );
        const lastWeekEpisodeRuntimeMinutes = getTotalRuntimeMinutes(
          lastWeek.filter((item) => item.seasonNumber !== null),
          lastWeekRuntimeByItemId,
        );
        const thisWeekMovieRuntimeMinutes = getTotalRuntimeMinutes(
          thisWeek.filter((item) => item.seasonNumber === null),
          thisWeekRuntimeByItemId,
        );
        const lastWeekMovieRuntimeMinutes = getTotalRuntimeMinutes(
          lastWeek.filter((item) => item.seasonNumber === null),
          lastWeekRuntimeByItemId,
        );

        const calculateChange = (current: number, previous: number) => {
          if (previous === 0) return current > 0 ? 100 : 0;
          return Math.round(((current - previous) / previous) * 100);
        };

        setThisWeekItems(thisWeek);
        setLastWeekItems(lastWeek);
        setStats({
          thisWeekCount: thisWeek.length,
          lastWeekCount: lastWeek.length,
          thisWeekEpisodes,
          lastWeekEpisodes,
          thisWeekMovies,
          lastWeekMovies,
          thisWeekRuntimeMinutes,
          lastWeekRuntimeMinutes,
          thisWeekEpisodeRuntimeMinutes,
          lastWeekEpisodeRuntimeMinutes,
          thisWeekMovieRuntimeMinutes,
          lastWeekMovieRuntimeMinutes,
          change: calculateChange(thisWeek.length, lastWeek.length),
          episodeChange: calculateChange(thisWeekEpisodes, lastWeekEpisodes),
          movieChange: calculateChange(thisWeekMovies, lastWeekMovies),
        });
      } catch (error) {
        console.error("Error fetching weekly data:", error);
        setThisWeekItems([]);
        setLastWeekItems([]);
        setStats(null);
      } finally {
        setWeeklyLoading(false);
      }
    };

    void fetchWeeklyData();
  }, [user]);

  if (loading || weeklyLoading) {
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

  const formatDateRange = () => {
    const now = new Date();
    const currentDay = now.getDay();
    const diffToMonday = currentDay === 0 ? 6 : currentDay - 1;
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - diffToMonday);
    const thisWeekEnd = new Date(thisWeekStart);
    thisWeekEnd.setDate(thisWeekStart.getDate() + 6);

    const options = { month: "short", day: "numeric" } as const;
    const start = thisWeekStart.toLocaleDateString("en-US", options);
    const end = thisWeekEnd.toLocaleDateString("en-US", options);
    return `${start} - ${end}`;
  };

  const formatLastDateRange = () => {
    const now = new Date();
    const currentDay = now.getDay();
    const diffToMonday = currentDay === 0 ? 6 : currentDay - 1;
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - diffToMonday);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(lastWeekStart);
    lastWeekEnd.setDate(lastWeekStart.getDate() + 6);

    const options = { month: "short", day: "numeric" } as const;
    const start = lastWeekStart.toLocaleDateString("en-US", options);
    const end = lastWeekEnd.toLocaleDateString("en-US", options);
    return `${start} - ${end}`;
  };

  const StatCard = ({
    label,
    thisWeek,
    lastWeek,
    change,
    thisWeekWatchTimeMinutes,
    lastWeekWatchTimeMinutes,
  }: {
    label: string;
    thisWeek: number;
    lastWeek: number;
    change: number;
    thisWeekWatchTimeMinutes?: number | null;
    lastWeekWatchTimeMinutes?: number | null;
  }) => {
    const isPositive = change >= 0;
    const changeColor = isPositive ? "text-emerald-400" : "text-rose-400";
    const changeIcon = isPositive ? "↑" : "↓";

    const formatWatchTime = (minutes: number | null | undefined) => {
      if (minutes === null || minutes === undefined) return "";
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h ${mins}min`;
    };

    return (
      <div className="flex h-full w-full flex-col rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-400">
          {label}
        </p>
        <div className="flex flex-1 items-start">
          <p className="text-2xl font-bold text-white sm:text-3xl md:text-4xl">
            {thisWeek}
          </p>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
          {thisWeekWatchTimeMinutes !== undefined && (
            <span className={changeColor}>
              {thisWeekWatchTimeMinutes === null
                ? "Runtime unavailable"
                : formatWatchTime(thisWeekWatchTimeMinutes)}
            </span>
          )}
          <span className={`font-medium ${changeColor}`}>
            ({changeIcon} {Math.abs(change)}%)
          </span>
          <span className="text-zinc-500">
            vs {lastWeek} {lastWeek === 1 ? "play" : "plays"} (
            {lastWeekWatchTimeMinutes !== undefined && lastWeekWatchTimeMinutes !== null
              ? formatWatchTime(lastWeekWatchTimeMinutes)
              : "N/A"}
            )
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="relative min-h-screen bg-black text-white overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-black/70 via-black/45 to-black/80">
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
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-violet-400/80">
              weekly recap
            </p>
            <h1 className="text-3xl font-bold text-white md:text-4xl">
              Weekly
            </h1>
          </div>

          <Link
            href="/"
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20"
          >
            Back home
          </Link>
        </div>

        {!weeklyLoading && !stats ? (
          <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/60 p-12 text-center">
            <h2 className="text-2xl font-semibold text-white">
              No data available
            </h2>
            <p className="mt-3 text-zinc-400">
              Start watching movies and TV shows to see your weekly recap here.
            </p>
          </div>
        ) : (
          <>
            {stats && (
              <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
                <StatCard
                  label="Total Watched"
                  thisWeek={stats.thisWeekCount}
                  lastWeek={stats.lastWeekCount}
                  change={stats.change}
                  thisWeekWatchTimeMinutes={stats.thisWeekRuntimeMinutes}
                  lastWeekWatchTimeMinutes={stats.lastWeekRuntimeMinutes}
                />
                <StatCard
                  label="Episodes"
                  thisWeek={stats.thisWeekEpisodes}
                  lastWeek={stats.lastWeekEpisodes}
                  change={stats.episodeChange}
                  thisWeekWatchTimeMinutes={stats.thisWeekEpisodeRuntimeMinutes}
                  lastWeekWatchTimeMinutes={stats.lastWeekEpisodeRuntimeMinutes}
                />
                <StatCard
                  label="Movies"
                  thisWeek={stats.thisWeekMovies}
                  lastWeek={stats.lastWeekMovies}
                  change={stats.movieChange}
                  thisWeekWatchTimeMinutes={stats.thisWeekMovieRuntimeMinutes}
                  lastWeekWatchTimeMinutes={stats.lastWeekMovieRuntimeMinutes}
                />
              </div>
            )}

            <div className="mb-8">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-violet-400/80">
                    This week
                  </p>
                  <h2 className="text-xl font-bold text-white">
                    {formatDateRange()}
                  </h2>
                </div>
                <p className="text-sm text-zinc-400">
                  {thisWeekItems.length} items
                </p>
              </div>

              {thisWeekItems.length === 0 ? (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
                  <p className="text-zinc-400">Nothing watched this week yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                  {thisWeekItems.map((item) => {
                    const isTv = item.seasonNumber !== null;
                    const linkHref = isTv
                      ? `/media/${item.media.tmdbId}/season/${item.seasonNumber}/episode/${item.episodeNumber}?type=tv`
                      : `/media/${item.media.tmdbId}?type=movie`;

                    return (
                      <Link
                        key={item.id}
                        href={linkHref}
                        className="group w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/80 transition hover:border-violet-500/50"
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
                          <div className="text-[10px] font-medium tracking-[0.15em] text-violet-300">
                            {(() => {
                              const watchedDate = new Date(item.watchedAt);
                              const month = watchedDate.toLocaleDateString(
                                "en-US",
                                { month: "short" },
                              );
                              const day = watchedDate.getDate();
                              return `${month.charAt(0).toUpperCase() + month.slice(1).toLowerCase()} ${day}`;
                            })()}
                          </div>
                          <div className="line-clamp-2 text-xs font-semibold text-white leading-tight">
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
                          {item.episodeName && (
                            <div className="line-clamp-1 text-[10px] text-zinc-400">
                              {item.episodeName}
                            </div>
                          )}
                          {isTv && (
                            <div className="text-[10px] text-zinc-400">
                              S{item.seasonNumber} E{item.episodeNumber}
                            </div>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-400/80">
                    Last week
                  </p>
                  <h2 className="text-xl font-bold text-white">
                    {formatLastDateRange()}
                  </h2>
                </div>
                <p className="text-sm text-zinc-400">
                  {lastWeekItems.length} items
                </p>
              </div>

              {lastWeekItems.length === 0 ? (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
                  <p className="text-zinc-400">No data from last week</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                  {lastWeekItems.map((item) => {
                    const isTv = item.seasonNumber !== null;
                    const linkHref = isTv
                      ? `/media/${item.media.tmdbId}/season/${item.seasonNumber}/episode/${item.episodeNumber}?type=tv`
                      : `/media/${item.media.tmdbId}?type=movie`;

                    return (
                      <Link
                        key={item.id}
                        href={linkHref}
                        className="group w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/80 transition hover:border-violet-500/50"
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
                          <div className="text-[10px] font-medium tracking-[0.15em] text-violet-300">
                            {(() => {
                              const watchedDate = new Date(item.watchedAt);
                              const month = watchedDate.toLocaleDateString(
                                "en-US",
                                { month: "short" },
                              );
                              const day = watchedDate.getDate();
                              return `${month.charAt(0).toUpperCase() + month.slice(1).toLowerCase()} ${day}`;
                            })()}
                          </div>
                          <div className="line-clamp-2 text-xs font-semibold text-white leading-tight">
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
                          {item.episodeName && (
                            <div className="line-clamp-1 text-[10px] text-zinc-400">
                              {item.episodeName}
                            </div>
                          )}
                          {isTv && (
                            <div className="text-[10px] text-zinc-400">
                              S{item.seasonNumber} E{item.episodeNumber}
                            </div>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
