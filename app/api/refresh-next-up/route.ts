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

async function computeUpcomingEpisodesForUser(userId: string) {
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

  const watchlist = await prisma.watchlist.findMany({
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
    airDate: Date | null;
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
          airDate: episode.air_date ? new Date(episode.air_date) : null,
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
          airDate: episode.air_date ? new Date(episode.air_date) : null,
        });
      }

      return null;
    },
  );

  await Promise.all(computedShows);

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
                  airDate: episode.air_date ? new Date(episode.air_date) : null,
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
          airDate: releaseDate,
        });
      }
    }
  }

  return upcoming
    .sort(
      (a, b) =>
        new Date(a.airDate || 0).getTime() - new Date(b.airDate || 0).getTime(),
    );
}

export async function POST(request: NextRequest) {
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

    const nextUpItems = await computeNextUpForUser(dbUser.id);

    await prisma.nextUpCache.deleteMany({
      where: { userId: dbUser.id },
    });

    if (nextUpItems.length > 0) {
      await prisma.nextUpCache.createMany({
        data: nextUpItems.map((item: any) => ({
          userId: dbUser.id,
          tmdbId: item.tmdbId,
          title: item.title,
          posterPath: item.posterPath,
          backdropPath: item.backdropPath,
          seasonNumber: item.seasonNumber,
          episodeNumber: item.episodeNumber,
          episodeTitle: item.episodeTitle,
          overview: item.overview,
          lastWatchedAt: item.lastWatchedAt,
        })),
        skipDuplicates: true,
      });
    }

    const upcomingItems = await computeUpcomingEpisodesForUser(dbUser.id);

    await (prisma as any).upcomingEpisodesCache.deleteMany({
      where: { userId: dbUser.id },
    });

    if (upcomingItems.length > 0) {
      await (prisma as any).upcomingEpisodesCache.createMany({
        data: upcomingItems.map((item: any) => ({
          userId: dbUser.id,
          tmdbId: item.tmdbId,
          title: item.title,
          posterPath: item.posterPath,
          backdropPath: item.backdropPath,
          seasonNumber: item.seasonNumber,
          episodeNumber: item.episodeNumber,
          episodeTitle: item.episodeTitle,
          overview: item.overview,
          airDate: item.airDate,
        })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({
      success: true,
      nextUpCount: nextUpItems.length,
      upcomingCount: upcomingItems.length,
    });
  } catch (error) {
    console.error("Error refreshing cache:", error);
    return NextResponse.json(
      { error: "Failed to refresh cache" },
      { status: 500 },
    );
  }
}
