import { NextRequest, NextResponse } from "next/server";
import { getAchievementSummary, type AchievementStats } from "@/lib/achievements";
import { prisma } from "@/lib/prisma";
import { lookupMediaDetails } from "@/lib/tmdb";
import { createClient } from "@/lib/supabase/server";

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

export async function GET(request: NextRequest) {
  try {
    const cursorParam = request.nextUrl.searchParams.get("genreCursor");
    const cursor = cursorParam === null ? null : Number(cursorParam);
    if (
      cursor !== null &&
      (!Number.isSafeInteger(cursor) || cursor < 0)
    ) {
      return NextResponse.json(
        { error: "Invalid genre sync cursor" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      select: { id: true },
    });

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          supabaseUserId: user.id,
          email: user.email,
          username: user.user_metadata?.username || user.email.split("@")[0],
        },
        select: { id: true },
      });
    }

    const [totalWatches, episodeWatches, ratings, watchDates] =
      await Promise.all([
        prisma.watchHistory.count({ where: { userId: dbUser.id } }),
        prisma.watchHistory.count({
          where: {
            userId: dbUser.id,
            seasonNumber: { not: null },
            episodeNumber: { not: null },
            media: { is: { mediaType: "tv" } },
          },
        }),
        prisma.userRating.findMany({
          where: { userId: dbUser.id },
          select: { score: true },
        }),
        prisma.watchHistory.findMany({
          where: { userId: dbUser.id },
          select: { watchedAt: true },
        }),
      ]);

    const genreSync =
      request.nextUrl.searchParams.get("skipGenreSync") === "true"
        ? { cursor: null, failed: 0, httpStatuses: [] }
        : await syncMissingGenres(dbUser.id, cursor);
    const mediaWithGenres = await prisma.media.findMany({
      where: { watchHistory: { some: { userId: dbUser.id } } },
      select: {
        mediaType: true,
        genreIds: true,
        releaseDate: true,
      },
    });

    const activeDateKeys = new Set(
      watchDates.map(({ watchedAt }) => watchedAt.toISOString().slice(0, 10)),
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

    const watchedDates = watchDates.map(({ watchedAt }) => watchedAt);
    const activeMonths = new Set(
      watchedDates.map(
        (watchedAt) =>
          `${watchedAt.getUTCFullYear()}-${watchedAt.getUTCMonth()}`,
      ),
    );
    const weekendWatches = watchedDates.filter((watchedAt) => {
      const day = watchedAt.getUTCDay();
      return day === 0 || day === 6;
    }).length;
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
    };

    return NextResponse.json({
      ...getAchievementSummary(stats),
      genreSync,
    });
  } catch (error) {
    console.error("Error fetching achievements:", error);
    return NextResponse.json(
      { error: "Failed to fetch achievements" },
      { status: 500 },
    );
  }
}
