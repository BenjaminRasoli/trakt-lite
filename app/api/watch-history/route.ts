import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const mediaId = searchParams.get("mediaId");
    const seasonNumber = searchParams.get("seasonNumber");
    const episodeNumber = searchParams.get("episodeNumber");
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");

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
          : 40;
      const parsedOffset =
        offsetParam && offsetParam !== "all"
          ? Number.parseInt(offsetParam, 10)
          : 0;

      const safeLimit =
        Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 40;
      const safeOffset =
        Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

      const watchHistory = await prisma.watchHistory.findMany({
        where: {
          userId: dbUser.id,
        },
        include: {
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
          let posterPath = entry.media.posterPath;
          let backdropPath = entry.media.backdropPath;
          let overview = entry.media.overview;

          if (!posterPath && entry.media.tmdbId) {
            try {
              const tmdbMedia = await getMediaDetails(
                entry.media.tmdbId,
                entry.media.mediaType as "movie" | "tv"
              );
              if (tmdbMedia) {
                posterPath = tmdbMedia.poster_path;
                backdropPath = tmdbMedia.backdrop_path;
                overview = tmdbMedia.overview;

                await prisma.media.update({
                  where: { id: entry.media.id },
                  data: {
                    posterPath: posterPath || null,
                    backdropPath: backdropPath || null,
                    overview: overview || null,
                  },
                });
              }
            } catch (error) {
              console.error("Error fetching poster from TMDB:", error);
            }
          }

          return {
            ...entry,
            media: {
              ...entry.media,
              title: entry.media.title || "Unknown",
              posterPath: posterPath || null,
              backdropPath: backdropPath || null,
              overview: overview || "",
            },
          };
        })
      );

      return NextResponse.json({
        items: itemsWithPosters,
        hasMore,
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
      include: {
        media: true,
      },
      orderBy: {
        watchedAt: "desc",
      },
      take: limitParam ? parseInt(limitParam) : undefined,
    });

    return NextResponse.json(watchHistory);
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
    const { mediaId, mediaType, watchedAt, seasonNumber, episodeNumber } = body;

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

    let dbUser = await prisma.user.findUnique({
      where: { email: user.email! },
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

      if (tmdbMedia) {
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
      } else {
        media = await prisma.media.create({
          data: {
            tmdbId: parseInt(mediaId),
            title: `Media ${mediaId}`,
            mediaType,
            posterPath: "",
            backdropPath: "",
            overview: "",
            genreIds: [],
          },
        });
      }
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
