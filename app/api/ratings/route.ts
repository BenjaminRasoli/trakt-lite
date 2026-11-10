import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { addSeasonPosterPaths, getTVSeasonDetails } from "@/lib/tmdb";

type RatingTarget = {
  tmdbId: number;
  mediaType: "movie" | "tv";
  seasonNumber: number | null;
  episodeNumber: number | null;
  subjectKey: string;
};

function parseTarget(
  params: URLSearchParams,
): { target: RatingTarget } | { error: string } {
  const tmdbId = Number(params.get("tmdbId"));
  const mediaType = params.get("mediaType");
  const hasSeason = params.has("seasonNumber");
  const hasEpisode = params.has("episodeNumber");
  const seasonNumber = hasSeason ? Number(params.get("seasonNumber")) : null;
  const episodeNumber = hasEpisode ? Number(params.get("episodeNumber")) : null;

  if (!Number.isSafeInteger(tmdbId) || tmdbId <= 0) {
    return { error: "A valid TMDB ID is required" };
  }
  if (mediaType !== "movie" && mediaType !== "tv") {
    return { error: "Media type must be movie or tv" };
  }
  if (
    (hasSeason &&
      (!Number.isSafeInteger(seasonNumber) || seasonNumber! < 0)) ||
    (hasEpisode &&
      (!hasSeason ||
        !Number.isSafeInteger(episodeNumber) ||
        episodeNumber! <= 0)) ||
    (mediaType !== "tv" && (hasSeason || hasEpisode))
  ) {
    return { error: "Valid season and episode numbers are required for TV ratings" };
  }

  return {
    target: {
      tmdbId,
      mediaType,
      seasonNumber,
      episodeNumber,
      subjectKey:
        episodeNumber !== null
          ? `episode:${seasonNumber}:${episodeNumber}`
          : seasonNumber !== null
            ? `season:${seasonNumber}`
            : "media",
    },
  };
}

async function getEligibleMedia(userId: string, target: RatingTarget) {
  const media = await prisma.media.findUnique({
    where: { tmdbId: target.tmdbId },
    select: { id: true, mediaType: true },
  });

  if (!media || media.mediaType !== target.mediaType) return null;

  const watched = await prisma.watchHistory.findFirst({
    where: {
      userId,
      mediaId: media.id,
      ...(target.episodeNumber !== null
        ? {
            seasonNumber: target.seasonNumber,
            episodeNumber: target.episodeNumber,
          }
        : target.seasonNumber !== null
          ? {
              seasonNumber: target.seasonNumber,
              episodeNumber: { not: null },
            }
        : target.mediaType === "tv"
          ? {
              seasonNumber: { not: null },
              episodeNumber: { not: null },
            }
          : { seasonNumber: null, episodeNumber: null }),
    },
    select: { id: true },
  });

  return watched ? media : null;
}

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  return prisma.user.findUnique({
    where: { email: user.email },
    select: { id: true },
  });
}

export async function GET(request: NextRequest) {
  try {
    if (!request.nextUrl.searchParams.has("tmdbId")) {
      const user = await getUser();
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const ratings = await prisma.userRating.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
        include: {
          media: {
            select: {
              tmdbId: true,
              title: true,
              mediaType: true,
              posterPath: true,
            },
          },
        },
      });

      const ratingsWithSeasonPosters = await addSeasonPosterPaths(
        ratings.map((rating) => ({
          ...rating,
          tmdbId: rating.media.tmdbId,
        })),
      );
      const seasons = new Map<
        string,
        { tmdbId: number; seasonNumber: number }
      >();

      for (const rating of ratingsWithSeasonPosters) {
        if (rating.media.mediaType !== "tv" || rating.seasonNumber === null) {
          continue;
        }

        const key = `${rating.tmdbId}:${rating.seasonNumber}`;
        seasons.set(key, {
          tmdbId: rating.tmdbId,
          seasonNumber: rating.seasonNumber,
        });
      }

      const seasonDetails = new Map<
        string,
        Awaited<ReturnType<typeof getTVSeasonDetails>>
      >();
      const seasonsToFetch = [...seasons.entries()];
      let nextSeasonIndex = 0;

      await Promise.all(
        Array.from(
          { length: Math.min(4, seasonsToFetch.length) },
          async () => {
            while (nextSeasonIndex < seasonsToFetch.length) {
              const [key, season] = seasonsToFetch[nextSeasonIndex++];
              seasonDetails.set(
                key,
                await getTVSeasonDetails(season.tmdbId, season.seasonNumber),
              );
            }
          },
        ),
      );

      return NextResponse.json({
        items: ratingsWithSeasonPosters.map((rating) => {
          const key = `${rating.tmdbId}:${rating.seasonNumber}`;
          const details =
            rating.seasonNumber === null ? null : seasonDetails.get(key);
          const episodeName =
            rating.episodeNumber === null
              ? null
              : details?.episodes?.find(
                  (episode) =>
                    episode.episode_number === rating.episodeNumber,
                )?.name ?? null;

          return {
            id: rating.id,
            subjectKey: rating.subjectKey,
            seasonNumber: rating.seasonNumber,
            episodeNumber: rating.episodeNumber,
            score: rating.score,
            updatedAt: rating.updatedAt,
            seasonPosterPath: rating.seasonPosterPath,
            seasonName: details?.name ?? null,
            episodeName,
            media: rating.media,
          };
        }),
      });
    }

    const parsed = parseTarget(request.nextUrl.searchParams);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const media = await prisma.media.findUnique({
      where: { tmdbId: parsed.target.tmdbId },
      select: { id: true, mediaType: true },
    });
    if (!media || media.mediaType !== parsed.target.mediaType) {
      return NextResponse.json({ eligible: false, rating: null });
    }

    const rating = await prisma.userRating.findUnique({
      where: {
        userId_mediaId_subjectKey: {
          userId: user.id,
          mediaId: media.id,
          subjectKey: parsed.target.subjectKey,
        },
      },
      select: { score: true, updatedAt: true },
    });
    if (rating) {
      return NextResponse.json({ eligible: true, rating });
    }

    const eligibleMedia = await getEligibleMedia(user.id, parsed.target);

    return NextResponse.json({
      eligible: Boolean(eligibleMedia),
      rating: null,
    });
  } catch (error) {
    console.error("Error fetching user rating:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const bodyRecord = body as Record<string, unknown>;
    const parsed = parseTarget(
      new URLSearchParams({
        tmdbId: String(bodyRecord.tmdbId ?? ""),
        mediaType: String(bodyRecord.mediaType ?? ""),
        ...(bodyRecord.seasonNumber !== undefined
          ? { seasonNumber: String(bodyRecord.seasonNumber) }
          : {}),
        ...(bodyRecord.episodeNumber !== undefined
          ? { episodeNumber: String(bodyRecord.episodeNumber) }
          : {}),
      }),
    );
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const score = bodyRecord.score;
    if (
      typeof score !== "number" ||
      !Number.isFinite(score) ||
      score < 0.5 ||
      score > 10 ||
      !Number.isInteger(score * 10)
    ) {
      return NextResponse.json(
        { error: "Score must be from 0.5 to 10 in increments of 0.1" },
        { status: 400 },
      );
    }

    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const media = await getEligibleMedia(user.id, parsed.target);
    if (!media) {
      return NextResponse.json(
        { error: "Watch this title before rating it" },
        { status: 403 },
      );
    }

    const rating = await prisma.userRating.upsert({
      where: {
        userId_mediaId_subjectKey: {
          userId: user.id,
          mediaId: media.id,
          subjectKey: parsed.target.subjectKey,
        },
      },
      create: {
        userId: user.id,
        mediaId: media.id,
        subjectKey: parsed.target.subjectKey,
        seasonNumber: parsed.target.seasonNumber,
        episodeNumber: parsed.target.episodeNumber,
        score,
      },
      update: { score },
      select: { score: true, updatedAt: true },
    });

    return NextResponse.json({ rating });
  } catch (error) {
    console.error("Error saving user rating:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const parsed = parseTarget(request.nextUrl.searchParams);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const media = await prisma.media.findUnique({
      where: { tmdbId: parsed.target.tmdbId },
      select: { id: true, mediaType: true },
    });
    if (!media || media.mediaType !== parsed.target.mediaType) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }

    await prisma.userRating.deleteMany({
      where: {
        userId: user.id,
        mediaId: media.id,
        subjectKey: parsed.target.subjectKey,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing user rating:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
