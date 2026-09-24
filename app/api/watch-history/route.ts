import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const mediaId = searchParams.get("mediaId");
    const seasonNumber = searchParams.get("seasonNumber");
    const episodeNumber = searchParams.get("episodeNumber");

    if (!mediaId) {
      return NextResponse.json(
        { error: "Media ID is required" },
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

    const media = await prisma.media.findUnique({
      where: { tmdbId: parseInt(mediaId) },
    });

    if (!media) {
      return NextResponse.json([]);
    }

    const whereClause: any = {
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
      orderBy: {
        watchedAt: "desc",
      },
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
