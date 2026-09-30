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
  releaseDate: Date | null;
}) {
  if (!media.tmdbId || (media.posterPath && media.releaseDate)) {
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
        releaseDate: cached.releaseDate || media.releaseDate,
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
    releaseDate:
      tmdbMedia.release_date || tmdbMedia.first_air_date
        ? new Date(tmdbMedia.release_date || tmdbMedia.first_air_date || "")
        : media.releaseDate,
  };

  // Cache the result with timestamp
  mediaCache.set(cacheKey, {
    title: hydratedMedia.title,
    posterPath: hydratedMedia.posterPath,
    backdropPath: hydratedMedia.backdropPath,
    overview: hydratedMedia.overview,
    releaseDate: hydratedMedia.releaseDate,
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
        releaseDate: hydratedMedia.releaseDate,
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
        releaseDate: hydratedMedia.releaseDate,
      },
    })
    .catch((err) => console.error("Error updating media metadata:", err));

  return hydratedMedia;
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

    // Sync user to database
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
    });

    // Hydrate missing metadata
    const hydratedWatchlist = await Promise.all(
      watchlist.map(async (item) => {
        const hydratedMedia = await hydrateMissingMediaMetadata({
          tmdbId: item.media.tmdbId,
          title: item.media.title,
          mediaType: item.media.mediaType,
          posterPath: item.media.posterPath,
          backdropPath: item.media.backdropPath,
          overview: item.media.overview,
          releaseDate: item.media.releaseDate,
        });

        return {
          ...item,
          media: {
            ...item.media,
            title: hydratedMedia.title,
            posterPath: hydratedMedia.posterPath,
            backdropPath: hydratedMedia.backdropPath,
            overview: hydratedMedia.overview,
            releaseDate: hydratedMedia.releaseDate,
          },
        };
      }),
    );

    return NextResponse.json({ watchlist: hydratedWatchlist });
  } catch (error) {
    console.error("Error fetching watchlist:", error);
    return NextResponse.json(
      { error: "Failed to fetch watchlist" },
      { status: 500 },
    );
  }
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

    // Sync user to database
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

    const body = await request.json();
    const { tmdbId } = body;

    if (!tmdbId) {
      return NextResponse.json(
        { error: "tmdbId is required" },
        { status: 400 },
      );
    }

    // Convert tmdbId to number if it's a string
    const numericTmdbId =
      typeof tmdbId === "string" ? parseInt(tmdbId, 10) : tmdbId;

    if (isNaN(numericTmdbId)) {
      return NextResponse.json(
        { error: "tmdbId must be a valid number" },
        { status: 400 },
      );
    }

    // Check if media exists, if not create it
    let media = await prisma.media.findUnique({
      where: { tmdbId: numericTmdbId },
    });

    // Update existing media if it has fallback data
    const hasFallbackData = media && (media.title.startsWith("Media ") || !media.posterPath);

    if (!media || hasFallbackData) {
      // Fetch media details from TMDB
      const tmdbResponse = await fetch(
        `https://api.themoviedb.org/3/${body.mediaType || "movie"}/${numericTmdbId}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}`,
      );

      if (!tmdbResponse.ok) {
        console.error(
          "TMDB API error:",
          tmdbResponse.status,
          tmdbResponse.statusText,
        );
        return NextResponse.json(
          { error: "Failed to fetch media details" },
          { status: 400 },
        );
      }

      const tmdbData = await tmdbResponse.json();

      if (media) {
        // Update existing fallback media with proper TMDB data
        media = await prisma.media.update({
          where: { id: media.id },
          data: {
            title: tmdbData.title || tmdbData.name,
            mediaType: body.mediaType || "movie",
            posterPath: tmdbData.poster_path,
            backdropPath: tmdbData.backdrop_path,
            overview: tmdbData.overview,
            releaseDate:
              tmdbData.release_date || tmdbData.first_air_date
                ? new Date(tmdbData.release_date || tmdbData.first_air_date)
                : null,
            voteAverage: tmdbData.vote_average,
            genreIds: tmdbData.genres?.map((g: any) => g.id) || [],
          },
        });
      } else {
        // Create new media with TMDB data
        media = await prisma.media.create({
          data: {
            tmdbId: numericTmdbId,
            title: tmdbData.title || tmdbData.name,
            mediaType: body.mediaType || "movie",
            posterPath: tmdbData.poster_path,
            backdropPath: tmdbData.backdrop_path,
            overview: tmdbData.overview,
            releaseDate:
              tmdbData.release_date || tmdbData.first_air_date
                ? new Date(tmdbData.release_date || tmdbData.first_air_date)
                : null,
            voteAverage: tmdbData.vote_average,
            genreIds: tmdbData.genres?.map((g: any) => g.id) || [],
          },
        });
      }
    }

    // Ensure media exists before adding to watchlist
    if (!media) {
      return NextResponse.json(
        { error: "Failed to create or update media" },
        { status: 500 },
      );
    }

    // Add to watchlist
    const watchlistItem = await prisma.watchlist.create({
      data: {
        userId: dbUser.id,
        mediaId: media.id,
      },
      include: {
        media: true,
      },
    });

    return NextResponse.json({ watchlistItem });
  } catch (error) {
    console.error("Error adding to watchlist:", error);
    return NextResponse.json(
      { error: "Failed to add to watchlist" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Sync user to database
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

    const { searchParams } = new URL(request.url);
    const tmdbId = searchParams.get("tmdbId");

    if (!tmdbId) {
      return NextResponse.json(
        { error: "tmdbId is required" },
        { status: 400 },
      );
    }

    // Convert tmdbId to number
    const numericTmdbId = parseInt(tmdbId, 10);

    if (isNaN(numericTmdbId)) {
      return NextResponse.json(
        { error: "tmdbId must be a valid number" },
        { status: 400 },
      );
    }

    // Find media by tmdbId
    const media = await prisma.media.findUnique({
      where: { tmdbId: numericTmdbId },
    });

    if (!media) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }

    // Remove from watchlist
    await prisma.watchlist.deleteMany({
      where: {
        userId: dbUser.id,
        mediaId: media.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing from watchlist:", error);
    return NextResponse.json(
      { error: "Failed to remove from watchlist" },
      { status: 500 },
    );
  }
}
