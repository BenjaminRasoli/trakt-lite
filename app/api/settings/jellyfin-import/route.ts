import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getMediaDetails } from "@/lib/tmdb";
import { JELLYFIN_CLIENT_AUTH } from "@/lib/jellyfin";

interface JellyfinAuthResponse {
  User: {
    Id: string;
  };
  AccessToken: string;
}

interface JellyfinItem {
  Id: string;
  Name: string;
  ProviderIds?: {
    Tmdb?: string;
  };
  ProductionYear?: number;
  UserData?: {
    Played?: boolean;
    PlayCount?: number;
    LastPlayedDate?: string;
    DatePlayed?: string;
  };
  SeriesName?: string;
  Series?: string;
  ParentIndexNumber?: number;
  IndexNumber?: number;
  SeriesId?: string;
}

interface JellyfinItemsResponse {
  Items: JellyfinItem[];
  TotalRecordCount?: number;
}

async function apiPostAuth(baseUrl: string, username: string, password: string): Promise<{ userId: string; token: string }> {
  const url = baseUrl.trim().replace(/\/$/, "") + "/Users/AuthenticateByName";
  const payload = JSON.stringify({ Username: username, Pw: password || "" });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": JELLYFIN_CLIENT_AUTH,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: payload,
  });

  if (!response.ok) {
    throw new Error("Authentication failed");
  }

  const data: JellyfinAuthResponse = await response.json();
  return { userId: data.User.Id, token: data.AccessToken };
}

async function apiGet(baseUrl: string, token: string, path: string, params?: Record<string, string>): Promise<any> {
  const url = new URL(baseUrl.trim().replace(/\/$/, "") + path);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  const response = await fetch(url.toString(), {
    headers: {
      "Authorization": `${JELLYFIN_CLIENT_AUTH}, Token="${token}"`,
      "X-Emby-Token": token,
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${path}`);
  }

  return response.json();
}

async function getLibraryViews(baseUrl: string, token: string, userId: string): Promise<string[]> {
  const res = await apiGet(baseUrl, token, `/Users/${userId}/Views`);
  const views = res.Items || [];
  return views
    .filter((item: any) => item.Name === "Filmer" || item.Name === "Serier")
    .map((item: any) => item.Id);
}

async function getItems(
  baseUrl: string,
  token: string,
  userId: string,
  parentId: string,
  itemType: string
): Promise<JellyfinItem[]> {
  const items: JellyfinItem[] = [];
  let start = 0;
  const PAGE_SIZE = 500;

  while (true) {
    const result: JellyfinItemsResponse = await apiGet(baseUrl, token, "/Items", {
      userId,
      ParentId: parentId,
      Recursive: "true",
      IncludeItemTypes: itemType,
      Fields: "ProviderIds,ProductionYear,SeriesName,IndexNumber,ParentIndexNumber,UserData,SeriesId",
      EnableUserData: "true",
      StartIndex: start.toString(),
      Limit: PAGE_SIZE.toString(),
    });

    const page = result.Items || [];
    if (page.length === 0) break;

    for (const item of page) {
      const userData = item.UserData || {};
      const isPlayed = userData.Played === true;
      const hasPlaycount = (userData.PlayCount || 0) > 0;

      if (isPlayed || hasPlaycount) {
        items.push(item);
      }
    }

    const total = result.TotalRecordCount || 0;
    if (start + page.length >= total || page.length < PAGE_SIZE) {
      break;
    }
    start += page.length;
  }

  return items;
}

function tmdbId(item: JellyfinItem): number | null {
  const ids = item.ProviderIds || {};
  const value = ids.Tmdb;
  if (value == null) return null;
  try {
    return parseInt(value, 10);
  } catch {
    return null;
  }
}

function watchedAt(item: JellyfinItem): string {
  const data = item.UserData || {};
  const raw = data.LastPlayedDate || data.DatePlayed;
  if (!raw) {
    return new Date().toISOString();
  }
  try {
    const parsed = new Date(raw);
    if (isNaN(parsed.getTime())) {
      return new Date().toISOString();
    }
    return parsed.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

interface TraktHistoryEntry {
  watched_at: string;
  action: string;
  type: string;
  movie?: {
    title: string;
    year?: number;
    ids: { tmdb: number };
  };
  show?: {
    title: string;
    year?: number;
    ids: { tmdb: number };
  };
  episode?: {
    season: number;
    number: number;
    title: string;
  };
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

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const sendEvent = (data: any) => {
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

        const body = await request.json();
        const serverUrl = String(body.serverUrl || "").trim();
        const username = String(body.username || "").trim();
        const password = String(body.password || "");

        if (!serverUrl || !username) {
          controller.enqueue(sendEvent({ error: "Server URL and username are required" }));
          controller.close();
          return;
        }

        controller.enqueue(sendEvent({ status: "Authenticating with Jellyfin..." }));

        // Authenticate with Jellyfin
        const { userId, token } = await apiPostAuth(serverUrl, username, password);

        controller.enqueue(sendEvent({ status: "Fetching library views..." }));

        // Get library views
        const libraryIds = await getLibraryViews(serverUrl, token, userId);
        if (libraryIds.length === 0) {
          controller.enqueue(sendEvent({ error: "No active Filmer or Serier libraries found" }));
          controller.close();
          return;
        }

        controller.enqueue(sendEvent({ status: "Fetching watched items from Jellyfin..." }));

        // Fetch watched items
        const moviesRaw: JellyfinItem[] = [];
        const episodesRaw: JellyfinItem[] = [];

        for (const libId of libraryIds) {
          moviesRaw.push(...await getItems(serverUrl, token, userId, libId, "Movie"));
          episodesRaw.push(...await getItems(serverUrl, token, userId, libId, "Episode"));
        }

        // Deduplicate
        const moviesMap = new Map(moviesRaw.map(m => [m.Id, m]));
        const episodesMap = new Map(episodesRaw.map(e => [e.Id, e]));
        const movies = Array.from(moviesMap.values());
        const episodes = Array.from(episodesMap.values());

        controller.enqueue(sendEvent({ 
          status: `Found ${movies.length} movies and ${episodes.length} episodes. Processing...`,
          progress: 10,
        }));

        const historyEntries: TraktHistoryEntry[] = [];

        // Process movies
        for (const item of movies) {
          const mid = tmdbId(item);
          const date = watchedAt(item);
          if (mid == null) continue;

          historyEntries.push({
            watched_at: date,
            action: "watch",
            type: "movie",
            movie: {
              title: item.Name || "Unknown",
              year: item.ProductionYear || undefined,
              ids: { tmdb: mid },
            },
          });
        }

        // Cache for show TMDB IDs
        const showTmdbCache = new Map<
          string,
          { tmdbId: number | null; year?: number }
        >();

        // Process episodes
        for (const item of episodes) {
          const date = watchedAt(item);
          const seriesName = item.SeriesName || item.Series || "Unknown";
          const season = item.ParentIndexNumber;
          const number = item.IndexNumber;
          const seriesId = item.SeriesId;

          if (season == null || number == null) continue;
          if (!seriesId) continue;

          // Get show TMDB ID
          if (!showTmdbCache.has(seriesId)) {
            try {
              const showItem = await apiGet(serverUrl, token, `/Users/${userId}/Items/${seriesId}`);
              showTmdbCache.set(seriesId, {
                tmdbId: tmdbId(showItem),
                year: showItem.ProductionYear,
              });
            } catch {
              showTmdbCache.set(seriesId, { tmdbId: null });
            }
          }

          const showDetails = showTmdbCache.get(seriesId);
          if (!showDetails || showDetails.tmdbId == null) continue;

          historyEntries.push({
            watched_at: date,
            action: "watch",
            type: "episode",
            episode: {
              season: season,
              number: number,
              title: item.Name || `Episode ${number}`,
            },
            show: {
              title: seriesName,
              year: showDetails.year,
              ids: { tmdb: showDetails.tmdbId },
            },
          });
        }

        // Sort by date
        historyEntries.sort((a, b) => a.watched_at.localeCompare(b.watched_at));

        controller.enqueue(sendEvent({ 
          status: "Deleting existing watch history...",
          progress: 20,
        }));

        // Delete existing watch history
        await prisma.watchHistory.deleteMany({
          where: { userId: dbUser.id },
        });

        controller.enqueue(sendEvent({ 
          status: "Grouping entries by media...",
          progress: 30,
        }));

        // Group entries by tmdbId to reduce API calls
        const entriesByTmdbId = new Map<number, TraktHistoryEntry[]>();
        for (const entry of historyEntries) {
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

        // Process media in batches
        const batchSize = 50;
        const tmdbIds = Array.from(entriesByTmdbId.keys());
        const totalBatches = Math.ceil(tmdbIds.length / batchSize);
        let importedCount = 0;

        for (let i = 0; i < tmdbIds.length; i += batchSize) {
          const batch = tmdbIds.slice(i, i + batchSize);
          const currentBatch = Math.floor(i / batchSize) + 1;

          controller.enqueue(sendEvent({
            status: `Processing batch ${currentBatch}/${totalBatches}...`,
            progress: Math.round(30 + (currentBatch / totalBatches) * 60),
          }));

          const batchResults = await mapWithConcurrency(
            batch,
            2,
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

        controller.enqueue(sendEvent({
          status: "Complete!",
          progress: 100,
          success: true,
          imported: importedCount,
        }));
        controller.close();
      } catch (error) {
        console.error("Error importing from Jellyfin:", error);
        controller.enqueue(sendEvent({ error: error instanceof Error ? error.message : "Import failed" }));
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
