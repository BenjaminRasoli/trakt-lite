import EpisodeDetailClient from "@/components/episode-detail-client";
import { getOrCreateDbUser, getServerUserFast } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import type { InitialRating } from "@/lib/use-initial-rating";

interface EpisodePageProps {
  params: Promise<{ id: string; season: string; episode: string }>;
  searchParams?: Promise<{ type?: string }>;
}

export default async function EpisodePage({
  params,
}: EpisodePageProps) {
  const { id, season, episode } = await params;
  const tmdbId = Number(id);
  const seasonNumber = Number(season);
  const episodeNumber = Number(episode);

  let initialWatchHistory: any[] = [];
  let initialRating: InitialRating | undefined;

  if (
    Number.isSafeInteger(tmdbId) &&
    tmdbId > 0 &&
    Number.isSafeInteger(seasonNumber) &&
    seasonNumber > 0 &&
    Number.isSafeInteger(episodeNumber) &&
    episodeNumber > 0
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
                subjectKey: `episode:${seasonNumber}:${episodeNumber}`,
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
              entry.episodeNumber === episodeNumber,
          );

        initialRating = {
          key: new URLSearchParams({
            tmdbId: String(tmdbId),
            mediaType: "tv",
            seasonNumber: String(seasonNumber),
            episodeNumber: String(episodeNumber),
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
    <EpisodeDetailClient
      initialWatchHistory={initialWatchHistory}
      initialRating={initialRating}
    />
  );
}
