const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || "";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

export interface TMDBMedia {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  genre_ids: number[];
  media_type?: "movie" | "tv";
  genres?: TMDBGenre[];
  runtime?: number;
  number_of_seasons?: number;
  number_of_episodes?: number;
  status?: string;
}

export interface TMDBSearchPage {
  results: TMDBMedia[];
  page: number;
  total_pages: number;
  total_results: number;
}

export interface TMDBGenre {
  id: number;
  name: string;
}

export interface TMDBActor {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

interface TMDBAggregateCredits {
  cast: Array<{
    id: number;
    name: string;
    profile_path: string | null;
    order: number;
    total_episode_count: number;
    roles: Array<{
      character: string;
      episode_count: number;
    }>;
  }>;
}

export interface TMDBPersonCredit extends TMDBMedia {
  media_type: "movie" | "tv";
  character?: string;
  credit_id?: string;
  popularity?: number;
  vote_count?: number;
}

export interface TMDBPersonDetails {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  known_for_department: string | null;
  profile_path: string | null;
  combined_credits?: {
    cast: TMDBPersonCredit[];
  };
}

export interface TMDBCrew {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface TMDBReview {
  id: string;
  author: string;
  author_details: {
    name: string;
    username: string;
    avatar_path: string | null;
    rating: number | null;
  };
  content: string;
  created_at: string;
  updated_at: string;
}

export interface TMDBEpisode {
  id: number;
  name: string;
  overview: string;
  still_path: string | null;
  air_date?: string;
  episode_number: number;
  season_number: number;
  episode_type?: string;
  vote_average: number | null;
  runtime?: number | null;
  vote_count?: number;
}

export interface TMDBSeasonDetails {
  poster_path?: string | null;
  episodes?: TMDBEpisode[];
}

const episodeTypesBySeason = new Map<string, Map<number, string>>();
const tvSeasonDetailsCache = new Map<
  string,
  Promise<TMDBSeasonDetails | null>
>();

function getCachedTVSeasonDetails(
  tvId: number,
  seasonNumber: number,
): Promise<TMDBSeasonDetails | null> {
  const key = `${tvId}:${seasonNumber}`;
  const cachedDetails = tvSeasonDetailsCache.get(key);
  if (cachedDetails) return cachedDetails;

  const detailsPromise = getTVSeasonDetails(tvId, seasonNumber);
  tvSeasonDetailsCache.set(key, detailsPromise);
  if (tvSeasonDetailsCache.size > 500) {
    const oldestKey = tvSeasonDetailsCache.keys().next().value;
    if (oldestKey) tvSeasonDetailsCache.delete(oldestKey);
  }

  return detailsPromise;
}

export interface NextUpEpisodeInfo {
  episodeType: string | null;
  seasonPosterPath: string | null;
  episodeRuntimeMinutes: number | null;
  remainingEpisodeCount: number | null;
  remainingRuntimeMinutes: number | null;
}

export async function addSeasonPosterPaths<
  T extends {
    tmdbId: number;
    seasonNumber: number | null;
  },
>(items: T[]): Promise<Array<T & { seasonPosterPath: string | null }>> {
  const seasons = new Map<string, { tmdbId: number; seasonNumber: number }>();

  for (const item of items) {
    if (item.seasonNumber === null) continue;

    const key = `${item.tmdbId}:${item.seasonNumber}`;
    seasons.set(key, {
      tmdbId: item.tmdbId,
      seasonNumber: item.seasonNumber,
    });
  }

  const seasonPosterPaths = new Map<string, string | null>();
  const seasonsToFetch = [...seasons.entries()];
  let nextSeasonIndex = 0;

  await Promise.all(
    Array.from(
      { length: Math.min(4, seasonsToFetch.length) },
      async () => {
        while (nextSeasonIndex < seasonsToFetch.length) {
          const currentIndex = nextSeasonIndex++;
          const [key, season] = seasonsToFetch[currentIndex];
          const details = await getCachedTVSeasonDetails(
            season.tmdbId,
            season.seasonNumber,
          );
          seasonPosterPaths.set(key, details?.poster_path ?? null);
        }
      },
    ),
  );

  return items.map((item) => ({
    ...item,
    seasonPosterPath:
      item.seasonNumber === null
        ? null
        : seasonPosterPaths.get(`${item.tmdbId}:${item.seasonNumber}`) ?? null,
  }));
}

export async function addNextUpEpisodeInfo<
  T extends {
    tmdbId: number;
    seasonNumber: number;
    episodeNumber: number;
  },
>(items: T[]): Promise<Array<T & NextUpEpisodeInfo>> {
  let nextItemIndex = 0;
  const infos: NextUpEpisodeInfo[] = new Array(items.length);

  await Promise.all(
    Array.from({ length: Math.min(3, items.length) }, async () => {
      while (nextItemIndex < items.length) {
        const index = nextItemIndex++;
        const item = items[index];

        try {
          const [show, firstSeason] = await Promise.all([
            getTVShowDetails(item.tmdbId),
            getCachedTVSeasonDetails(item.tmdbId, item.seasonNumber),
          ]);
          const rawEpisodeType = firstSeason?.episodes?.find(
            (episode) => episode.episode_number === item.episodeNumber,
          )?.episode_type;
          const normalizedEpisodeType = rawEpisodeType
            ?.toLowerCase()
            .replace(/[\s-]+/g, "_");
          const episodeType =
            normalizedEpisodeType && normalizedEpisodeType !== "standard"
              ? normalizedEpisodeType
              : item.episodeNumber === 1
                ? "season_premiere"
                : null;
          const seasonCount = show?.number_of_seasons;

          if (!seasonCount) {
            infos[index] = {
              episodeType: episodeType ?? null,
              seasonPosterPath: firstSeason?.poster_path ?? null,
              episodeRuntimeMinutes: null,
              remainingEpisodeCount: null,
              remainingRuntimeMinutes: null,
            };
            continue;
          }

          let episodeRuntimeMinutes: number | null = null;
          let remainingEpisodeCount = 0;
          let remainingRuntimeMinutes = 0;
          let allSeasonDetailsKnown = true;
          let allRemainingRuntimesKnown = true;
          const seasonNumbers = Array.from(
            { length: seasonCount },
            (_, seasonIndex) => seasonIndex + 1,
          );
          let nextSeasonIndex = 0;
          const seasonDetails = await Promise.all(
            Array.from(
              { length: Math.min(4, seasonNumbers.length) },
              async () => {
                const fetchedSeasons: Array<{
                  seasonNumber: number;
                  details: TMDBSeasonDetails | null;
                }> = [];

                while (nextSeasonIndex < seasonNumbers.length) {
                  const seasonNumber = seasonNumbers[nextSeasonIndex++];
                  fetchedSeasons.push({
                    seasonNumber,
                    details:
                      seasonNumber === item.seasonNumber
                        ? firstSeason
                        : await getCachedTVSeasonDetails(
                            item.tmdbId,
                            seasonNumber,
                          ),
                  });
                }

                return fetchedSeasons;
              },
            ),
          );

          for (const season of seasonDetails.flat()) {
            if (!season.details?.episodes) {
              allSeasonDetailsKnown = false;
              allRemainingRuntimesKnown = false;
              continue;
            }

            for (const episode of season.details.episodes) {
              const isRemaining =
                season.seasonNumber > item.seasonNumber ||
                (season.seasonNumber === item.seasonNumber &&
                  episode.episode_number >= item.episodeNumber);
              if (!isRemaining) continue;

              remainingEpisodeCount++;
              if (
                season.seasonNumber === item.seasonNumber &&
                episode.episode_number === item.episodeNumber
              ) {
                episodeRuntimeMinutes = episode.runtime ?? null;
              }

              if (typeof episode.runtime === "number" && episode.runtime > 0) {
                remainingRuntimeMinutes += episode.runtime;
              } else {
                allRemainingRuntimesKnown = false;
              }
            }
          }

          infos[index] = {
            episodeType: episodeType ?? null,
            seasonPosterPath: firstSeason?.poster_path ?? null,
            episodeRuntimeMinutes,
            remainingEpisodeCount: allSeasonDetailsKnown
              ? remainingEpisodeCount
              : null,
            remainingRuntimeMinutes: allRemainingRuntimesKnown
              ? remainingRuntimeMinutes
              : null,
          };
        } catch (error) {
          console.error("Error fetching Next Up episode details:", error);
          infos[index] = {
            episodeType: null,
            seasonPosterPath: null,
            episodeRuntimeMinutes: null,
            remainingEpisodeCount: null,
            remainingRuntimeMinutes: null,
          };
        }
      }
    }),
  );

  return items.map((item, index) => ({ ...item, ...infos[index] }));
}

export async function addEpisodeTypes<
  T extends {
    tmdbId: number;
    seasonNumber: number | null;
    episodeNumber: number | null;
  },
>(
  items: T[],
): Promise<
  Array<T & { episodeType: string | null; seasonPosterPath: string | null }>
> {
  const seasons = new Map<string, { tmdbId: number; seasonNumber: number }>();

  for (const item of items) {
    if (item.seasonNumber === null || item.episodeNumber === null) continue;

    const key = `${item.tmdbId}:${item.seasonNumber}`;
    seasons.set(key, {
      tmdbId: item.tmdbId,
      seasonNumber: item.seasonNumber,
    });
  }

  const seasonsToFetch = [...seasons.entries()].filter(
    ([key]) => !episodeTypesBySeason.has(key),
  );
  let nextSeasonIndex = 0;

  await Promise.all(
    Array.from(
      { length: Math.min(4, seasonsToFetch.length) },
      async () => {
        while (nextSeasonIndex < seasonsToFetch.length) {
          const currentIndex = nextSeasonIndex++;
          const [key, season] = seasonsToFetch[currentIndex];
          const details = await getCachedTVSeasonDetails(
            season.tmdbId,
            season.seasonNumber,
          );
          if (!details?.episodes) continue;

          const episodeTypes = new Map<number, string>();
          for (const episode of details.episodes as TMDBEpisode[]) {
            const episodeNumber = Number(episode.episode_number);
            const type = episode.episode_type
              ?.toLowerCase()
              .replace(/[\s-]+/g, "_");
            if (type && type !== "standard") {
              episodeTypes.set(episodeNumber, type);
            } else if (episodeNumber === 1) {
              episodeTypes.set(episodeNumber, "season_premiere");
            }
          }

          episodeTypesBySeason.set(key, episodeTypes);
          if (episodeTypesBySeason.size > 500) {
            const oldestKey = episodeTypesBySeason.keys().next().value;
            if (oldestKey) episodeTypesBySeason.delete(oldestKey);
          }
        }
      },
    ),
  );

  const itemsWithSeasonPosters = await addSeasonPosterPaths(items);

  return itemsWithSeasonPosters.map((item) => {
    if (item.seasonNumber === null || item.episodeNumber === null) {
      return { ...item, episodeType: null };
    }

    const key = `${item.tmdbId}:${item.seasonNumber}`;
    return {
      ...item,
      episodeType:
        episodeTypesBySeason.get(key)?.get(item.episodeNumber) ?? null,
    };
  });
}

export async function searchMediaPage(
  query: string,
  page = 1,
  mediaType: "multi" | "movie" | "tv" = "multi",
): Promise<TMDBSearchPage> {
  if (!TMDB_API_KEY) {
    console.error("TMDB API key is not configured");
    return { results: [], page, total_pages: 0, total_results: 0 };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/search/${mediaType}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false&page=${page}`,
      { signal: controller.signal },
    );
    if (!response.ok) {
      console.error(`TMDB search request failed (${response.status})`);
      return { results: [], page, total_pages: 0, total_results: 0 };
    }
    const data = (await response.json()) as {
      results?: Array<Omit<TMDBMedia, "media_type"> & { media_type?: string }>;
      page?: number;
      total_pages?: number;
      total_results?: number;
    };
    return {
      results: (data.results || []).filter(
        (item) => item.media_type !== "person",
      ) as TMDBMedia[],
      page: data.page ?? page,
      total_pages: data.total_pages ?? 0,
      total_results: data.total_results ?? 0,
    };
  } catch (error) {
    console.error("Error searching TMDB:", error);
    return { results: [], page, total_pages: 0, total_results: 0 };
  } finally {
    clearTimeout(timeout);
  }
}

export async function searchMedia(query: string): Promise<TMDBMedia[]> {
  const searchPage = await searchMediaPage(query);
  return searchPage.results;
}

export async function getTrendingMedia(): Promise<TMDBMedia[]> {
  const trendingPage = await getTrendingMediaPage();
  return trendingPage.results;
}

export async function getTrendingMediaPage(
  page = 1,
  mediaType: "all" | "movie" | "tv" = "all",
): Promise<TMDBSearchPage> {
  if (!TMDB_API_KEY) {
    console.error("TMDB API key is not configured");
    return { results: [], page, total_pages: 0, total_results: 0 };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/trending/${mediaType}/week?api_key=${TMDB_API_KEY}&page=${page}`,
      { signal: controller.signal },
    );
    if (!response.ok) {
      console.error(`TMDB trending request failed (${response.status})`);
      return { results: [], page, total_pages: 0, total_results: 0 };
    }
    const data = (await response.json()) as {
      results?: Array<Omit<TMDBMedia, "media_type"> & { media_type?: string }>;
      page?: number;
      total_pages?: number;
      total_results?: number;
    };
    return {
      results: (data.results ?? []).filter(
        (item) => item.media_type !== "person",
      ) as TMDBMedia[],
      page: data.page ?? page,
      total_pages: data.total_pages ?? 0,
      total_results: data.total_results ?? 0,
    };
  } catch (error) {
    console.error("Error fetching trending media:", error);
    return { results: [], page, total_pages: 0, total_results: 0 };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getGenres(): Promise<TMDBGenre[]> {
  if (!TMDB_API_KEY) {
    console.error("TMDB API key is not configured");
    return [];
  }

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/genre/movie/list?api_key=${TMDB_API_KEY}`,
    );
    const data = await response.json();
    return data.genres || [];
  } catch (error) {
    console.error("Error fetching genres:", error);
    return [];
  }
}

export async function getMovieDetails(
  movieId: number,
): Promise<TMDBMedia | null> {
  if (!TMDB_API_KEY) {
    console.error("TMDB API key is not configured");
    return null;
  }

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}`,
    );
    if (!response.ok) {
      if (response.status !== 404) {
        console.error(`TMDB movie details request failed (${response.status})`);
      }
      return null;
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching movie details:", error);
    return null;
  }
}

export async function getTVShowDetails(
  tvId: number,
): Promise<TMDBMedia | null> {
  if (!TMDB_API_KEY) {
    console.error("TMDB API key is not configured");
    return null;
  }

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/tv/${tvId}?api_key=${TMDB_API_KEY}`,
    );
    if (!response.ok) {
      if (response.status !== 404) {
        console.error(`TMDB TV show details request failed (${response.status})`);
      }
      return null;
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching TV show details:", error);
    return null;
  }
}

export async function getMediaDetails(
  mediaId: number,
  mediaType: "movie" | "tv",
): Promise<TMDBMedia | null> {
  if (mediaType === "movie") {
    return getMovieDetails(mediaId);
  } else {
    return getTVShowDetails(mediaId);
  }
}

export async function getMovieCredits(
  movieId: number,
): Promise<{ cast: TMDBActor[]; crew: TMDBCrew[] } | null> {
  if (!TMDB_API_KEY) {
    console.error("TMDB API key is not configured");
    return null;
  }

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/movie/${movieId}/credits?api_key=${TMDB_API_KEY}`,
    );
    const data = await response.json();
    return { cast: data.cast || [], crew: data.crew || [] };
  } catch (error) {
    console.error("Error fetching movie credits:", error);
    return null;
  }
}

export async function getTVCredits(
  tvId: number,
): Promise<{ cast: TMDBActor[]; crew: TMDBCrew[] } | null> {
  const credits = await fetchTmdbJson<TMDBAggregateCredits>(
    `${TMDB_BASE_URL}/tv/${tvId}/aggregate_credits?api_key=${TMDB_API_KEY}`,
  );
  if (!credits) return null;

  const cast = [...credits.cast]
    .sort(
      (a, b) =>
        b.total_episode_count - a.total_episode_count || a.order - b.order,
    )
    .map((actor, index) => {
      const character = [...actor.roles]
        .sort((a, b) => b.episode_count - a.episode_count)
        .find((role) => role.character)?.character;

      return {
        id: actor.id,
        name: actor.name,
        character: character || "Unknown role",
        profile_path: actor.profile_path,
        order: index,
      };
    });

  return { cast, crew: [] };
}

export async function getMediaCredits(
  mediaId: number,
  mediaType: "movie" | "tv",
): Promise<{ cast: TMDBActor[]; crew: TMDBCrew[] } | null> {
  if (mediaType === "movie") {
    return getMovieCredits(mediaId);
  } else {
    return getTVCredits(mediaId);
  }
}

export async function getMovieReviews(movieId: number): Promise<TMDBReview[]> {
  if (!TMDB_API_KEY) {
    console.error("TMDB API key is not configured");
    return [];
  }

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/movie/${movieId}/reviews?api_key=${TMDB_API_KEY}`,
    );
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("Error fetching movie reviews:", error);
    return [];
  }
}

export async function getTVReviews(tvId: number): Promise<TMDBReview[]> {
  if (!TMDB_API_KEY) {
    console.error("TMDB API key is not configured");
    return [];
  }

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/tv/${tvId}/reviews?api_key=${TMDB_API_KEY}`,
    );
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("Error fetching TV reviews:", error);
    return [];
  }
}

export async function getMediaReviews(
  mediaId: number,
  mediaType: "movie" | "tv",
): Promise<TMDBReview[]> {
  if (mediaType === "movie") {
    return getMovieReviews(mediaId);
  } else {
    return getTVReviews(mediaId);
  }
}

export async function getMovieRecommendations(
  movieId: number,
): Promise<TMDBMedia[]> {
  if (!TMDB_API_KEY) {
    console.error("TMDB API key is not configured");
    return [];
  }

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/movie/${movieId}/recommendations?api_key=${TMDB_API_KEY}`,
    );
    const data = await response.json();
    const results = data.results || [];
    return results.map((item: any) => ({ ...item, media_type: "movie" }));
  } catch (error) {
    console.error("Error fetching movie recommendations:", error);
    return [];
  }
}

export async function getTVRecommendations(tvId: number): Promise<TMDBMedia[]> {
  if (!TMDB_API_KEY) {
    console.error("TMDB API key is not configured");
    return [];
  }

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/tv/${tvId}/recommendations?api_key=${TMDB_API_KEY}`,
    );
    const data = await response.json();
    const results = data.results || [];
    return results.map((item: any) => ({ ...item, media_type: "tv" }));
  } catch (error) {
    console.error("Error fetching TV recommendations:", error);
    return [];
  }
}

export async function getMediaRecommendations(
  mediaId: number,
  mediaType: "movie" | "tv",
): Promise<TMDBMedia[]> {
  if (mediaType === "movie") {
    return getMovieRecommendations(mediaId);
  } else {
    return getTVRecommendations(mediaId);
  }
}

export function getPosterUrl(
  path: string | null,
  size: string = "w500",
): string {
  if (!path) return "/placeholder-poster.svg";
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function getBackdropUrl(
  path: string | null,
  size: string = "original",
): string {
  if (!path) return "";
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function getRandomBackdropUrl(mediaList: TMDBMedia[] = []): string {
  const validBackdrops = mediaList
    .map((media) => media.backdrop_path)
    .filter((path): path is string => Boolean(path));

  if (!validBackdrops.length) return "";

  const randomBackdrop =
    validBackdrops[Math.floor(Math.random() * validBackdrops.length)];

  return getBackdropUrl(randomBackdrop, "original");
}

export function getProfileUrl(
  path: string | null,
  size: string = "w185",
): string {
  if (!path) return "/placeholder-avatar.svg";
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function getMediaTitle(media: TMDBMedia): string {
  return media.title || media.name || "Unknown";
}

export function getMediaDate(media: TMDBMedia): string {
  const dateStr = media.release_date || media.first_air_date;
  if (!dateStr) return "Unknown";

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "Unknown";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getMediaType(media: TMDBMedia): string {
  if (media.media_type) return media.media_type;
  return media.title ? "movie" : "tv";
}

export async function getPersonDetails(
  personId: number,
): Promise<TMDBPersonDetails | null> {
  return fetchTmdbJson<TMDBPersonDetails>(
    `${TMDB_BASE_URL}/person/${personId}?api_key=${TMDB_API_KEY}&append_to_response=combined_credits`,
  );
}

async function fetchTmdbJson<T>(url: string): Promise<T | null> {
  if (!TMDB_API_KEY) {
    console.error("TMDB API key is not configured");
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      if (response.status !== 404) {
        const text = await response.text();
        console.error(
          `TMDB request failed (${response.status}): ${text.slice(0, 200)}`,
        );
      }
      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error(`Error fetching TMDB data for ${url}:`, error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getTVSeasonDetails(
  tvId: number,
  seasonNumber: number,
): Promise<TMDBSeasonDetails | null> {
  return fetchTmdbJson<TMDBSeasonDetails>(
    `${TMDB_BASE_URL}/tv/${tvId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}`,
  );
}

export async function getTVEpisodeDetails(
  tvId: number,
  seasonNumber: number,
  episodeNumber: number,
): Promise<TMDBEpisode | null> {
  return fetchTmdbJson<TMDBEpisode>(
    `${TMDB_BASE_URL}/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}?api_key=${TMDB_API_KEY}`,
  );
}

export async function getTVEpisodeCredits(
  tvId: number,
  seasonNumber: number,
  episodeNumber: number,
): Promise<{ cast: TMDBActor[]; crew: TMDBCrew[] } | null> {
  if (!TMDB_API_KEY) {
    console.error("TMDB API key is not configured");
    return null;
  }

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}/credits?api_key=${TMDB_API_KEY}`,
    );
    const data = await response.json();
    return { cast: data.cast || [], crew: data.crew || [] };
  } catch (error) {
    console.error("Error fetching TV episode credits:", error);
    return null;
  }
}
