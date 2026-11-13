import { prisma } from "@/lib/prisma";
import { getDroppedNextUpShows } from "@/lib/dropped-next-up-shows";
import { computeNextUpForUser } from "@/lib/next-up-data";
import {
  addSeasonPosterPaths,
  addEpisodeTypes,
  addNextUpEpisodeInfo,
  getMediaDetails,
  getTVSeasonDetails,
} from "@/lib/tmdb";

const mediaCache = new Map<string, any>();
const CACHE_TTL = 5 * 60 * 1000;
const cacheTimestamps = new Map<string, number>();

async function hydrateMissingMediaMetadata(media: {
  tmdbId: number;
  title: string;
  mediaType?: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string | null;
}) {
  if (!media.tmdbId || media.posterPath) {
    return media;
  }

  const cacheKey = `${media.tmdbId}:${media.mediaType}`;
  const now = Date.now();

  if (mediaCache.has(cacheKey)) {
    const cacheTime = cacheTimestamps.get(cacheKey) || 0;
    if (now - cacheTime < CACHE_TTL) {
      const cached = mediaCache.get(cacheKey);
      return {
        ...media,
        title: cached.title || media.title,
        posterPath: cached.posterPath || media.posterPath,
        backdropPath: cached.backdropPath || media.backdropPath,
        overview: cached.overview || media.overview,
      };
    }
  }

  const mediaType = media.mediaType === "tv" ? "tv" : "movie";
  const tmdbMedia = await getMediaDetails(media.tmdbId, mediaType);

  if (!tmdbMedia) {
    return media;
  }

  const hydratedMedia = {
    ...media,
    title: tmdbMedia.title || tmdbMedia.name || media.title || "Unknown",
    posterPath: tmdbMedia.poster_path || media.posterPath,
    backdropPath: tmdbMedia.backdrop_path || media.backdropPath,
    overview: tmdbMedia.overview || media.overview || "",
  };

  mediaCache.set(cacheKey, {
    title: hydratedMedia.title,
    posterPath: hydratedMedia.posterPath,
    backdropPath: hydratedMedia.backdropPath,
    overview: hydratedMedia.overview,
  });
  cacheTimestamps.set(cacheKey, now);

  prisma.media
    .upsert({
      where: { tmdbId: media.tmdbId },
      update: {
        title: hydratedMedia.title,
        posterPath: hydratedMedia.posterPath || null,
        backdropPath: hydratedMedia.backdropPath || null,
        overview: hydratedMedia.overview || null,
        mediaType,
      },
      create: {
        tmdbId: media.tmdbId,
        title: hydratedMedia.title,
        mediaType,
        posterPath: hydratedMedia.posterPath || null,
        backdropPath: hydratedMedia.backdropPath || null,
        overview: hydratedMedia.overview || null,
        voteAverage: tmdbMedia.vote_average || 0,
        genreIds: tmdbMedia.genre_ids || [],
        releaseDate:
          tmdbMedia.release_date || tmdbMedia.first_air_date
            ? new Date(tmdbMedia.release_date || tmdbMedia.first_air_date || "")
            : null,
      },
    })
    .catch((err) => console.error("Error updating media metadata:", err));

  return hydratedMedia;
}

function isReleasedEpisode(
  episode:
    | {
        air_date?: string | null;
      }
    | null
    | undefined,
) {
  if (!episode?.air_date) return false;

  const airDate = new Date(episode.air_date);
  return Number.isFinite(airDate.getTime()) && airDate <= new Date();
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

function normalizeDate(dateInput: string | Date | null | undefined): string | null {
  if (!dateInput) return null;
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function getNextUpQueue(userId: string, limit = 6) {
  const { tmdbIds: droppedTmdbIds, available: droppedShowStorageAvailable } =
    await getDroppedNextUpShows(userId);

  try {
    const cachedNextUp = await prisma.nextUpCache.findMany({
      where: {
        userId,
        ...(droppedTmdbIds.size > 0
          ? { tmdbId: { notIn: [...droppedTmdbIds] } }
          : {}),
      },
      orderBy: { lastWatchedAt: "desc" },
      take: limit,
    });

    if (cachedNextUp.length > 0) {
      return {
        items: cachedNextUp.map((item: any) => ({
          tmdbId: item.tmdbId,
          title: item.title,
          posterPath: item.posterPath,
          backdropPath: item.backdropPath,
          seasonNumber: item.seasonNumber,
          episodeNumber: item.episodeNumber,
          episodeTitle: item.episodeTitle,
          overview: item.overview,
        })),
        droppedShowStorageAvailable,
      };
    }
  } catch (error) {
    console.error("Error reading from nextUpCache, falling back to computation:", error);
  }

  const computedNextUp = await computeNextUpForUser(userId);

  return {
    items: computedNextUp
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .filter((item) => !droppedTmdbIds.has(item.tmdbId))
      .slice(0, limit)
      .map((item) => ({
        tmdbId: item.tmdbId,
        title: item.title,
        posterPath: item.posterPath,
        backdropPath: item.backdropPath,
        seasonNumber: item.seasonNumber,
        episodeNumber: item.episodeNumber,
        episodeTitle: item.episodeTitle,
        overview: item.overview,
      })),
    droppedShowStorageAvailable,
  };
}

async function getUpcomingEpisodesQueue(userId: string, limit = 6) {
  try {
    const cachedUpcoming = await (prisma as any).upcomingEpisodesCache.findMany({
      where: {
        userId,
        airDate: { gte: startOfTodayUtc() },
      },
      orderBy: { airDate: "asc" },
      take: limit,
    });

    if (cachedUpcoming.length > 0) {
      return cachedUpcoming.map((item: any) => ({
        tmdbId: item.tmdbId,
        title: item.title,
        posterPath: item.posterPath,
        backdropPath: item.backdropPath,
        seasonNumber: item.seasonNumber,
        episodeNumber: item.episodeNumber,
        episodeTitle: item.episodeTitle,
        overview: item.overview,
        airDate: item.airDate ? item.airDate.toISOString().split('T')[0] : null,
      }));
    }
  } catch (error) {
    console.error("Error reading from upcomingEpisodesCache, falling back to computation:", error);
  }

  const watchHistory = await prisma.watchHistory.findMany({
    where: {
      userId,
      media: { mediaType: "tv" },
      seasonNumber: { not: null },
      episodeNumber: { not: null },
    },
    include: { media: true },
    orderBy: {
      watchedAt: "desc",
    },
    take: 500
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
    seasonNumber: number;
    episodeNumber: number;
    episodeTitle: string;
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

  return upcoming
    .sort(
      (a, b) =>
        new Date(a.airDate || 0).getTime() - new Date(b.airDate || 0).getTime(),
    )
    .slice(0, limit);
}

async function getUpcomingWatchlistReleases(userId: string, limit = 40) {
  const [watchlist, watchHistory] = await Promise.all([
    prisma.watchlist.findMany({
      where: {
        userId,
      },
      include: {
        media: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 500,
    }),
    prisma.watchHistory.findMany({
      where: {
        userId,
        media: { mediaType: "tv" },
      },
      select: {
        media: {
          select: {
            tmdbId: true,
          },
        },
      },
    }),
  ]);

  const watchedTvTmdbIds = new Set(
    watchHistory.map((item) => item.media.tmdbId),
  );

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

  const upcomingReleases: any[] = [];

  await mapWithConcurrency(watchlist, 3, async (item) => {
    const media = item.media;

    if (media.mediaType === "tv") {
      if (watchedTvTmdbIds.has(media.tmdbId)) return;

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
            upcomingReleases.push({
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
      upcomingReleases.push({
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

  return upcomingReleases
    .sort(
      (a, b) =>
        new Date(a.airDate || 0).getTime() - new Date(b.airDate || 0).getTime(),
    )
    .slice(0, limit);
}

export async function getWatchHistoryItems(
  userId: string,
  {
    limit = 40,
    offset = 0,
    mediaType,
  }: {
    limit?: number;
    offset?: number;
    mediaType?: "movie" | "tv";
  } = {},
) {
  const whereClause: any = {
    userId,
  };

  if (mediaType === "movie" || mediaType === "tv") {
    whereClause.media = {
      mediaType,
    };
  }

  const watchHistory = await prisma.watchHistory.findMany({
    where: whereClause,
    select: {
      id: true,
      userId: true,
      mediaId: true,
      seasonNumber: true,
      episodeNumber: true,
      episodeName: true,
      watchedAt: true,
      createdAt: true,
      updatedAt: true,
      media: true,
    },
    orderBy: {
      watchedAt: "desc",
    },
    skip: offset,
    take: limit + 1,
  });

  const hasMore = watchHistory.length > limit;
  const pageItems = hasMore ? watchHistory.slice(0, limit) : watchHistory;

  const entriesWithSeasonPosters = await addSeasonPosterPaths(
    pageItems.map((entry) => ({
      tmdbId: entry.media.tmdbId,
      seasonNumber: entry.seasonNumber,
    })),
  );

  const itemsWithPosters = await Promise.all(
    pageItems.map(async (entry, index) => {
      const media = await hydrateMissingMediaMetadata({
        tmdbId: entry.media.tmdbId,
        title: entry.media.title || "Unknown",
        mediaType: entry.media.mediaType,
        posterPath: entry.media.posterPath,
        backdropPath: entry.media.backdropPath,
        overview: entry.media.overview,
      });

      return {
        id: entry.id,
        userId: entry.userId,
        mediaId: entry.mediaId,
        seasonNumber: entry.seasonNumber,
        episodeNumber: entry.episodeNumber,
        episodeName: entry.episodeName,
        watchedAt: entry.watchedAt.toISOString(),
        seasonPosterPath: entriesWithSeasonPosters[index].seasonPosterPath,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        media: {
          ...entry.media,
          mediaType: entry.media.mediaType as "movie" | "tv",
          title: media.title || "Unknown",
          posterPath: media.posterPath || null,
          backdropPath: media.backdropPath || null,
          overview: media.overview || "",
        },
      };
    }),
  );

  return { items: itemsWithPosters, hasMore };
}

export async function getProfileWatchHistory(userId: string) {
  const entries = await prisma.watchHistory.findMany({
    where: { userId },
    select: {
      mediaId: true,
      seasonNumber: true,
      episodeNumber: true,
      watchedAt: true,
      media: {
        select: {
          tmdbId: true,
          title: true,
          mediaType: true,
        },
      },
    },
    orderBy: {
      watchedAt: "desc",
    },
  });

  return entries.map((entry) => ({
    mediaId: entry.mediaId,
    watchedAt: entry.watchedAt.toISOString(),
    seasonNumber: entry.seasonNumber,
    episodeNumber: entry.episodeNumber,
    media: entry.media
      ? {
          tmdbId: entry.media.tmdbId,
          title: entry.media.title,
          mediaType: entry.media.mediaType,
        }
      : undefined,
  }));
}

async function getWatchStreak(userId: string) {
  const streakRows = await prisma.$queryRaw<{ d: string }[]>`
    SELECT DISTINCT to_char("watchedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS d
    FROM "WatchHistory"
    WHERE "userId" = ${userId}
    ORDER BY d DESC
  `;
  const dayMs = 86_400_000;
  const todayUtc = Date.parse(
    `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`,
  );
  let currentStreak = 0;
  let expectedDay = -1;
  for (const { d } of streakRows) {
    const t = Date.parse(`${d}T00:00:00.000Z`);
    if (expectedDay === -1) {
      if (t !== todayUtc && t !== todayUtc - dayMs) break;
      expectedDay = t;
    } else {
      if (t !== expectedDay - dayMs) break;
      expectedDay = t;
    }
    currentStreak++;
  }
  return currentStreak;
}

export async function getWatchHistoryFeed(
  userId: string,
  {
    limit = 40,
    offset = 0,
    mediaType,
    includeNextUp = false,
    includeUpcoming = false,
    nextUpLimit = 12,
    includeStreak = true,
  }: {
    limit?: number;
    offset?: number;
    mediaType?: "movie" | "tv";
    includeNextUp?: boolean;
    includeUpcoming?: boolean;
    nextUpLimit?: number;
    includeStreak?: boolean;
  } = {},
) {
  const [historyResult, nextUpResult, upcomingQueue, watchlistUpcoming, currentStreak] =
    await Promise.all([
      getWatchHistoryItems(userId, { limit, offset, mediaType }),
      includeNextUp
        ? getNextUpQueue(userId, nextUpLimit)
        : Promise.resolve({ items: [], droppedShowStorageAvailable: true }),
      includeUpcoming
        ? getUpcomingEpisodesQueue(userId, nextUpLimit)
        : Promise.resolve([]),
      includeUpcoming
        ? getUpcomingWatchlistReleases(userId, limit)
        : Promise.resolve([]),
      includeStreak ? getWatchStreak(userId) : Promise.resolve(0),
    ]);

  const nextUp = nextUpResult.items;
  const upcoming = upcomingQueue;

  const hydratedNextUp = await Promise.all(
    nextUp
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map(async (item) => {
        const hydrated = await hydrateMissingMediaMetadata({
          tmdbId: item.tmdbId,
          title: item.title,
          mediaType: "tv",
          posterPath: item.posterPath,
          backdropPath: item.backdropPath,
          overview: item.overview,
        });

        return {
          ...item,
          title: hydrated.title,
          posterPath: hydrated.posterPath || null,
          backdropPath: hydrated.backdropPath || null,
          overview: hydrated.overview || null,
        };
      }),
  );

  const hydratedUpcoming = await Promise.all(
    upcoming
      .filter((item: any): item is NonNullable<any> => Boolean(item))
      .map(async (item: any) => {
        const hydrated = await hydrateMissingMediaMetadata({
          tmdbId: item.tmdbId,
          title: item.title,
          mediaType: "tv",
          posterPath: item.posterPath,
          backdropPath: item.backdropPath,
          overview: item.overview,
        });

        return {
          ...item,
          title: hydrated.title,
          posterPath: hydrated.posterPath || null,
          backdropPath: hydrated.backdropPath || null,
          overview: hydrated.overview || null,
        };
      }),
  );

  const hydratedWatchlistUpcoming = await Promise.all(
    watchlistUpcoming
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map(async (item) => {
        const mediaType = item.seasonNumber !== null ? "tv" : "movie";
        const hydrated = await hydrateMissingMediaMetadata({
          tmdbId: item.tmdbId,
          title: item.title,
          mediaType,
          posterPath: item.posterPath,
          backdropPath: item.backdropPath,
          overview: item.overview,
        });

        return {
          ...item,
          title: hydrated.title,
          posterPath: hydrated.posterPath || null,
          backdropPath: hydrated.backdropPath || null,
          overview: hydrated.overview || null,
        };
      }),
  );

  const allUpcoming = [...hydratedUpcoming, ...hydratedWatchlistUpcoming]
    .map((item) => ({
      ...item,
      airDate: normalizeDate(item.airDate),
    }))
    .sort(
      (a, b) =>
        new Date(a.airDate || 0).getTime() - new Date(b.airDate || 0).getTime(),
    )
    .slice(0, limit);

  const [typedNextUp, typedUpcoming] = await Promise.all([
    addNextUpEpisodeInfo(hydratedNextUp),
    addEpisodeTypes(allUpcoming),
  ]);

  return {
    items: historyResult.items,
    hasMore: historyResult.hasMore,
    currentStreak,
    nextUp: typedNextUp,
    nextUpWarning: nextUpResult.droppedShowStorageAvailable
      ? null
      : "Next Up is showing, but dropped shows cannot be remembered until the database migration is applied.",
    upcoming: typedUpcoming,
  };
}
