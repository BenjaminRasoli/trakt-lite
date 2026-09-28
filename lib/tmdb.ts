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
  vote_average: number | null;
  runtime?: number | null;
  vote_count?: number;
}

export async function searchMedia(query: string): Promise<TMDBMedia[]> {
  if (!TMDB_API_KEY) {
    console.error("TMDB API key is not configured");
    return [];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false`,
      { signal: controller.signal },
    );
    if (!response.ok) {
      console.error(`TMDB search request failed (${response.status})`);
      return [];
    }
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("Error searching TMDB:", error);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function getTrendingMedia(): Promise<TMDBMedia[]> {
  if (!TMDB_API_KEY) {
    console.error("TMDB API key is not configured");
    return [];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/trending/all/week?api_key=${TMDB_API_KEY}`,
      { signal: controller.signal },
    );
    if (!response.ok) {
      console.error(`TMDB trending request failed (${response.status})`);
      return [];
    }
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("Error fetching trending media:", error);
    return [];
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
  if (!TMDB_API_KEY) {
    console.error("TMDB API key is not configured");
    return null;
  }

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/tv/${tvId}/credits?api_key=${TMDB_API_KEY}`,
    );
    const data = await response.json();
    return { cast: data.cast || [], crew: data.crew || [] };
  } catch (error) {
    console.error("Error fetching TV credits:", error);
    return null;
  }
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
  return media.release_date || media.first_air_date || "Unknown";
}

export function getMediaType(media: TMDBMedia): string {
  if (media.media_type) return media.media_type;
  return media.title ? "movie" : "tv";
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
      const text = await response.text();
      console.error(
        `TMDB request failed (${response.status}): ${text.slice(0, 200)}`,
      );
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
): Promise<any> {
  return fetchTmdbJson(
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
