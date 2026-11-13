import Link from "next/link";
import Image from "next/image";
import EpisodeTypeBadge from "@/components/episode-type-badge";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  getMediaDetails,
  getPosterUrl,
  getTVSeasonDetails,
  addEpisodeTypes,
} from "@/lib/tmdb";
import { getTrendingBackdropUrl } from "@/lib/trending-backdrop";
import { collapseEpisodeDrops } from "@/lib/episode-drops";

interface UpcomingEpisodeItem {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  seasonPosterPath?: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  episodeTitle: string | null;
  episodeType?: string | null;
  overview: string | null;
  airDate: string | null;
}

function startOfTodayUtc() {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function isFutureEpisode(
  episode:
    | {
        air_date?: string | null;
      }
    | null
    | undefined,
) {
  if (!episode?.air_date) return false;

  const airDate = new Date(episode.air_date);
  return (
    Number.isFinite(airDate.getTime()) && airDate >= startOfTodayUtc()
  );
}

function normalizeDate(dateInput: string | Date | null | undefined): string | null {
  if (!dateInput) return null;
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];

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

async function getCalendarData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, upcoming: [] };
  }

  let dbUser = await prisma.user.findUnique({
    where: { email: user.email! },
  });

  if (!dbUser) {
    return { user, upcoming: [] };
  }

  try {
    const cachedUpcoming = await (prisma as any).upcomingEpisodesCache.findMany({
      where: {
        userId: dbUser.id,
        airDate: { gte: startOfTodayUtc() },
      },
      orderBy: { airDate: "asc" },
      take: 100,
    });

    if (cachedUpcoming.length > 0) {
      return {
        user,
        upcoming: await addEpisodeTypes<UpcomingEpisodeItem>(cachedUpcoming.map((item: any) => ({
          tmdbId: item.tmdbId,
          title: item.title,
          posterPath: item.posterPath,
          backdropPath: item.backdropPath,
          seasonNumber: item.seasonNumber,
          episodeNumber: item.episodeNumber,
          episodeTitle: item.episodeTitle,
          overview: item.overview,
          airDate: item.airDate ? item.airDate.toISOString().split('T')[0] : null,
        })).slice(0, 40)),
      };
    }
  } catch (error) {
    console.error("Error reading from cache, computing from scratch:", error);
  }

  const watchHistory = await prisma.watchHistory.findMany({
    where: {
      userId: dbUser.id,
      media: { mediaType: "tv" },
      seasonNumber: { not: null },
      episodeNumber: { not: null },
    },
    include: { media: true },
    orderBy: {
      watchedAt: "desc",
    },
    take: 500,
  });

  const latestByShow = new Map<
    number,
    {
      tmdbId: number;
      title: string;
      posterPath: string | null;
      backdropPath: string | null;
      seasonNumber: number;
      episodeNumber: number;
      watchedAt: Date;
    }
  >();

  for (const item of watchHistory) {
    const current = latestByShow.get(item.media.tmdbId);
    const isLater =
      !current ||
      item.seasonNumber! > current.seasonNumber ||
      (item.seasonNumber === current.seasonNumber &&
        item.episodeNumber! > current.episodeNumber);

    if (isLater) {
      latestByShow.set(item.media.tmdbId, {
        tmdbId: item.media.tmdbId,
        title: item.media.title,
        posterPath: item.media.posterPath,
        backdropPath: item.media.backdropPath,
        seasonNumber: item.seasonNumber!,
        episodeNumber: item.episodeNumber!,
        watchedAt: item.watchedAt,
      });
    }
  }

  const seasonDetailCache = new Map<string, any>();
  const getCachedSeasonDetails = async (
    tmdbId: number,
    seasonNumber: number,
  ) => {
    const key = `${tmdbId}:${seasonNumber}`;
    if (seasonDetailCache.has(key)) {
      return seasonDetailCache.get(key);
    }

    const seasonDetails = await getTVSeasonDetails(tmdbId, seasonNumber);
    seasonDetailCache.set(key, seasonDetails ?? null);
    return seasonDetails ?? null;
  };

  const upcoming: Array<{
    tmdbId: number;
    title: string;
    posterPath: string | null;
    backdropPath: string | null;
    seasonNumber: number | null;
    episodeNumber: number | null;
    episodeTitle: string | null;
    overview: string | null;
    airDate: string | null;
  }> = [];

  const computedShows = await mapWithConcurrency(
    [...latestByShow.values()],
    3,
    async (show) => {
      const currentSeason = show.seasonNumber;
      const currentEpisode = show.episodeNumber;
      const now = new Date();

      const currentSeasonDetails = await getCachedSeasonDetails(
        show.tmdbId,
        currentSeason,
      );

      const futureEpisodesInCurrentSeason = currentSeasonDetails?.episodes
        ?.filter(
          (episode: { episode_number?: number; air_date?: string | null }) =>
            Number(episode.episode_number) > currentEpisode &&
            isFutureEpisode(episode),
        )
        .sort(
          (a: { air_date?: string | null }, b: { air_date?: string | null }) =>
            new Date(a.air_date || now).getTime() -
            new Date(b.air_date || now).getTime(),
        );

      for (const episode of futureEpisodesInCurrentSeason || []) {
        upcoming.push({
          tmdbId: show.tmdbId,
          title: show.title,
          posterPath: show.posterPath,
          backdropPath: show.backdropPath,
          seasonNumber: currentSeason,
          episodeNumber: Number(episode.episode_number),
          episodeTitle:
            episode.name ||
            `Episode ${Number(episode.episode_number)}`,
          overview: episode.overview || null,
          airDate: normalizeDate(episode.air_date),
        });
      }

      const nextSeasonDetails = await getCachedSeasonDetails(
        show.tmdbId,
        currentSeason + 1,
      );
      const futureEpisodesNextSeason = nextSeasonDetails?.episodes
        ?.filter(
          (episode: { episode_number?: number; air_date?: string | null }) =>
            Number(episode.episode_number) >= 1 && isFutureEpisode(episode),
        )
        .sort(
          (a: { air_date?: string | null }, b: { air_date?: string | null }) =>
            new Date(a.air_date || now).getTime() -
            new Date(b.air_date || now).getTime(),
        );

      for (const episode of futureEpisodesNextSeason || []) {
        upcoming.push({
          tmdbId: show.tmdbId,
          title: show.title,
          posterPath: show.posterPath,
          backdropPath: show.backdropPath,
          seasonNumber: currentSeason + 1,
          episodeNumber: Number(episode.episode_number),
          episodeTitle:
            episode.name ||
            `Episode ${Number(episode.episode_number)}`,
          overview: episode.overview || null,
          airDate: normalizeDate(episode.air_date),
        });
      }

      return null;
    },
  );

  await Promise.all(computedShows);

  const watchlist = await prisma.watchlist.findMany({
    where: {
      userId: dbUser.id,
    },
    include: {
      media: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 500,
  });

  await mapWithConcurrency(watchlist, 3, async (item) => {
    const media = item.media;

    if (media.mediaType === "tv") {
      if (latestByShow.has(media.tmdbId)) return;

      try {
        const showDetails = await getMediaDetails(media.tmdbId, "tv");
        const latestSeason = Math.max(
          1,
          showDetails?.number_of_seasons ?? 1,
        );

        for (const seasonNumber of [latestSeason, latestSeason + 1]) {
          const seasonDetails = await getCachedSeasonDetails(
            media.tmdbId,
            seasonNumber,
          );
          const episodes = (seasonDetails?.episodes || [])
            .filter(
              (episode: { air_date?: string | null }) =>
                isFutureEpisode(episode),
            )
            .sort(
              (
                a: { air_date?: string | null },
                b: { air_date?: string | null },
              ) =>
                new Date(a.air_date || 0).getTime() -
                new Date(b.air_date || 0).getTime(),
            );

          for (const episode of episodes) {
            upcoming.push({
              tmdbId: media.tmdbId,
              title: media.title,
              posterPath: media.posterPath,
              backdropPath: media.backdropPath,
              seasonNumber,
              episodeNumber: Number(episode.episode_number),
              episodeTitle:
                episode.name ||
                `Episode ${Number(episode.episode_number)}`,
              overview: episode.overview || media.overview,
              airDate: normalizeDate(episode.air_date),
            });
          }
        }
      } catch (error) {
        console.error("Error fetching TV season details:", error);
      }
      return;
    }

    const releaseDate = media.releaseDate;
    if (!releaseDate) return;

    const releaseDateObj = new Date(releaseDate);
    const todayStart = startOfTodayUtc();

    if (releaseDateObj >= todayStart) {
      upcoming.push({
        tmdbId: media.tmdbId,
        title: media.title,
        posterPath: media.posterPath,
        backdropPath: media.backdropPath,
        seasonNumber: null,
        episodeNumber: null,
        episodeTitle: null,
        overview: media.overview,
        airDate: normalizeDate(releaseDate.toISOString()),
      });
    }
  });

  return {
    user,
    upcoming: await addEpisodeTypes<UpcomingEpisodeItem>(upcoming
      .sort(
        (a, b) =>
          new Date(a.airDate || 0).getTime() - new Date(b.airDate || 0).getTime(),
      )
      .slice(0, 40)),
  };
}

function groupByDate(upcoming: UpcomingEpisodeItem[]) {
  const byDate = [...upcoming]
    .sort(
      (a, b) =>
        new Date(a.airDate || 0).getTime() -
        new Date(b.airDate || 0).getTime(),
    )
    .reduce<Record<string, UpcomingEpisodeItem[]>>((groups, item) => {
      const key = item.airDate || "Unknown date";
      groups[key] = groups[key] ? [...groups[key], item] : [item];
      return groups;
    }, {});

  const finalGroups: Record<string, UpcomingEpisodeItem[]> = {};

  for (const [dateKey, items] of Object.entries(byDate)) {
    finalGroups[dateKey] = collapseEpisodeDrops(items);
  }

  return finalGroups;
}

export default async function CalendarPage() {
  const [{ user, upcoming }, pageBackdrop] = await Promise.all([
    getCalendarData(),
    getTrendingBackdropUrl(),
  ]);

  if (!user) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-black">
        <div className="text-zinc-400">Redirecting to auth...</div>
      </div>
    );
  }

  const groupedByDate = groupByDate(upcoming);
  const todayKey = new Date().toISOString().split("T")[0];

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
              upcoming release list
            </p>
            <h1 className="text-3xl font-bold text-white md:text-4xl">
              Calendar
            </h1>
          </div>

          <Link
            href="/"
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20"
          >
            Back home
          </Link>
        </div>

        {upcoming.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/60 p-12 text-center">
            <h2 className="text-2xl font-semibold text-white">
              No upcoming releases
            </h2>
            <p className="mt-3 text-zinc-400">
              Watch some shows or add movies and TV shows to your watchlist to
              see upcoming releases here.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedByDate).map(([dateKey, items]) => {
              const dateLabel =
                dateKey === "Unknown date"
                  ? "Unknown date"
                  : (() => {
                      const date = new Date(dateKey);
                      const weekday = date.toLocaleDateString("en-US", { weekday: "short" });
                      const month = date.toLocaleDateString("en-US", { month: "short" });
                      const day = date.getDate();
                      const year = date.getFullYear();
                      const isToday = dateKey === todayKey;
                      const formatted = `${weekday.charAt(0).toUpperCase() + weekday.slice(1).toLowerCase()}, ${month.charAt(0).toUpperCase() + month.slice(1).toLowerCase()} ${day}, ${year}`;
                      return isToday ? `Today · ${formatted}` : formatted;
                    })();

              return (
                <section
                  key={dateKey}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5"
                >
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-violet-400/80">
                        Releases
                      </p>
                      <h2 className="text-xl font-bold text-white">
                        {dateLabel}
                      </h2>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
                    {items.map((item) => {
                      const isMovie =
                        item.seasonNumber === null &&
                        item.episodeNumber === null;
                      const mediaType = isMovie ? "movie" : "tv";
                      const itemWithMeta = item as any;
                      const isEntireSeason = itemWithMeta.isEntireSeason;
                      const episodeRange = itemWithMeta.episodeRange;

                      const linkHref = isMovie
                        ? `/media/${item.tmdbId}?type=movie`
                        : isEntireSeason || episodeRange
                          ? `/media/${item.tmdbId}?type=tv`
                          : `/media/${item.tmdbId}/season/${item.seasonNumber}/episode/${item.episodeNumber}?type=tv`;

                      return (
                        <div
                          key={`${item.tmdbId}-${item.seasonNumber || "movie"}-${item.episodeNumber || "movie"}-${item.airDate || "unknown"}`}
                          className="group w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/80 transition hover:border-violet-500/50"
                        >
                          <Link href={linkHref} className="block">
                            <div className="relative aspect-[2/3] overflow-hidden">
                              {!isMovie && (
                                <EpisodeTypeBadge
                                  episodeType={item.episodeType}
                                />
                              )}
                              <Image
                                src={getPosterUrl(
                                  item.seasonPosterPath || item.posterPath || null,
                                )}
                                alt={
                                  isMovie
                                    ? item.title
                                    : item.episodeTitle || item.title
                                }
                                fill
                                sizes="(max-width: 640px) 25vw, (max-width: 768px) 20vw, (max-width: 1024px) 16vw, (max-width: 1280px) 12vw, 10vw"
                                className="object-cover transition duration-300 group-hover:scale-105"
                              />
                            </div>
                          </Link>

                          <div className="space-y-1 border-t border-zinc-800 px-2 py-2">
                            <div className="line-clamp-2 text-xs font-semibold text-white leading-tight">
                              <Link
                                href={`/media/${item.tmdbId}?type=${isMovie ? "movie" : "tv"}`}
                                className="transition-colors hover:text-violet-200 hover:underline"
                              >
                                {item.title}
                              </Link>
                            </div>
                            {!isMovie && (
                              <Link href={linkHref} className="block">
                                {item.episodeTitle && !isEntireSeason && !episodeRange && (
                                  <div className="line-clamp-1 text-[10px] text-zinc-400">
                                    {item.episodeTitle}
                                  </div>
                                )}
                                <div className="text-[10px] text-zinc-400">
                                  {isEntireSeason
                                    ? `Season ${item.seasonNumber}`
                                    : episodeRange
                                      ? `S${item.seasonNumber} ${episodeRange}`
                                      : `S${item.seasonNumber} E${item.episodeNumber}`}
                                </div>
                              </Link>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
