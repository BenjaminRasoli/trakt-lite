import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getTVSeasonDetails } from "@/lib/tmdb";

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

async function computeNextUpForUser(userId: string) {
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

  const sortedShows = [...latestByShow.values()].sort(
    (a, b) => b.watchedAt.getTime() - a.watchedAt.getTime(),
  );

  const computedShows = await mapWithConcurrency(
    sortedShows,
    3,
    async (show) => {
      const currentSeason = show.seasonNumber;
      const currentEpisode = show.episodeNumber;

      const currentSeasonDetails = await getCachedSeasonDetails(
        show.tmdbId,
        currentSeason,
      );

      const nextEpisodeInCurrentSeason = currentSeasonDetails?.episodes
        ?.filter(
          (episode: { episode_number?: number; air_date?: string | null }) =>
            Number(episode.episode_number) > currentEpisode &&
            isReleasedEpisode(episode),
        )
        .sort(
          (a: { episode_number?: number }, b: { episode_number?: number }) =>
            Number(a.episode_number ?? 0) - Number(b.episode_number ?? 0),
        )[0];

      if (nextEpisodeInCurrentSeason) {
        return {
          tmdbId: show.tmdbId,
          title: show.title,
          posterPath: show.posterPath,
          backdropPath: show.backdropPath,
          seasonNumber: currentSeason,
          episodeNumber: Number(nextEpisodeInCurrentSeason.episode_number),
          episodeTitle:
            nextEpisodeInCurrentSeason.name ||
            `Episode ${Number(nextEpisodeInCurrentSeason.episode_number)}`,
          overview: nextEpisodeInCurrentSeason.overview || null,
          lastWatchedAt: show.watchedAt,
        };
      }

      const nextSeasonDetails = await getCachedSeasonDetails(
        show.tmdbId,
        currentSeason + 1,
      );
      const firstReleasedEpisodeNextSeason = nextSeasonDetails?.episodes
        ?.filter(
          (episode: { episode_number?: number; air_date?: string | null }) =>
            Number(episode.episode_number) >= 1 && isReleasedEpisode(episode),
        )
        .sort(
          (a: { episode_number?: number }, b: { episode_number?: number }) =>
            Number(a.episode_number ?? 0) - Number(b.episode_number ?? 0),
        )[0];

      if (!firstReleasedEpisodeNextSeason) return null;

      return {
        tmdbId: show.tmdbId,
        title: show.title,
        posterPath: show.posterPath,
        backdropPath: show.backdropPath,
        seasonNumber: currentSeason + 1,
        episodeNumber: Number(firstReleasedEpisodeNextSeason.episode_number),
        episodeTitle:
          firstReleasedEpisodeNextSeason.name ||
          `Episode ${Number(firstReleasedEpisodeNextSeason.episode_number)}`,
        overview: firstReleasedEpisodeNextSeason.overview || null,
        lastWatchedAt: show.watchedAt,
      };
    },
  );

  return computedShows.filter(Boolean);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let dbUser = await prisma.user.findUnique({
      where: { email: user.email! },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const cachedNextUp = await prisma.nextUpCache.findMany({
      where: { userId: dbUser.id },
      orderBy: { lastWatchedAt: "desc" },
      take: 20,
    });

    let nextUpItems: any[] = [];

    if (cachedNextUp.length > 0) {
      nextUpItems = cachedNextUp.map((item: any) => ({
        tmdbId: item.tmdbId,
        title: item.title,
        posterPath: item.posterPath,
        seasonNumber: item.seasonNumber,
        episodeNumber: item.episodeNumber,
        episodeTitle: item.episodeTitle,
        overview: item.overview,
      }));
    } else {
      // Compute on the fly if cache is empty
      const computedNextUp = await computeNextUpForUser(dbUser.id);
      nextUpItems = computedNextUp.map((item: any) => ({
        tmdbId: item.tmdbId,
        title: item.title,
        posterPath: item.posterPath,
        seasonNumber: item.seasonNumber,
        episodeNumber: item.episodeNumber,
        episodeTitle: item.episodeTitle,
        overview: item.overview,
      }));
    }

    return NextResponse.json({ nextUp: nextUpItems });
  } catch (error) {
    console.error("Error fetching next up:", error);
    return NextResponse.json(
      { error: "Failed to fetch next up" },
      { status: 500 },
    );
  }
}
