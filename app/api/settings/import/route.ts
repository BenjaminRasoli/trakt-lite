import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getMediaDetails } from "@/lib/tmdb";
import JSZip from "jszip";

type TraktHistoryEntry = {
  type?: string;
  movie?: {
    ids?: { tmdb?: number };
    title?: string;
    year?: number;
  };
  show?: {
    ids?: { tmdb?: number };
    title?: string;
    year?: number;
  };
  episode?: {
    season?: number;
    number?: number;
  };
  watched_at?: string;
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email! },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const zip = await JSZip.loadAsync(buffer);

    const watchedHistoryFiles = Object.keys(zip.files)
      .filter(
        (name) => name.startsWith("watched-history-") && name.endsWith(".json"),
      )
      .sort();

    const allWatchedHistory: TraktHistoryEntry[] = [];
    for (const fileName of watchedHistoryFiles) {
      const file = zip.files[fileName];
      if (file.dir) continue;

      const content = await file.async("string");
      const history = JSON.parse(content);
      allWatchedHistory.push(...history);
    }

    await prisma.watchHistory.deleteMany({
      where: { userId: dbUser.id },
    });

    // Process entries without fetching TMDB data (just store ID and type)
    const importPromises = allWatchedHistory.map(async (entry) => {
      try {
        let tmdbId: number;
        let mediaType: "movie" | "tv";
        let title: string;
        let seasonNumber: number | null = null;
        let episodeNumber: number | null = null;
        let releaseDate: Date | null = null;

        if (entry.type === "movie") {
          const movieTmdbId = entry.movie?.ids?.tmdb;
          if (movieTmdbId == null) return;

          tmdbId = movieTmdbId;
          mediaType = "movie";
          title = entry.movie?.title || "Unknown";
          releaseDate = entry.movie?.year
            ? new Date(`${entry.movie.year}-01-01`)
            : null;
        } else if (entry.type === "episode") {
          const showTmdbId = entry.show?.ids?.tmdb;
          if (showTmdbId == null) return;

          tmdbId = showTmdbId;
          mediaType = "tv";
          title = entry.show?.title || "Unknown";
          seasonNumber = entry.episode?.season ?? null;
          episodeNumber = entry.episode?.number ?? null;
          releaseDate = entry.show?.year
            ? new Date(`${entry.show.year}-01-01`)
            : null;
        } else {
          return;
        }

        if (!tmdbId) return;

        let media = await prisma.media.findUnique({
          where: { tmdbId },
        });

        const tmdbMedia = await getMediaDetails(tmdbId, mediaType);

        if (tmdbMedia) {
          const nextReleaseDate =
            tmdbMedia.release_date || tmdbMedia.first_air_date;

          if (media) {
            media = await prisma.media.update({
              where: { id: media.id },
              data: {
                title: tmdbMedia.title || tmdbMedia.name || title,
                mediaType,
                posterPath: tmdbMedia.poster_path || media.posterPath || "",
                backdropPath:
                  tmdbMedia.backdrop_path || media.backdropPath || "",
                overview: tmdbMedia.overview || media.overview || "",
                releaseDate: nextReleaseDate
                  ? new Date(nextReleaseDate)
                  : media.releaseDate,
                voteAverage: tmdbMedia.vote_average || media.voteAverage || 0,
                genreIds: tmdbMedia.genre_ids || media.genreIds || [],
              },
            });
          } else {
            media = await prisma.media.create({
              data: {
                tmdbId,
                title: tmdbMedia.title || tmdbMedia.name || title,
                mediaType,
                posterPath: tmdbMedia.poster_path || "",
                backdropPath: tmdbMedia.backdrop_path || "",
                overview: tmdbMedia.overview || "",
                releaseDate: nextReleaseDate ? new Date(nextReleaseDate) : null,
                voteAverage: tmdbMedia.vote_average || 0,
                genreIds: tmdbMedia.genre_ids || [],
              },
            });
          }
        } else if (!media) {
          media = await prisma.media.create({
            data: {
              tmdbId,
              title,
              mediaType,
              posterPath: "",
              backdropPath: "",
              overview: "",
              releaseDate,
              voteAverage: 0,
              genreIds: [],
            },
          });
        }

        const watchedAt = entry.watched_at;
        if (!watchedAt) return;

        await prisma.watchHistory.create({
          data: {
            userId: dbUser.id,
            mediaId: media.id,
            seasonNumber,
            episodeNumber,
            watchedAt: new Date(watchedAt),
          },
        });
      } catch (error) {
        console.error("Error importing entry:", error);
      }
    });

    await Promise.all(importPromises);

    return NextResponse.json({
      success: true,
      imported: allWatchedHistory.length,
    });
  } catch (error) {
    console.error("Error importing data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
