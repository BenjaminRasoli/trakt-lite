import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMediaDetails } from "@/lib/tmdb";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") as "movie" | "tv" | null;

    if (!id || !type) {
      return NextResponse.json({ error: "Media ID and type are required" }, { status: 400 });
    }

    let media = await prisma.media.findUnique({
      where: { tmdbId: parseInt(id) },
    });

    if (media && media.posterPath) {
      return NextResponse.json(media);
    }

    const tmdbMedia = await getMediaDetails(parseInt(id), type);
    if (tmdbMedia) {
      const releaseDate = tmdbMedia.release_date || tmdbMedia.first_air_date;
      if (media) {
        media = await prisma.media.update({
          where: { id: media.id },
          data: {
            title: tmdbMedia.title || tmdbMedia.name || media.title,
            posterPath: tmdbMedia.poster_path || "",
            backdropPath: tmdbMedia.backdrop_path || "",
            overview: tmdbMedia.overview || "",
            releaseDate: releaseDate ? new Date(releaseDate) : media.releaseDate,
            voteAverage: tmdbMedia.vote_average || 0,
            genreIds: tmdbMedia.genre_ids || [],
          },
        });
      } else {
        media = await prisma.media.create({
          data: {
            tmdbId: parseInt(id),
            title: tmdbMedia.title || tmdbMedia.name || "Unknown",
            mediaType: type,
            posterPath: tmdbMedia.poster_path || "",
            backdropPath: tmdbMedia.backdrop_path || "",
            overview: tmdbMedia.overview || "",
            releaseDate: releaseDate ? new Date(releaseDate) : null,
            voteAverage: tmdbMedia.vote_average || 0,
            genreIds: tmdbMedia.genre_ids || [],
          },
        });
      }
      return NextResponse.json(media);
    }

    if (media) {
      return NextResponse.json(media);
    }

    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  } catch (error) {
    console.error("Error fetching media:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
