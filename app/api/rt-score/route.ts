import { NextRequest, NextResponse } from "next/server";

const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || "";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const cache = new Map<
  string,
  {
    tomatometer: number | null;
    popcornmeter: number | null;
    tomatometerSentiment: string | null;
    popcornmeterSentiment: string | null;
    url: string | null;
    fetchedAt: number;
  }
>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function toSlug(title: string) {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
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
      tomatometer: cached.tomatometer,
      popcornmeter: cached.popcornmeter,
      tomatometerSentiment: cached.tomatometerSentiment,
      popcornmeterSentiment: cached.popcornmeterSentiment,
      url: cached.url,
    });
  }

  const result = {
    tomatometer: null as number | null,
    popcornmeter: null as number | null,
    tomatometerSentiment: null as string | null,
    popcornmeterSentiment: null as string | null,
    url: null as string | null,
  };

  try {
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

    const section = type === "movie" ? "m" : "tv";
    const candidates = [
      `/${section}/${slug}`,
      ...(year ? [`/${section}/${slug}_${year}`] : []),
    ];

    for (const path of candidates) {
      const html = await fetchHtml(`https://www.rottentomatoes.com${path}`);
      if (!html) continue;

      const yearMatch =
        html.match(/"dateCreated":"(\d{4})/) ||
        html.match(/"datePublished":"(\d{4})/);
      if (yearMatch && year && yearMatch[1] !== year) continue;

      const criticsBlock = html.match(/"criticsScore":\{([\s\S]*?)\}/);
      const criticsScore = criticsBlock?.[1].match(/"scorePercent":"(\d+)%"/);
      const criticsSentiment = criticsBlock?.[1].match(
        /"sentiment":"(\w+)"/,
      );
      const audienceBlock =
        html.match(/"audienceVerified":\{([\s\S]*?)\}/) ||
        html.match(/"audienceAll":\{([\s\S]*?)\}/);
      const audienceScore = audienceBlock?.[1].match(/"scorePercent":"(\d+)%"/);
      const audienceSentiment = audienceBlock?.[1].match(
        /"sentiment":"(\w+)"/,
      );

      if (!criticsScore && !audienceScore) continue;

      result.tomatometer = criticsScore
        ? parseInt(criticsScore[1], 10)
        : null;
      result.popcornmeter = audienceScore
        ? parseInt(audienceScore[1], 10)
        : null;
      result.tomatometerSentiment = criticsSentiment?.[1] ?? null;
      result.popcornmeterSentiment = audienceSentiment?.[1] ?? null;
      result.url = `https://www.rottentomatoes.com${path}`;
      break;
    }
  } catch (error) {
    console.error("RT score lookup failed:", error);
  }

  cache.set(cacheKey, { ...result, fetchedAt: Date.now() });
  return NextResponse.json({
    tomatometer: result.tomatometer,
    popcornmeter: result.popcornmeter,
    tomatometerSentiment: result.tomatometerSentiment,
    popcornmeterSentiment: result.popcornmeterSentiment,
    url: result.url,
  });
}
