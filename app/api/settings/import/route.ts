import { NextRequest } from "next/server";
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

type TraktWatchlistEntry = {
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
};

type TraktMediaReference = {
  ids?: { tmdb?: number };
  title?: string;
  year?: number;
};

type TraktRatingEntry = {
  rated_at?: string;
  rating?: number;
  movie?: TraktMediaReference;
  show?: TraktMediaReference;
  episode?: {
    season?: number;
    number?: number;
  };
  season?: {
    number?: number;
  };
};

async function readZipJsonArray<T>(
  zip: JSZip,
  fileName: string,
): Promise<T[]> {
  const file = zip.files[fileName];
  if (!file || file.dir) return [];

  const parsed: unknown = JSON.parse(await file.async("string"));
  if (!Array.isArray(parsed)) {
    throw new Error(`${fileName} must contain a JSON array`);
  }
  return parsed.filter(
    (entry): entry is T =>
      typeof entry === "object" && entry !== null && !Array.isArray(entry),
  );
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

async function getOrCreateRatingMedia(
  tmdbId: number,
  mediaType: "movie" | "tv",
  traktMedia: TraktMediaReference,
) {
  const existing = await prisma.media.findUnique({ where: { tmdbId } });
  if (existing) {
    if (existing.mediaType !== mediaType) {
      throw new Error(`TMDB media type mismatch for ${tmdbId}`);
    }
    return existing;
  }

  const details = await getMediaDetails(tmdbId, mediaType);
  const releaseDateString = details?.release_date || details?.first_air_date;
  const traktYear = traktMedia.year;
  const fallbackYear =
    typeof traktYear === "number" &&
    Number.isInteger(traktYear) &&
    traktYear >= 1000 &&
    traktYear <= 9999
      ? `${traktYear}-01-01`
      : null;
  const releaseDate = releaseDateString || fallbackYear;
  const title =
    details?.title ||
    details?.name ||
    traktMedia.title ||
    `Media ${tmdbId}`;

  return prisma.media.upsert({
    where: { tmdbId },
    update: {
      title,
      mediaType,
      posterPath: details?.poster_path ?? null,
      backdropPath: details?.backdrop_path ?? null,
      overview: details?.overview ?? "",
      releaseDate: releaseDate ? new Date(releaseDate) : null,
      voteAverage: details?.vote_average ?? null,
      genreIds: details?.genre_ids ?? [],
    },
    create: {
      tmdbId,
      title,
      mediaType,
      posterPath: details?.poster_path ?? null,
      backdropPath: details?.backdrop_path ?? null,
      overview: details?.overview ?? "",
      releaseDate: releaseDate ? new Date(releaseDate) : null,
      voteAverage: details?.vote_average ?? null,
      genreIds: details?.genre_ids ?? [],
    },
  });
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const sendEvent = (data: unknown) => {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  };

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          controller.enqueue(sendEvent({ error: "Unauthorized" }));
          controller.close();
          return;
        }

        const dbUser = await prisma.user.findUnique({
          where: { email: user.email! },
        }).catch(err => {
          console.error("Database error finding user:", err);
          throw new Error("Database connection failed. Please try again.");
        });

        if (!dbUser) {
          controller.enqueue(sendEvent({ error: "User not found" }));
          controller.close();
          return;
        }

        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
          controller.enqueue(sendEvent({ error: "No file provided" }));
          controller.close();
          return;
        }

        controller.enqueue(sendEvent({ status: "Parsing ZIP file..." }));

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

        const [movieRatings, showRatings, seasonRatings, episodeRatings] = await Promise.all([
          readZipJsonArray<TraktRatingEntry>(zip, "ratings-movies.json"),
          readZipJsonArray<TraktRatingEntry>(zip, "ratings-shows.json"),
          readZipJsonArray<TraktRatingEntry>(zip, "ratings-seasons.json"),
          readZipJsonArray<TraktRatingEntry>(zip, "ratings-episodes.json"),
        ]);

        // Import watchlist
        const watchlistFile = zip.files["lists-watchlist.json"];
        const watchlistEntries: TraktWatchlistEntry[] = [];
        if (watchlistFile && !watchlistFile.dir) {
          const content = await watchlistFile.async("string");
          const watchlist = JSON.parse(content);
          watchlistEntries.push(...watchlist);
        }

        controller.enqueue(sendEvent({ status: "Grouping entries by media..." }));

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
        const totalBatches = Math.ceil(tmdbIds.length / batchSize);
        let importedCount = 0;

        for (let i = 0; i < tmdbIds.length; i += batchSize) {
          const batch = tmdbIds.slice(i, i + batchSize);
          const currentBatch = Math.floor(i / batchSize) + 1;
          
          controller.enqueue(sendEvent({ 
            status: `Processing batch ${currentBatch}/${totalBatches}...`,
            progress: Math.round((currentBatch / totalBatches) * 50),
          }));
          
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

        // Process watchlist entries
        controller.enqueue(sendEvent({ 
          status: "Processing watchlist...",
          progress: 70,
        }));

        let watchlistImportedCount = 0;
        for (const entry of watchlistEntries) {
          try {
            const type = entry.type; // "movie" or "show"
            const mediaData = type === "movie" ? entry.movie : entry.show;

            if (!mediaData || !mediaData.ids || !mediaData.ids.tmdb) {
              continue;
            }

            const tmdbId = mediaData.ids.tmdb;
            const mediaType = type === "movie" ? "movie" : "tv";

            // Check if media exists, if not create it
            let media = await prisma.media.findUnique({
              where: { tmdbId },
            });

            const hasFallbackData =
              media && (media.title.startsWith("Media ") || media.posterPath === undefined || media.posterPath === "");

            if (!media || hasFallbackData) {
              const tmdbMedia = await getMediaDetails(tmdbId, mediaType);

              if (!tmdbMedia) {
                continue;
              }

              if (media) {
                media = await prisma.media.update({
                  where: { id: media.id },
                  data: {
                    title: tmdbMedia.title || tmdbMedia.name || "Unknown",
                    mediaType,
                    posterPath: tmdbMedia.poster_path || "",
                    backdropPath: tmdbMedia.backdrop_path || "",
                    overview: tmdbMedia.overview || "",
                    releaseDate:
                      (tmdbMedia.release_date || tmdbMedia.first_air_date)
                        ? new Date(tmdbMedia.release_date || tmdbMedia.first_air_date!)
                        : null,
                    voteAverage: tmdbMedia.vote_average,
                    genreIds: tmdbMedia.genre_ids || [],
                  },
                });
              } else {
                media = await prisma.media.create({
                  data: {
                    tmdbId,
                    title: tmdbMedia.title || tmdbMedia.name || "Unknown",
                    mediaType,
                    posterPath: tmdbMedia.poster_path || "",
                    backdropPath: tmdbMedia.backdrop_path || "",
                    overview: tmdbMedia.overview || "",
                    releaseDate:
                      (tmdbMedia.release_date || tmdbMedia.first_air_date)
                        ? new Date(tmdbMedia.release_date || tmdbMedia.first_air_date!)
                        : null,
                    voteAverage: tmdbMedia.vote_average,
                    genreIds: tmdbMedia.genre_ids || [],
                  },
                });
              }
            }

            // Check if already in watchlist
            const existingWatchlist = await prisma.watchlist.findFirst({
              where: {
                userId: dbUser.id,
                mediaId: media.id,
              },
            });

            if (!existingWatchlist) {
              await prisma.watchlist.create({
                data: {
                  userId: dbUser.id,
                  mediaId: media.id,
                },
              });
              watchlistImportedCount++;
            }
          } catch (error) {
            console.error("Error processing watchlist entry:", error);
          }
        }

        controller.enqueue(sendEvent({
          status: "Importing ratings...",
          progress: 85,
        }));

        const ratingsToImport = [
          ...movieRatings.map((entry) => ({
            entry,
            mediaType: "movie" as const,
            scope: "media" as const,
            traktMedia: entry.movie,
            seasonNumber: null,
            episodeNumber: null,
          })),
          ...showRatings.map((entry) => ({
            entry,
            mediaType: "tv" as const,
            scope: "media" as const,
            traktMedia: entry.show,
            seasonNumber: null,
            episodeNumber: null,
          })),
          ...seasonRatings.map((entry) => ({
            entry,
            mediaType: "tv" as const,
            scope: "season" as const,
            traktMedia: entry.show,
            seasonNumber: entry.season?.number ?? null,
            episodeNumber: null,
          })),
          ...episodeRatings.map((entry) => ({
            entry,
            mediaType: "tv" as const,
            scope: "episode" as const,
            traktMedia: entry.show,
            seasonNumber: entry.episode?.season ?? null,
            episodeNumber: entry.episode?.number ?? null,
          })),
        ];

        const ratingMediaCache = new Map<
          string,
          ReturnType<typeof getOrCreateRatingMedia>
        >();
        const ratingResults = await mapWithConcurrency(
          ratingsToImport,
          4,
          async ({
            entry,
            mediaType,
            scope,
            traktMedia,
            seasonNumber,
            episodeNumber,
          }) => {
            const score = entry.rating;
            const ratedAt = entry.rated_at ? new Date(entry.rated_at) : null;
            const tmdbId = traktMedia?.ids?.tmdb;
            const isEpisode = scope === "episode";
            const isSeason = scope === "season";

            if (
              !traktMedia ||
              typeof tmdbId !== "number" ||
              !Number.isSafeInteger(tmdbId) ||
              tmdbId <= 0 ||
              typeof score !== "number" ||
              !Number.isFinite(score) ||
              score < 0.5 ||
              score > 10 ||
              !Number.isInteger(score * 10) ||
              !ratedAt ||
              Number.isNaN(ratedAt.getTime()) ||
              (isEpisode &&
                (seasonNumber === null ||
                  episodeNumber === null ||
                  !Number.isSafeInteger(seasonNumber) ||
                  !Number.isSafeInteger(episodeNumber) ||
                  seasonNumber < 0 ||
                  episodeNumber <= 0)) ||
              (isSeason &&
                (seasonNumber === null ||
                  !Number.isSafeInteger(seasonNumber) ||
                  seasonNumber < 0))
            ) {
              console.warn("Skipping invalid Trakt rating entry");
              return false;
            }

            const subjectKey =
              isEpisode
                ? `episode:${seasonNumber}:${episodeNumber}`
                : isSeason
                  ? `season:${seasonNumber}`
                  : "media";
            const mediaKey = `${mediaType}:${tmdbId}`;
            let mediaPromise = ratingMediaCache.get(mediaKey);
            if (!mediaPromise) {
              mediaPromise = getOrCreateRatingMedia(
                tmdbId,
                mediaType,
                traktMedia,
              );
              ratingMediaCache.set(mediaKey, mediaPromise);
            }
            const media = await mediaPromise;

            await prisma.userRating.upsert({
              where: {
                userId_mediaId_subjectKey: {
                  userId: dbUser.id,
                  mediaId: media.id,
                  subjectKey,
                },
              },
              create: {
                userId: dbUser.id,
                mediaId: media.id,
                subjectKey,
                seasonNumber,
                episodeNumber,
                score,
                createdAt: ratedAt,
                updatedAt: ratedAt,
              },
              update: {
                seasonNumber,
                episodeNumber,
                score,
                updatedAt: ratedAt,
              },
            });
            return true;
          },
        );
        const ratingsImportedCount = ratingResults.filter(Boolean).length;

        controller.enqueue(sendEvent({ 
          status: "Complete!",
          progress: 100,
          success: true,
          imported: importedCount,
          watchlistImported: watchlistImportedCount,
          ratingsImported: ratingsImportedCount,
        }));
        controller.close();
      } catch (error) {
        console.error("Error importing data:", error);
        controller.enqueue(sendEvent({ error: "Internal server error" }));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
