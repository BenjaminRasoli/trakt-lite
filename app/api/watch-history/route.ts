import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getMediaDetails } from "@/lib/tmdb";

// Cache for TMDB API calls to reduce redundant requests
const mediaCache = new Map<string, any>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
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

  // Cache the result with timestamp
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
  // Only fetch TV shows with season/episode info, ordered by watchedAt
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
    take: 500, // Limit to recent history to improve performance
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

  const { getTVSeasonDetails } = await import("@/lib/tmdb");
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

  const nextUp: Array<{
    tmdbId: number;
    title: string;
    posterPath: string | null;
    backdropPath: string | null;
    seasonNumber: number;
    episodeNumber: number;
    episodeTitle: string;
    overview: string | null;
  }> = [];

  const sortedShows = [...latestByShow.values()].sort(
    (a, b) => b.watchedAt.getTime() - a.watchedAt.getTime(),
  );

  const computedShows = await mapWithConcurrency(
    sortedShows,
    3,
    async (show) => {
      const currentSeason = show.seasonNumber;
      const currentEpisode = show.episodeNumber;
      const now = new Date();

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
      };
    },
  );

  return computedShows.filter(Boolean).slice(0, limit) as typeof nextUp;
}

async function getUpcomingEpisodesQueue(userId: string, limit = 6) {
  // Only fetch TV shows with season/episode info, ordered by watchedAt
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
    take: 500, // Limit to recent history to improve performance
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

  const { getTVSeasonDetails } = await import("@/lib/tmdb");
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

  const upcoming = await mapWithConcurrency(
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
      const nextFutureEpisodeInCurrentSeason = currentSeasonDetails?.episodes
        ?.filter(
          (episode: { episode_number?: number; air_date?: string | null }) =>
            Number(episode.episode_number) > currentEpisode &&
            isFutureEpisode(episode),
        )
        .sort(
          (a: { air_date?: string | null }, b: { air_date?: string | null }) =>
            new Date(a.air_date || now).getTime() -
            new Date(b.air_date || now).getTime(),
        )[0];

      if (nextFutureEpisodeInCurrentSeason) {
        return {
          tmdbId: show.tmdbId,
          title: show.title,
          posterPath: show.posterPath,
          backdropPath: show.backdropPath,
          seasonNumber: currentSeason,
          episodeNumber: Number(
            nextFutureEpisodeInCurrentSeason.episode_number,
          ),
          episodeTitle:
            nextFutureEpisodeInCurrentSeason.name ||
            `Episode ${Number(nextFutureEpisodeInCurrentSeason.episode_number)}`,
          overview: nextFutureEpisodeInCurrentSeason.overview || null,
          airDate: normalizeDate(nextFutureEpisodeInCurrentSeason.air_date),
        };
      }

      const nextSeasonDetails = await getCachedSeasonDetails(
        show.tmdbId,
        currentSeason + 1,
      );
      const firstFutureEpisodeNextSeason = nextSeasonDetails?.episodes
        ?.filter(
          (episode: { episode_number?: number; air_date?: string | null }) =>
            Number(episode.episode_number) >= 1 && isFutureEpisode(episode),
        )
        .sort(
          (a: { air_date?: string | null }, b: { air_date?: string | null }) =>
            new Date(a.air_date || now).getTime() -
            new Date(b.air_date || now).getTime(),
        )[0];

      if (!firstFutureEpisodeNextSeason) return null;

      return {
        tmdbId: show.tmdbId,
        title: show.title,
        posterPath: show.posterPath,
        backdropPath: show.backdropPath,
        seasonNumber: currentSeason + 1,
        episodeNumber: Number(firstFutureEpisodeNextSeason.episode_number),
        episodeTitle:
          firstFutureEpisodeNextSeason.name ||
          `Episode ${Number(firstFutureEpisodeNextSeason.episode_number)}`,
        overview: firstFutureEpisodeNextSeason.overview || null,
        airDate: normalizeDate(firstFutureEpisodeNextSeason.air_date),
      };
    },
  );

  return upcoming
    .filter(Boolean)
    .sort(
      (a: any, b: any) =>
        new Date(a.airDate || 0).getTime() - new Date(b.airDate || 0).getTime(),
    )
    .slice(0, limit);
}

async function getUpcomingWatchlistReleases(userId: string, limit = 40) {
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

  const upcomingReleases: any[] = [];

  for (const item of watchlist) {
    const media = item.media;
    const releaseDate = media.releaseDate;

    if (!releaseDate) continue;

    const releaseDateObj = new Date(releaseDate);
    const now = new Date();

    if (releaseDateObj >= now) {
      if (media.mediaType === "tv") {
        const { getTVSeasonDetails } = await import("@/lib/tmdb");
        try {
          const season1Details = await getTVSeasonDetails(media.tmdbId, 1);
          const firstEpisode = season1Details?.episodes?.[0];

          if (firstEpisode?.air_date) {
            const episodeAirDate = new Date(firstEpisode.air_date);
            if (episodeAirDate >= now) {
              upcomingReleases.push({
                tmdbId: media.tmdbId,
                title: media.title,
                posterPath: media.posterPath,
                backdropPath: media.backdropPath,
                seasonNumber: 1,
                episodeNumber: Number(firstEpisode.episode_number),
                episodeTitle: firstEpisode.name || `Episode ${Number(firstEpisode.episode_number)}`,
                overview: firstEpisode.overview || media.overview,
                airDate: normalizeDate(firstEpisode.air_date),
              });
            }
          }
        } catch (error) {
          console.error("Error fetching TV season details:", error);
        }
      } else {
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
    }
  }

  return upcomingReleases
    .sort(
      (a, b) =>
        new Date(a.airDate || 0).getTime() - new Date(b.airDate || 0).getTime(),
    )
    .slice(0, limit);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const mediaId = searchParams.get("mediaId");
    const seasonNumber = searchParams.get("seasonNumber");
    const episodeNumber = searchParams.get("episodeNumber");
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");
    const nextUpParam = searchParams.get("nextUp");
    const upcomingParam = searchParams.get("upcoming");
    const nextUpLimitParam = searchParams.get("nextUpLimit");
    const mediaTypeParam = searchParams.get("mediaType");

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let dbUser = await prisma.user
      .findUnique({
        where: { email: user.email! },
      })
      .catch((err) => {
        console.error("Database error finding user:", err);
        throw new Error("Database connection failed. Please try again.");
      });

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          email: user.email!,
          username: user.user_metadata?.username || user.email?.split("@")[0],
        },
      });
    }

    if (!mediaId) {
      const parsedLimit =
        limitParam && limitParam !== "all"
          ? Number.parseInt(limitParam, 10)
          : 10000; // Fetch all items when limit is "all"
      const parsedOffset =
        offsetParam && offsetParam !== "all"
          ? Number.parseInt(offsetParam, 10)
          : 0;

      const safeLimit =
        Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 40;
      const safeOffset =
        Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

      const whereClause: any = {
        userId: dbUser.id,
      };

      if (
        mediaTypeParam &&
        (mediaTypeParam === "movie" || mediaTypeParam === "tv")
      ) {
        whereClause.media = {
          mediaType: mediaTypeParam,
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
        skip: safeOffset,
        take: safeLimit + 1,
      });

      const hasMore = watchHistory.length > safeLimit;
      const pageItems = hasMore
        ? watchHistory.slice(0, safeLimit)
        : watchHistory;

      const { getMediaDetails } = await import("@/lib/tmdb");
      const itemsWithPosters = await Promise.all(
        pageItems.map(async (entry) => {
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
            watchedAt: entry.watchedAt,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
            media: {
              ...entry.media,
              title: media.title || "Unknown",
              posterPath: media.posterPath || null,
              backdropPath: media.backdropPath || null,
              overview: media.overview || "",
            },
          };
        }),
      );

      const parsedNextUpLimit =
        nextUpLimitParam && nextUpLimitParam !== "all"
          ? Number.parseInt(nextUpLimitParam, 10)
          : limitParam && limitParam !== "all"
            ? Number.parseInt(limitParam, 10)
            : 12;

      const safeNextUpLimit =
        Number.isFinite(parsedNextUpLimit) && parsedNextUpLimit > 0
          ? parsedNextUpLimit
          : 12;

      const nextUp =
        nextUpParam === "true"
          ? await getNextUpQueue(dbUser.id, safeNextUpLimit)
          : [];

      const upcoming =
        upcomingParam === "true"
          ? await getUpcomingEpisodesQueue(dbUser.id, safeNextUpLimit)
          : [];

      const watchlistUpcoming =
        upcomingParam === "true"
          ? await getUpcomingWatchlistReleases(dbUser.id, limitParam ? parseInt(limitParam) : 40)
          : [];

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
          // Normalize airDate to just the date part (YYYY-MM-DD) for consistent grouping
          airDate: normalizeDate(item.airDate),
        }))
        .sort(
          (a, b) =>
            new Date(a.airDate || 0).getTime() - new Date(b.airDate || 0).getTime(),
        )
        .slice(0, limitParam ? parseInt(limitParam) : 40);

      return NextResponse.json({
        items: itemsWithPosters,
        hasMore,
        nextUp: hydratedNextUp,
        upcoming: allUpcoming,
      });
    }

    const media = await prisma.media.findUnique({
      where: { tmdbId: parseInt(mediaId) },
    });

    if (!media) {
      return NextResponse.json([]);
    }

    const whereClause: {
      userId: string;
      mediaId: number;
      seasonNumber?: number;
      episodeNumber?: number;
    } = {
      userId: dbUser.id,
      mediaId: media.id,
    };

    if (seasonNumber !== null && seasonNumber !== undefined) {
      whereClause.seasonNumber = parseInt(seasonNumber);
    }
    if (episodeNumber !== null && episodeNumber !== undefined) {
      whereClause.episodeNumber = parseInt(episodeNumber);
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
      take: limitParam ? parseInt(limitParam) : undefined,
    });

    const formattedHistory = watchHistory.map((entry) => ({
      id: entry.id,
      userId: entry.userId,
      mediaId: entry.mediaId,
      seasonNumber: entry.seasonNumber,
      episodeNumber: entry.episodeNumber,
      episodeName: entry.episodeName,
      watchedAt: entry.watchedAt,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      media: entry.media,
    }));

    return NextResponse.json(formattedHistory);
  } catch (error) {
    console.error("Error fetching watch history:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      mediaId,
      mediaType,
      watchedAt,
      seasonNumber,
      episodeNumber,
      episodeName,
    } = body;

    if (!mediaId || !mediaType || !watchedAt) {
      return NextResponse.json(
        { error: "Media ID, media type, and watched date are required" },
        { status: 400 },
      );
    }

    if (
      mediaType === "tv" &&
      (seasonNumber === undefined || episodeNumber === undefined)
    ) {
      return NextResponse.json(
        { error: "Season and episode numbers are required for TV shows" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let dbUser = await prisma.user
      .findUnique({
        where: { email: user.email! },
      })
      .catch((err) => {
        console.error("Database error finding user:", err);
        throw new Error("Database connection failed. Please try again.");
      });

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          email: user.email!,
          username: user.user_metadata?.username || user.email?.split("@")[0],
        },
      });
    }

    let media = await prisma.media.findUnique({
      where: { tmdbId: parseInt(mediaId) },
    });

    if (!media) {
      const { getMediaDetails } = await import("@/lib/tmdb");
      const tmdbMedia = await getMediaDetails(parseInt(mediaId), mediaType);

      if (!tmdbMedia) {
        console.error("Failed to fetch media details from TMDB for:", {
          mediaId,
          mediaType
        });
        return NextResponse.json(
          { error: "Failed to fetch media details" },
          { status: 400 }
        );
      }

      const releaseDate = tmdbMedia.release_date || tmdbMedia.first_air_date;
      media = await prisma.media.create({
        data: {
          tmdbId: parseInt(mediaId),
          title: tmdbMedia.title || tmdbMedia.name || "Unknown",
          mediaType,
          posterPath: tmdbMedia.poster_path || "",
          backdropPath: tmdbMedia.backdrop_path || "",
          overview: tmdbMedia.overview || "",
          releaseDate: releaseDate ? new Date(releaseDate) : null,
          voteAverage: tmdbMedia.vote_average || 0,
          genreIds: tmdbMedia.genre_ids || [],
        },
      });
    }

    const existingWatch = await prisma.watchHistory.findFirst({
      where: {
        userId: dbUser.id,
        mediaId: media.id,
        seasonNumber: mediaType === "tv" ? seasonNumber : null,
        episodeNumber: mediaType === "tv" ? episodeNumber : null,
        watchedAt: new Date(watchedAt),
      },
    });

    let watchEntry;
    if (existingWatch) {
      watchEntry = existingWatch;
    } else {
      watchEntry = await prisma.watchHistory.create({
        data: {
          userId: dbUser.id,
          mediaId: media.id,
          seasonNumber: mediaType === "tv" ? seasonNumber : null,
          episodeNumber: mediaType === "tv" ? episodeNumber : null,
          episodeName: mediaType === "tv" ? episodeName || null : null,
          watchedAt: new Date(watchedAt),
        },
      });
    }

    return NextResponse.json(watchEntry);
  } catch (error) {
    console.error("Error adding watch history:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
