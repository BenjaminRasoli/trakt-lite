"use client";

import { useEffect, useState } from "react";

export interface InitialRating {
  key: string;
  eligible: boolean;
  rating: { score: number; updatedAt: string } | null;
}

export function useInitialRating(
  tmdbId: number,
  mediaType: "movie" | "tv",
  seasonNumber?: number,
  episodeNumber?: number,
): InitialRating | undefined {
  const [result, setResult] = useState<InitialRating | undefined>(undefined);

  useEffect(() => {
    if (!Number.isSafeInteger(tmdbId) || tmdbId <= 0) return;

    const controller = new AbortController();
    const params = new URLSearchParams({ tmdbId: String(tmdbId), mediaType });
    if (seasonNumber !== undefined) {
      params.set("seasonNumber", String(seasonNumber));
    }
    if (episodeNumber !== undefined) {
      params.set("episodeNumber", String(episodeNumber));
    }

    fetch(`/api/ratings?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const data: unknown = await response.json();
        if (
          data &&
          typeof data === "object" &&
          "eligible" in data &&
          typeof data.eligible === "boolean"
        ) {
          const rating =
            "rating" in data &&
            data.rating &&
            typeof data.rating === "object" &&
            "score" in data.rating &&
            typeof data.rating.score === "number"
              ? {
                  score: data.rating.score,
                  updatedAt:
                    "updatedAt" in data.rating &&
                    typeof data.rating.updatedAt === "string"
                      ? data.rating.updatedAt
                      : "",
                }
              : null;
          setResult({
            key: params.toString(),
            eligible: data.eligible,
            rating,
          });
        }
      })
      .catch(() => {});

    return () => controller.abort();
  }, [tmdbId, mediaType, seasonNumber, episodeNumber]);

  return result;
}
