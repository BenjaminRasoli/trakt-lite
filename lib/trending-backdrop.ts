import { getRandomBackdropUrl, getTrendingMedia } from "@/lib/tmdb";

const CACHE_TTL_MS = 60 * 60 * 1000;
let cachedBackdrop: { url: string; expiresAt: number } | null = null;
let pendingBackdrop: Promise<string> | null = null;

export async function getTrendingBackdropUrl(): Promise<string> {
  const now = Date.now();
  if (cachedBackdrop && cachedBackdrop.expiresAt > now) {
    return cachedBackdrop.url;
  }

  if (!pendingBackdrop) {
    pendingBackdrop = (async () => {
      try {
        const trendingMedia = await getTrendingMedia();
        const url = getRandomBackdropUrl(trendingMedia);
        cachedBackdrop = { url, expiresAt: Date.now() + CACHE_TTL_MS };
        return url;
      } finally {
        pendingBackdrop = null;
      }
    })();
  }

  return pendingBackdrop;
}
