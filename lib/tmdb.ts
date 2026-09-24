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
}

export interface TMDBGenre {
  id: number;
  name: string;
}

export async function searchMedia(query: string): Promise<TMDBMedia[]> {
  if (!TMDB_API_KEY) {
    console.error("TMDB API key is not configured");
    return [];
  }

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false`,
    );
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("Error searching TMDB:", error);
    return [];
  }
}

export async function getTrendingMedia(): Promise<TMDBMedia[]> {
  if (!TMDB_API_KEY) {
    console.error("TMDB API key is not configured");
    return [];
  }

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/trending/all/week?api_key=${TMDB_API_KEY}`,
    );
    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error("Error fetching trending media:", error);
    return [];
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

export function getPosterUrl(
  path: string | null,
  size: string = "w500",
): string {
  if (!path) return "/placeholder-poster.svg";
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
