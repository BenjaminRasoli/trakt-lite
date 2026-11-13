import { cache } from "react";
import { prisma } from "@/lib/prisma";
import {
  getAchievementSummary,
  type AchievementApiResponse,
  type AchievementStats,
} from "@/lib/achievements";
import { lookupMediaDetails } from "@/lib/tmdb";

const GENRE_SYNC_BATCH_SIZE = 20;
const GENRE_SYNC_CONCURRENCY = 5;

async function syncMissingGenres(
  userId: string,
  afterTmdbId: number | null,
): Promise<{
  cursor: number | null;
  failed: number;
  httpStatuses: number[];
}> {
  const missingMedia = await prisma.media.findMany({
    where: {
      genreIds: { isEmpty: true },
      watchHistory: { some: { userId } },
      ...(afterTmdbId === null ? {} : { tmdbId: { gt: afterTmdbId } }),
    },
    select: { id: true, tmdbId: true, mediaType: true },
    orderBy: { tmdbId: "asc" },
    take: GENRE_SYNC_BATCH_SIZE + 1,
  });

  const batch = missingMedia.slice(0, GENRE_SYNC_BATCH_SIZE);
  let nextIndex = 0;
  let failed = 0;
  const httpStatuses: number[] = [];
  const workers = Array.from(
    { length: Math.min(GENRE_SYNC_CONCURRENCY, batch.length) },
    async () => {
      while (nextIndex < batch.length) {
        const media = batch[nextIndex++];
        const result = await lookupMediaDetails(
          media.tmdbId,
          media.mediaType === "tv" ? "tv" : "movie",
        );

        if (result.status === "found" && result.media.genre_ids.length > 0) {
          await prisma.media.update({
            where: { id: media.id },
            data: { genreIds: result.media.genre_ids },
          });
        } else if (result.status === "unavailable") {
          failed += 1;
          if (result.httpStatus) httpStatuses.push(result.httpStatus);
        }
      }
    },
  );
  await Promise.all(workers);

  return {
    cursor:
      missingMedia.length > GENRE_SYNC_BATCH_SIZE
        ? batch[batch.length - 1].tmdbId
        : null,
    failed,
    httpStatuses: [...new Set(httpStatuses)],
  };
}

export async function getAchievementDataForUser(
  userId: string,
  {
    skipGenreSync = false,
    genreCursor = null,
  }: { skipGenreSync?: boolean; genreCursor?: number | null } = {},
): Promise<AchievementApiResponse> {
  const [totalWatches, episodeWatches, ratings, watchEntries, watchlistCount] =
    await Promise.all([
      prisma.watchHistory.count({ where: { userId } }),
      prisma.watchHistory.count({
        where: {
          userId,
          seasonNumber: { not: null },
          episodeNumber: { not: null },
          media: { is: { mediaType: "tv" } },
        },
      }),
      prisma.userRating.findMany({
        where: { userId },
        select: { score: true },
      }),
      prisma.watchHistory.findMany({
        where: { userId },
        select: {
          watchedAt: true,
          mediaId: true,
          seasonNumber: true,
          episodeNumber: true,
        },
      }),
      prisma.watchlistEntry.count({ where: { userId } }),
    ]);

  const genreSync = skipGenreSync
    ? { cursor: null, failed: 0, httpStatuses: [] }
    : await syncMissingGenres(userId, genreCursor);
  const mediaWithGenres = await prisma.media.findMany({
    where: { watchHistory: { some: { userId } } },
    select: {
      mediaType: true,
      genreIds: true,
      releaseDate: true,
    },
  });

  const activeDateKeys = new Set(
    watchEntries.map(({ watchedAt }) => watchedAt.toISOString().slice(0, 10)),
  );
  const sortedActiveDates = [...activeDateKeys].sort();
  let longestStreak = 0;
  let currentStreak = 0;
  let previousDay = -1;

  for (const dateKey of sortedActiveDates) {
    const day = Date.parse(`${dateKey}T00:00:00.000Z`);
    currentStreak = day === previousDay + 86_400_000 ? currentStreak + 1 : 1;
    longestStreak = Math.max(longestStreak, currentStreak);
    previousDay = day;
  }

  const watchedDates = watchEntries.map(({ watchedAt }) => watchedAt);
  const activeMonths = new Set(
    watchedDates.map(
      (watchedAt) =>
        `${watchedAt.getUTCFullYear()}-${watchedAt.getUTCMonth()}`,
    ),
  );
  const activeYears = new Set(
    watchedDates.map((watchedAt) => watchedAt.getUTCFullYear()),
  );
  const weekendWatches = watchedDates.filter((watchedAt) => {
    const day = watchedAt.getUTCDay();
    return day === 0 || day === 6;
  }).length;
  const lateNight = watchedDates.filter((watchedAt) => {
    const hour = watchedAt.getUTCHours();
    return hour >= 23 || hour <= 4;
  }).length;
  const watchesPerDay = new Map<string, number>();
  for (const dateKey of activeDateKeys) {
    watchesPerDay.set(dateKey, 0);
  }
  for (const { watchedAt } of watchEntries) {
    const dateKey = watchedAt.toISOString().slice(0, 10);
    watchesPerDay.set(dateKey, (watchesPerDay.get(dateKey) ?? 0) + 1);
  }
  const longestDay = Math.max(0, ...watchesPerDay.values());
  const uniqueWatchKeys = new Set(
    watchEntries.map(
      ({ mediaId, seasonNumber, episodeNumber }) =>
        `${mediaId}:${seasonNumber ?? ""}:${episodeNumber ?? ""}`,
    ),
  );
  const rewatch = Math.max(0, totalWatches - uniqueWatchKeys.size);
  const filmEras = new Set(
    mediaWithGenres.flatMap(({ releaseDate }) =>
      releaseDate ? [Math.floor(releaseDate.getUTCFullYear() / 10)] : [],
    ),
  );

  const stats: AchievementStats = {
    totalWatches,
    movies: mediaWithGenres.filter((media) => media.mediaType === "movie")
      .length,
    episodes: episodeWatches,
    tvShows: mediaWithGenres.filter((media) => media.mediaType === "tv")
      .length,
    genres: new Set(
      mediaWithGenres.flatMap((media) => media.genreIds ?? []),
    ).size,
    ratings: ratings.length,
    highRatings: ratings.filter((rating) => rating.score >= 9).length,
    lowRatings: ratings.filter((rating) => rating.score <= 3).length,
    activeDays: activeDateKeys.size,
    longestStreak,
    weekendWatches,
    activeMonths: activeMonths.size,
    filmEras: filmEras.size,
    watchlist: watchlistCount,
    rewatch,
    longestDay,
    lateNight,
    activeYears: activeYears.size,
    perfectRatings: ratings.filter((rating) => rating.score >= 9.5).length,
  };

  return {
    ...getAchievementSummary(stats),
    genreSync,
  };
}

export const getAchievementSummaryForUser = cache(
  async (userId: string) => {
    return getAchievementDataForUser(userId, { skipGenreSync: true });
  },
);
