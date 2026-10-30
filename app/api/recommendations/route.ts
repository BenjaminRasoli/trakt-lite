import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getMediaRecommendations } from "@/lib/tmdb";
import type { TMDBMedia } from "@/lib/tmdb";

type RecommendationSeed = {
  tmdbId: number;
  title: string;
  mediaType: "movie" | "tv";
  watchedAt: Date;
};

type RankedRecommendation = {
  media: TMDBMedia;
  score: number;
  matchedSeeds: string[];
};

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
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

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.upsert({
      where: { email: user.email },
      update: { supabaseUserId: user.id },
      create: {
        supabaseUserId: user.id,
        email: user.email,
        username: user.user_metadata?.username || user.email.split("@")[0],
      },
    });

    const [watchHistory, watchlistItems] = await Promise.all([
      prisma.watchHistory.findMany({
        where: { userId: dbUser.id },
        select: {
          watchedAt: true,
          media: {
            select: {
              id: true,
              tmdbId: true,
              title: true,
              mediaType: true,
            },
          },
        },
        distinct: ["mediaId"],
        orderBy: { watchedAt: "desc" },
      }),
      prisma.watchlist.findMany({
        where: { userId: dbUser.id },
        select: {
          media: {
            select: { tmdbId: true, mediaType: true },
          },
        },
      }),
    ]);

    const excludedMediaKeys = new Set([
      ...watchHistory.map(
        (entry) => `${entry.media.mediaType}:${entry.media.tmdbId}`,
      ),
      ...watchlistItems.map(
        (entry) => `${entry.media.mediaType}:${entry.media.tmdbId}`,
      ),
    ]);

    const recentByType: Record<"movie" | "tv", RecommendationSeed[]> = {
      movie: [],
      tv: [],
    };

    for (const entry of watchHistory) {
      const mediaType = entry.media.mediaType;
      if (mediaType !== "movie" && mediaType !== "tv") continue;
      if (recentByType[mediaType].length >= 6) continue;

      recentByType[mediaType].push({
        tmdbId: entry.media.tmdbId,
        title: entry.media.title,
        mediaType,
        watchedAt: entry.watchedAt,
      });
    }

    const seeds = [...recentByType.movie, ...recentByType.tv]
      .sort((a, b) => b.watchedAt.getTime() - a.watchedAt.getTime())
      .slice(0, 12);

    if (seeds.length === 0) {
      return NextResponse.json({
        recommendations: [],
        basedOn: [],
        hasWatchHistory: false,
      });
    }

    const seedRecommendations = await mapWithConcurrency(
      seeds,
      4,
      async (seed) => ({
        seed,
        recommendations: await getMediaRecommendations(
          seed.tmdbId,
          seed.mediaType,
        ),
      }),
    );

    const ranked = new Map<string, RankedRecommendation>();

    for (const [seedIndex, result] of seedRecommendations.entries()) {
      const recencyWeight =
        1 + (seeds.length - seedIndex) / seeds.length;

      for (const [rank, recommendation] of result.recommendations.entries()) {
        const mediaType =
          recommendation.media_type ||
          (recommendation.title ? "movie" : "tv");
        if (mediaType !== "movie" && mediaType !== "tv") continue;

        const key = `${mediaType}:${recommendation.id}`;
        if (excludedMediaKeys.has(key)) continue;

        const existing = ranked.get(key);
        const rankWeight = 1 / (1 + rank * 0.08);
        if (existing) {
          existing.score += recencyWeight * rankWeight;
          if (!existing.matchedSeeds.includes(result.seed.title)) {
            existing.matchedSeeds.push(result.seed.title);
          }
        } else {
          ranked.set(key, {
            media: { ...recommendation, media_type: mediaType },
            score: recencyWeight * rankWeight,
            matchedSeeds: [result.seed.title],
          });
        }
      }
    }

    const recommendations = [...ranked.values()]
      .sort(
        (a, b) =>
          b.score - a.score ||
          (b.media.vote_average ?? 0) - (a.media.vote_average ?? 0) ||
          (b.media.popularity ?? 0) - (a.media.popularity ?? 0),
      )
      .map(({ media, matchedSeeds, score }) => ({
        ...media,
        recommendationReason: `Because you watched ${matchedSeeds[0]}`,
        recommendationScore: score,
      }));

    return NextResponse.json({
      recommendations,
      basedOn: seeds.map(({ tmdbId, title, mediaType }) => ({
        tmdbId,
        title,
        mediaType,
      })),
      hasWatchHistory: true,
    });
  } catch (error) {
    console.error("Error generating recommendations:", error);
    return NextResponse.json(
      { error: "Failed to generate recommendations" },
      { status: 500 },
    );
  }
}
