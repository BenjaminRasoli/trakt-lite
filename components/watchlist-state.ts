"use client";

let cachedUserId: string | null = null;
let cachedWatchlistIds: Promise<Set<number>> | null = null;

export function getWatchlistIds(userId: string): Promise<Set<number>> {
  if (cachedUserId !== userId) {
    cachedUserId = userId;
    cachedWatchlistIds = null;
  }

  if (!cachedWatchlistIds) {
    cachedWatchlistIds = fetch("/api/watchlist?idsOnly=true")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch watchlist.");
        }
        return new Set<number>(data.tmdbIds);
      })
      .catch((error: unknown) => {
        if (cachedUserId === userId) cachedWatchlistIds = null;
        throw error;
      });
  }

  return cachedWatchlistIds;
}

export function notifyWatchlistChanged() {
  cachedWatchlistIds = null;
  window.dispatchEvent(new Event("watchlist-updated"));
}
