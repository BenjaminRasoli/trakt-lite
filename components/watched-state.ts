"use client";

let cachedUserId: string | null = null;
let cachedWatchedIds: Promise<Set<number>> | null = null;

export function getWatchedIds(userId: string): Promise<Set<number>> {
  if (cachedUserId !== userId) {
    cachedUserId = userId;
    cachedWatchedIds = null;
  }

  if (!cachedWatchedIds) {
    cachedWatchedIds = fetch("/api/watch-history?watchedIdsOnly=true")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch watched media.");
        }
        return new Set<number>(data.tmdbIds);
      })
      .catch((error: unknown) => {
        if (cachedUserId === userId) cachedWatchedIds = null;
        throw error;
      });
  }

  return cachedWatchedIds;
}

export function notifyWatchedChanged() {
  cachedWatchedIds = null;
  window.dispatchEvent(new Event("watch-history-updated"));
}
