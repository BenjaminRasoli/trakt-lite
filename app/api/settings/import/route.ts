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
    title?: string;
  };
  watched_at?: string;
};

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
    }).catch(err => {
      console.error("Database error finding user:", err);
      throw new Error("Database connection failed. Please try again.");
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

    // Group entries by tmdbId to reduce API calls
    const entriesByTmdbId = new Map<number, TraktHistoryEntry[]>();
    for (const entry of allWatchedHistory) {
      let tmdbId: number | null = null;
      if (entry.type === "movie") {
        tmdbId = entry.movie?.ids?.tmdb ?? null;
      } else if (entry.type === "episode") {
        tmdbId = entry.show?.ids?.tmdb ?? null;
      }
      
      if (tmdbId != null) {
        if (!entriesByTmdbId.has(tmdbId)) {
          entriesByTmdbId.set(tmdbId, []);
        }
        entriesByTmdbId.get(tmdbId)!.push(entry);
      }
    }

    await prisma.watchHistory.deleteMany({
      where: { userId: dbUser.id },
    });

    // Process media in batches with lower concurrency to avoid timeouts
    const batchSize = 50;
    const tmdbIds = Array.from(entriesByTmdbId.keys());
    let importedCount = 0;

    for (let i = 0; i < tmdbIds.length; i += batchSize) {
      const batch = tmdbIds.slice(i, i + batchSize);
      
      const batchResults = await mapWithConcurrency(
        batch,
        2, // Reduced concurrency to avoid database timeouts
        async (tmdbId) => {
          try {
            const entries = entriesByTmdbId.get(tmdbId);
            if (!entries || entries.length === 0) return 0;

            const firstEntry = entries[0];
            let mediaType: "movie" | "tv";
            let title: string;
            let releaseDate: Date | null = null;

            if (firstEntry.type === "movie") {
              mediaType = "movie";
              title = firstEntry.movie?.title || "Unknown";
              releaseDate = firstEntry.movie?.year
                ? new Date(`${firstEntry.movie.year}-01-01`)
                : null;
            } else if (firstEntry.type === "episode") {
              mediaType = "tv";
              title = firstEntry.show?.title || "Unknown";
              releaseDate = firstEntry.show?.year
                ? new Date(`${firstEntry.show.year}-01-01`)
                : null;
            } else {
              return 0;
            }

            const tmdbMedia = await getMediaDetails(tmdbId, mediaType);
            const nextReleaseDate =
              tmdbMedia?.release_date || tmdbMedia?.first_air_date;

            const media = await prisma.media.upsert({
              where: { tmdbId },
              update: {
                title: tmdbMedia?.title || tmdbMedia?.name || title,
                mediaType,
                posterPath: tmdbMedia?.poster_path || "",
                backdropPath: tmdbMedia?.backdrop_path || "",
                overview: tmdbMedia?.overview || "",
                releaseDate: nextReleaseDate
                  ? new Date(nextReleaseDate)
                  : releaseDate,
                voteAverage: tmdbMedia?.vote_average || 0,
                genreIds: tmdbMedia?.genre_ids || [],
              },
              create: {
                tmdbId,
                title: tmdbMedia?.title || tmdbMedia?.name || title,
                mediaType,
                posterPath: tmdbMedia?.poster_path || "",
                backdropPath: tmdbMedia?.backdrop_path || "",
                overview: tmdbMedia?.overview || "",
                releaseDate: nextReleaseDate
                  ? new Date(nextReleaseDate)
                  : releaseDate,
                voteAverage: tmdbMedia?.vote_average || 0,
                genreIds: tmdbMedia?.genre_ids || [],
              },
            });

            // Create watch history entries for this media
            let count = 0;
            for (const entry of entries) {
              const watchedAt = entry.watched_at;
              if (!watchedAt) continue;

              let seasonNumber: number | null = null;
              let episodeNumber: number | null = null;

              if (entry.type === "episode") {
                seasonNumber = entry.episode?.season ?? null;
                episodeNumber = entry.episode?.number ?? null;
              }

              const episodeName = entry.type === "episode" 
                ? (entry.episode?.title || null)
                : null;

              await prisma.watchHistory.create({
                data: {
                  userId: dbUser.id,
                  mediaId: media.id,
                  seasonNumber,
                  episodeNumber,
                  episodeName,
                  watchedAt: new Date(watchedAt),
                },
              });
              count++;
            }
            return count;
          } catch (error) {
            console.error("Error importing media:", error);
            return 0;
          }
        },
      );

      importedCount += batchResults.reduce((sum, count) => sum + count, 0);
    }

    return NextResponse.json({
      success: true,
      imported: importedCount,
    });
  } catch (error) {
    console.error("Error importing data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
