import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getMediaDetails } from "@/lib/tmdb";
import { getDroppedNextUpShows } from "@/lib/dropped-next-up-shows";
import { getWatchHistoryFeed } from "@/lib/watch-history-data";

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
          supabaseUserId: user.id,
          email: user.email!,
          username: user.user_metadata?.username || user.email?.split("@")[0],
        },
      });
    }

    if (searchParams.get("watchedIdsOnly") === "true") {
      const watchedMedia = await prisma.media.findMany({
        where: { watchHistory: { some: { userId: dbUser.id } } },
        select: { tmdbId: true },
      });
      return NextResponse.json({
        tmdbIds: watchedMedia.map((media) => media.tmdbId),
      });
    }

    if (!mediaId) {
      const parsedLimit =
        limitParam && limitParam !== "all"
          ? Number.parseInt(limitParam, 10)
          : 10000;
      const parsedOffset =
        offsetParam && offsetParam !== "all"
          ? Number.parseInt(offsetParam, 10)
          : 0;

      const safeLimit =
        Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 40;
      const safeOffset =
        Number.isFinite(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0;

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

      const feed = await getWatchHistoryFeed(dbUser.id, {
        limit: safeLimit,
        offset: safeOffset,
        mediaType:
          mediaTypeParam === "movie" || mediaTypeParam === "tv"
            ? mediaTypeParam
            : undefined,
        includeNextUp: nextUpParam === "true",
        includeUpcoming: upcomingParam === "true",
        nextUpLimit: safeNextUpLimit,
      });

      return NextResponse.json(feed);
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
          supabaseUserId: user.id,
          email: user.email!,
          username: user.user_metadata?.username || user.email?.split("@")[0],
        },
      });
    }

    let media = await prisma.media.findUnique({
      where: { tmdbId: parseInt(mediaId) },
    });

    if (!media) {
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

    const droppedShowState =
      mediaType === "tv" ? await getDroppedNextUpShows(dbUser.id) : null;

    const watchEntry = await prisma.$transaction(async (transaction) => {
      const entry = await transaction.watchHistory.create({
        data: {
          userId: dbUser.id,
          mediaId: media.id,
          seasonNumber: mediaType === "tv" ? seasonNumber : null,
          episodeNumber: mediaType === "tv" ? episodeNumber : null,
          episodeName: mediaType === "tv" ? episodeName || null : null,
          watchedAt: new Date(watchedAt),
        },
      });

      if (mediaType === "tv") {
        await Promise.all([
          transaction.nextUpCache.deleteMany({
            where: { userId: dbUser.id },
          }),
          ...(droppedShowState?.available
            ? [
                transaction.droppedNextUpShow.deleteMany({
                  where: {
                    userId: dbUser.id,
                    tmdbId: media.tmdbId,
                  },
                }),
              ]
            : []),
        ]);
      }

      return entry;
    });

    return NextResponse.json(watchEntry);
  } catch (error) {
    console.error("Error adding watch history:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
