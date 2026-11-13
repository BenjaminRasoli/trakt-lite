import { NextRequest, NextResponse } from "next/server";

const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || "";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const cache = new Map<
  string,
  { rating: number | null; votes: number | null; url: string | null; fetchedAt: number }
>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function toSlug(title: string) {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type");
  const id = request.nextUrl.searchParams.get("id");

  if ((type !== "movie" && type !== "tv") || !id || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid params" }, { status: 400 });
  }

  const cacheKey = `${type}:${id}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({
      rating: cached.rating,
      votes: cached.votes,
      url: cached.url,
    });
  }

  const result = {
    rating: null as number | null,
    votes: null as number | null,
    url: null as string | null,
  };

  try {
    if (type !== "movie") throw new Error("Letterboxd only covers films");
    if (!TMDB_API_KEY) throw new Error("TMDB API key missing");

    const detailsResponse = await fetch(
      `https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!detailsResponse.ok) throw new Error("TMDB details failed");
    const details = await detailsResponse.json();

    const title = type === "movie" ? details.title : details.name;
    const date =
      type === "movie" ? details.release_date : details.first_air_date;
    const year = typeof date === "string" ? date.slice(0, 4) : "";
    if (!title) throw new Error("No title");

    const slug = toSlug(title);
    if (!slug) throw new Error("Empty slug");

    const candidates = [
      `/film/${slug}/`,
      ...(year ? [`/film/${slug}-${year}/`] : []),
    ];

    for (const path of candidates) {
      const url = `https://letterboxd.com${path}`;
      const html = await fetchHtml(url);
      if (!html || html.includes("Letterboxd - Not Found")) continue;

      const ratingMatch = html.match(/"ratingValue":([\d.]+)/);
      if (!ratingMatch) continue;

      const pageYearMatch =
        html.match(/<title>[^<]*\((\d{4})\)/) ||
        html.match(/"datePublished":"(\d{4})/);
      if (pageYearMatch && year && pageYearMatch[1] !== year) continue;

      const votesMatch = html.match(/"ratingCount":(\d+)/);
      result.rating = parseFloat(ratingMatch[1]);
      result.votes = votesMatch ? parseInt(votesMatch[1], 10) : null;
      result.url = url;
      break;
    }
  } catch (error) {
    console.error("Letterboxd score lookup failed:", error);
  }

  cache.set(cacheKey, { ...result, fetchedAt: Date.now() });
  return NextResponse.json(result);
}
