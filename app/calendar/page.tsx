import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  getPosterUrl,
  getRandomBackdropUrl,
  getTrendingMedia,
  getTVSeasonDetails,
} from "@/lib/tmdb";

interface UpcomingEpisodeItem {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  episodeTitle: string | null;
  overview: string | null;
  airDate: string | null;
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
  return Number.isFinite(airDate.getTime()) && airDate > new Date();
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
        airDate: { gte: new Date() },
      },
      orderBy: { airDate: "asc" },
      take: 100,
    });

    if (cachedUpcoming.length > 0) {
      return {
        user,
        upcoming: cachedUpcoming.map((item: any) => ({
          tmdbId: item.tmdbId,
          title: item.title,
          posterPath: item.posterPath,
          backdropPath: item.backdropPath,
          seasonNumber: item.seasonNumber,
          episodeNumber: item.episodeNumber,
          episodeTitle: item.episodeTitle,
          overview: item.overview,
          airDate: item.airDate ? item.airDate.toISOString().split('T')[0] : null,
        })).slice(0, 40),
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

  for (const item of watchlist) {
    const media = item.media;
    const releaseDate = media.releaseDate;

    if (!releaseDate) continue;

    const releaseDateObj = new Date(releaseDate);
    const now = new Date();

    if (releaseDateObj >= now) {
      if (media.mediaType === "tv") {
        try {
          const season1Details = await getTVSeasonDetails(media.tmdbId, 1);
          const episodes = season1Details?.episodes || [];

          for (const episode of episodes) {
            if (episode?.air_date) {
              const episodeAirDate = new Date(episode.air_date);
              if (episodeAirDate >= now) {
                upcoming.push({
                  tmdbId: media.tmdbId,
                  title: media.title,
                  posterPath: media.posterPath,
                  backdropPath: media.backdropPath,
                  seasonNumber: 1,
                  episodeNumber: Number(episode.episode_number),
                  episodeTitle: episode.name || `Episode ${Number(episode.episode_number)}`,
                  overview: episode.overview || media.overview,
                  airDate: normalizeDate(episode.air_date),
                });
              }
            }
          }
        } catch (error) {
          console.error("Error fetching TV season details:", error);
        }
      } else {
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
    }
  }

  return {
    user,
    upcoming: upcoming
      .sort(
        (a, b) =>
          new Date(a.airDate || 0).getTime() - new Date(b.airDate || 0).getTime(),
      )
      .slice(0, 40),
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
    const byShow = items.reduce<Record<number, UpcomingEpisodeItem[]>>(
      (showGroups, item) => {
        showGroups[item.tmdbId] = showGroups[item.tmdbId]
          ? [...showGroups[item.tmdbId], item]
          : [item];
        return showGroups;
      },
      {},
    );

    const combinedItems: UpcomingEpisodeItem[] = [];

    for (const showItems of Object.values(byShow)) {
      if (showItems.length === 1) {
        combinedItems.push(showItems[0]);
      } else {
        const seasons = new Set(showItems.map((item) => item.seasonNumber));
        const allSameSeason = seasons.size === 1;

        if (allSameSeason) {
          const seasonNumber = showItems[0].seasonNumber;
          const episodeNumbers = showItems
            .map((item) => item.episodeNumber)
            .filter((n): n is number => n !== null)
            .sort((a, b) => a - b);

          if (episodeNumbers.length > 0) {
            const minEp = episodeNumbers[0];
            const maxEp = episodeNumbers[episodeNumbers.length - 1];

            const combined: UpcomingEpisodeItem = {
              ...showItems[0],
              episodeTitle:
                minEp === maxEp
                  ? showItems[0].episodeTitle
                  : `Season ${seasonNumber}`,
            };

            (combined as any).episodeRange =
              minEp === maxEp ? `E${minEp}` : `E${minEp}-${maxEp}`;
            (combined as any).isEntireSeason = episodeNumbers.length > 5;

            combinedItems.push(combined);
          }
        } else {
          combinedItems.push(...showItems);
        }
      }
    }

    finalGroups[dateKey] = combinedItems;
  }

  return finalGroups;
}

export default async function CalendarPage() {
  const { user, upcoming } = await getCalendarData();
  const trendingMedia = await getTrendingMedia();
  const pageBackdrop = getRandomBackdropUrl(trendingMedia);

  if (!user) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-black">
        <div className="text-zinc-400">Redirecting to auth...</div>
      </div>
    );
  }

  const groupedByDate = groupByDate(upcoming);

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
                      return `${weekday.charAt(0).toUpperCase() + weekday.slice(1).toLowerCase()}, ${month.charAt(0).toUpperCase() + month.slice(1).toLowerCase()} ${day}, ${year}`;
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
                        <Link
                          key={`${item.tmdbId}-${item.seasonNumber || "movie"}-${item.episodeNumber || "movie"}-${item.airDate || "unknown"}`}
                          href={linkHref}
                          className="group w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/80 transition hover:border-violet-500/50"
                        >
                          <div className="relative aspect-[2/3] overflow-hidden">
                            <Image
                              src={getPosterUrl(item.posterPath || null)}
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

                          <div className="space-y-1 border-t border-zinc-800 px-2 py-2">
                            <div className="line-clamp-2 text-xs font-semibold text-white leading-tight">
                              {!isMovie ? (
                                <span className="hover:underline hover:text-violet-200 transition-colors cursor-pointer">
                                  {item.title}
                                </span>
                              ) : (
                                <span>{item.title}</span>
                              )}
                            </div>
                            {!isMovie && item.episodeTitle && !isEntireSeason && !episodeRange && (
                              <div className="line-clamp-1 text-[10px] text-zinc-400">
                                {item.episodeTitle}
                              </div>
                            )}
                            {!isMovie && (
                              <div className="text-[10px] text-zinc-400">
                                {isEntireSeason
                                  ? `Season ${item.seasonNumber}`
                                  : episodeRange
                                    ? `S${item.seasonNumber} ${episodeRange}`
                                    : `S${item.seasonNumber} E${item.episodeNumber}`}
                              </div>
                            )}
                          </div>
                        </Link>
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
