import MediaDetailClient from "@/components/media-detail-client";
import { getOrCreateDbUser, getServerUserFast } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import type { InitialRating } from "@/lib/use-initial-rating";

interface MediaPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}

export default async function MediaPage({
  params,
  searchParams,
}: MediaPageProps) {
  const { id } = await params;
  const { type } = await searchParams;
  const mediaType = type === "tv" ? "tv" : "movie";
  const tmdbId = Number(id);

  let initialWatchHistory: any[] = [];
  let initialRating: InitialRating | undefined;

  if (Number.isSafeInteger(tmdbId) && tmdbId > 0) {
    const user = await getServerUserFast();
    const dbUser = user ? await getOrCreateDbUser(user) : null;

    if (dbUser) {
      const media = await prisma.media.findUnique({
        where: { tmdbId },
        select: { id: true, mediaType: true },
      });

      if (media && media.mediaType === mediaType) {
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
                subjectKey: "media",
              },
            },
            select: { score: true, updatedAt: true },
          }),
        ]);

        initialWatchHistory = watchHistory;

        const hasSeriesWatch = watchHistory.some(
          (entry) =>
            entry.seasonNumber !== null && entry.episodeNumber !== null,
        );
        const hasMovieWatch = watchHistory.some(
          (entry) =>
            entry.seasonNumber === null && entry.episodeNumber === null,
        );
        const eligible =
          Boolean(rating) ||
          (mediaType === "tv" ? hasSeriesWatch : hasMovieWatch);

        initialRating = {
          key: new URLSearchParams({
            tmdbId: String(tmdbId),
            mediaType,
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
    <MediaDetailClient
      initialWatchHistory={initialWatchHistory}
      initialRating={initialRating}
    />
  );
}
