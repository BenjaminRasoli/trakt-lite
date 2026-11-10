import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getMediaRecommendations, getTrendingMedia } from "@/lib/tmdb";
import type { TMDBMedia } from "@/lib/tmdb";

type RecommendationSeed = {
  tmdbId: number;
  title: string;
  mediaType: "movie" | "tv";
  score: number;
  genreIds: number[];
  updatedAt: Date;
};

type RankedRecommendation = {
  media: TMDBMedia;
  score: number;
  matchedSeeds: RecommendationSeed[];
};

const NEUTRAL_RATING = 5.5;

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

    const [ratings, watchHistory, watchlistItems] = await Promise.all([
      prisma.userRating.findMany({
        where: { userId: dbUser.id },
        select: {
          score: true,
          updatedAt: true,
          seasonNumber: true,
          episodeNumber: true,
          media: {
            select: {
              tmdbId: true,
              title: true,
              mediaType: true,
              genreIds: true,
            },
          },
        },
      }),
      prisma.watchHistory.findMany({
        where: { userId: dbUser.id },
        select: {
          media: {
            select: {
              tmdbId: true,
              mediaType: true,
            },
          },
        },
        distinct: ["mediaId"],
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

    const ratingsByMedia = new Map<
      string,
      {
        tmdbId: number;
        title: string;
        mediaType: "movie" | "tv";
        genreIds: number[];
        seriesScores: number[];
        seasonScores: Map<number, number[]>;
        episodeScores: Map<number, number[]>;
        updatedAt: Date;
      }
    >();

    for (const rating of ratings) {
      const { media } = rating;
      if (media.mediaType !== "movie" && media.mediaType !== "tv") continue;

      const key = `${media.mediaType}:${media.tmdbId}`;
      const existing = ratingsByMedia.get(key);
      if (existing) {
        if (rating.seasonNumber === null) {
          existing.seriesScores.push(rating.score);
        } else if (rating.episodeNumber === null) {
          const scores =
            existing.seasonScores.get(rating.seasonNumber) ?? [];
          scores.push(rating.score);
          existing.seasonScores.set(rating.seasonNumber, scores);
        } else {
          const scores =
            existing.episodeScores.get(rating.seasonNumber) ?? [];
          scores.push(rating.score);
          existing.episodeScores.set(rating.seasonNumber, scores);
        }
        if (rating.updatedAt > existing.updatedAt) {
          existing.updatedAt = rating.updatedAt;
        }
      } else {
        const seasonScores = new Map<number, number[]>();
        const episodeScores = new Map<number, number[]>();
        if (rating.seasonNumber !== null && rating.episodeNumber === null) {
          seasonScores.set(rating.seasonNumber, [rating.score]);
        } else if (
          rating.seasonNumber !== null &&
          rating.episodeNumber !== null
        ) {
          episodeScores.set(rating.seasonNumber, [rating.score]);
        }
        ratingsByMedia.set(key, {
          tmdbId: media.tmdbId,
          title: media.title,
          mediaType: media.mediaType,
          genreIds: media.genreIds,
          seriesScores:
            rating.seasonNumber === null ? [rating.score] : [],
          seasonScores,
          episodeScores,
          updatedAt: rating.updatedAt,
        });
      }
    }

    const excludedMediaKeys = new Set([
      ...watchHistory.map(
        (entry) => `${entry.media.mediaType}:${entry.media.tmdbId}`,
      ),
      ...watchlistItems.map(
        (entry) => `${entry.media.mediaType}:${entry.media.tmdbId}`,
      ),
      ...ratingsByMedia.keys(),
    ]);

    const average = (scores: number[]) =>
      scores.length > 0
        ? scores.reduce((total, score) => total + score, 0) / scores.length
        : null;

    const seeds = [...ratingsByMedia.values()]
      .map(({ seriesScores, seasonScores, episodeScores, ...seed }) => {
        const seasonAverages = [...seasonScores.values()]
          .map(average)
          .filter((score): score is number => score !== null);
        const episodeAverages = [...episodeScores.values()]
          .map(average)
          .filter((score): score is number => score !== null);
        const ratingLevels = [
          { score: average(seriesScores), weight: 0.7 },
          { score: average(seasonAverages), weight: 0.2 },
          { score: average(episodeAverages), weight: 0.1 },
        ].filter(
          (level): level is { score: number; weight: number } =>
            level.score !== null,
        );
        const totalWeight = ratingLevels.reduce(
          (total, level) => total + level.weight,
          0,
        );
        const score =
          ratingLevels.reduce(
            (total, level) => total + level.score * level.weight,
            0,
          ) / totalWeight;

        return { ...seed, score };
      })
      .sort(
        (a, b) =>
          Math.abs(b.score - NEUTRAL_RATING) -
            Math.abs(a.score - NEUTRAL_RATING) ||
          b.updatedAt.getTime() - a.updatedAt.getTime(),
      )
      .slice(0, 12);

    if (seeds.length === 0) {
      return NextResponse.json({
        recommendations: [],
        hasRatings: ratingsByMedia.size > 0,
      });
    }

    const dislikedGenreWeights = new Map<number, number>();
    let totalDislikeWeight = 0;
    for (const seed of seeds) {
      if (seed.score >= NEUTRAL_RATING) continue;

      const dislikeWeight = (NEUTRAL_RATING - seed.score) / NEUTRAL_RATING;
      totalDislikeWeight += dislikeWeight;
      for (const genreId of seed.genreIds) {
        dislikedGenreWeights.set(
          genreId,
          (dislikedGenreWeights.get(genreId) ?? 0) + dislikeWeight,
        );
      }
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

    for (const result of seedRecommendations) {
      const ratingSignal =
        (result.seed.score - NEUTRAL_RATING) / (10 - NEUTRAL_RATING);
      if (ratingSignal === 0) continue;

      for (const [rank, recommendation] of result.recommendations.entries()) {
        const mediaType =
          recommendation.media_type ||
          (recommendation.title ? "movie" : "tv");
        if (mediaType !== "movie" && mediaType !== "tv") continue;

        const key = `${mediaType}:${recommendation.id}`;
        if (excludedMediaKeys.has(key)) continue;

        const existing = ranked.get(key);
        const rankWeight = 1 / (1 + rank * 0.08);
        const scoreContribution = ratingSignal * rankWeight;
        if (existing) {
          existing.score += scoreContribution;
          if (ratingSignal > 0 &&
            !existing.matchedSeeds.some(
              (seed) =>
                seed.mediaType === result.seed.mediaType &&
                seed.tmdbId === result.seed.tmdbId,
            )
          ) {
            existing.matchedSeeds.push(result.seed);
          }
        } else {
          ranked.set(key, {
            media: { ...recommendation, media_type: mediaType },
            score: scoreContribution,
            matchedSeeds: ratingSignal > 0 ? [result.seed] : [],
          });
        }
      }
    }

    const personalizedRecommendations = [...ranked.values()]
      .map((recommendation) => {
        const genreIds = recommendation.media.genre_ids ?? [];
        const dislikedGenreOverlap =
          totalDislikeWeight === 0
            ? 0
            : genreIds.reduce(
                (total, genreId) =>
                  total +
                  (dislikedGenreWeights.get(genreId) ?? 0) /
                    totalDislikeWeight,
                0,
              ) / Math.max(genreIds.length, 1);
        return {
          ...recommendation,
          score: recommendation.score - dislikedGenreOverlap,
        };
      })
      .filter((recommendation) => recommendation.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          (b.media.vote_average ?? 0) - (a.media.vote_average ?? 0) ||
          (b.media.popularity ?? 0) - (a.media.popularity ?? 0),
      );

    const recommendations = personalizedRecommendations.length > 0
      ? personalizedRecommendations.map(({ media, score }) => ({
          ...media,
          recommendationScore: score,
        }))
      : (await getTrendingMedia())
          .filter((media) => {
            const mediaType = media.media_type;
            return (
              (mediaType === "movie" || mediaType === "tv") &&
              !excludedMediaKeys.has(`${mediaType}:${media.id}`)
            );
          })
          .map((media, index) => {
            const genreIds = media.genre_ids ?? [];
            const dislikedGenreOverlap =
              totalDislikeWeight === 0
                ? 0
                : genreIds.reduce(
                    (total, genreId) =>
                      total +
                      (dislikedGenreWeights.get(genreId) ?? 0) /
                        totalDislikeWeight,
                    0,
                  ) / Math.max(genreIds.length, 1);
            return {
              ...media,
              recommendationScore:
                1 / (1 + index * 0.08) - dislikedGenreOverlap,
            };
          })
          .filter((media) => media.recommendationScore > 0)
          .sort((a, b) => b.recommendationScore - a.recommendationScore);

    return NextResponse.json({
      recommendations,
      hasRatings: ratingsByMedia.size > 0,
    });
  } catch (error) {
    console.error("Error generating recommendations:", error);
    return NextResponse.json(
      { error: "Failed to generate recommendations" },
      { status: 500 },
    );
  }
}
