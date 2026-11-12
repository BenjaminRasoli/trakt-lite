import SeasonDetailClient from "@/components/season-detail-client";
import { getOrCreateDbUser, getServerUserFast } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import type { InitialRating } from "@/lib/use-initial-rating";

interface SeasonPageProps {
  params: Promise<{ id: string; season: string }>;
  searchParams?: Promise<{ type?: string }>;
}

export default async function SeasonPage({
  params,
}: SeasonPageProps) {
  const { id, season } = await params;
  const tmdbId = Number(id);
  const seasonNumber = Number(season);

  let initialWatchHistory: any[] = [];
  let initialRating: InitialRating | undefined;

  if (
    Number.isSafeInteger(tmdbId) &&
    tmdbId > 0 &&
    Number.isSafeInteger(seasonNumber) &&
    seasonNumber > 0
  ) {
    const user = await getServerUserFast();
    const dbUser = user ? await getOrCreateDbUser(user) : null;

    if (dbUser) {
      const media = await prisma.media.findUnique({
        where: { tmdbId },
        select: { id: true, mediaType: true },
      });

      if (media && media.mediaType === "tv") {
        const [watchHistory, rating] = await Promise.all([
          prisma.watchHistory.findMany({
            where: { userId: dbUser.id, mediaId: media.id },
            orderBy: { watchedAt: "desc" },
            select: {
              id: true,
              seasonNumber: true,
              episodeNumber: true,
              episodeName: true,
              watchedAt: true,
            },
          }),
          prisma.userRating.findUnique({
            where: {
              userId_mediaId_subjectKey: {
                userId: dbUser.id,
                mediaId: media.id,
                subjectKey: `season:${seasonNumber}`,
              },
            },
            select: { score: true, updatedAt: true },
          }),
        ]);

        initialWatchHistory = watchHistory;

        const eligible =
          Boolean(rating) ||
          watchHistory.some(
            (entry) =>
              entry.seasonNumber === seasonNumber &&
              entry.episodeNumber !== null,
          );

        initialRating = {
          key: new URLSearchParams({
            tmdbId: String(tmdbId),
            mediaType: "tv",
            seasonNumber: String(seasonNumber),
          }).toString(),
          eligible,
          rating: rating
            ? {
                score: rating.score,
                updatedAt: rating.updatedAt.toISOString(),
              }
            : null,
        };
      }
    }
  }

  return (
    <SeasonDetailClient
      initialWatchHistory={initialWatchHistory}
      initialRating={initialRating}
    />
  );
}
