import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import JSZip from "jszip";

type WatchedShowExport = {
  last_updated_at: string;
  last_watched_at: string;
  show: {
    ids: { tmdb: number };
    title: string;
    year: number | null;
  };
  plays: number;
  total_count: number;
};

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email! },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const [watchHistory, ratings] = await Promise.all([
      prisma.watchHistory.findMany({
        where: { userId: dbUser.id },
        include: {
          media: true,
        },
        orderBy: { watchedAt: "desc" },
      }),
      prisma.userRating.findMany({
        where: { userId: dbUser.id },
        include: {
          media: true,
        },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    const zip = new JSZip();

    const watchedHistory = watchHistory.map((watch) => {
      const baseEntry = {
        id: parseInt(watch.id.replace(/[^0-9]/g, '').substring(0, 10)),
        watched_at: watch.watchedAt.toISOString(),
        action: "scrobble",
      };

      if (watch.media.mediaType === "movie") {
        return {
          ...baseEntry,
          type: "movie",
          movie: {
            ids: {
              tmdb: watch.media.tmdbId,
            },
            title: watch.media.title,
            year: watch.media.releaseDate?.getFullYear() || null,
          },
        };
      } else {
        return {
          ...baseEntry,
          type: "episode",
          episode: {
            ids: {
              tmdb: watch.media.tmdbId,
            },
            title: watch.media.title,
            number: watch.episodeNumber || 0,
            season: watch.seasonNumber || 0,
          },
          show: {
            ids: {
              tmdb: watch.media.tmdbId,
            },
            title: watch.media.title,
            year: watch.media.releaseDate?.getFullYear() || null,
          },
        };
      }
    });

    const chunkSize = 1000;
    const chunks = [];
    for (let i = 0; i < watchedHistory.length; i += chunkSize) {
      chunks.push(watchedHistory.slice(i, i + chunkSize));
    }

    chunks.forEach((chunk, index) => {
      zip.file(`watched-history-${index + 1}.json`, JSON.stringify(chunk, null, 2));
    });

    const watchedMovies = watchHistory
      .filter((watch) => watch.media.mediaType === "movie")
      .map((watch) => ({
        last_updated_at: watch.updatedAt.toISOString(),
        last_watched_at: watch.watchedAt.toISOString(),
        movie: {
          ids: { tmdb: watch.media.tmdbId },
          title: watch.media.title,
          year: watch.media.releaseDate?.getFullYear() || null,
        },
        plays: 1,
        total_count: 1,
      }));

    const watchedShows = watchHistory
      .filter((watch) => watch.media.mediaType === "tv")
      .reduce((acc, watch) => {
        const existingShow = acc.find(
          (item) => item.show.ids.tmdb === watch.media.tmdbId
        );
        if (existingShow) {
          existingShow.plays += 1;
          existingShow.last_watched_at = watch.watchedAt.toISOString();
          existingShow.last_updated_at = watch.updatedAt.toISOString();
        } else {
          acc.push({
            last_updated_at: watch.updatedAt.toISOString(),
            last_watched_at: watch.watchedAt.toISOString(),
            show: {
              ids: { tmdb: watch.media.tmdbId },
              title: watch.media.title,
              year: watch.media.releaseDate?.getFullYear() || null,
            },
            plays: 1,
            total_count: 1,
          });
        }
        return acc;
      }, [] as WatchedShowExport[]);

    zip.file("watched-movies.json", JSON.stringify(watchedMovies, null, 2));
    zip.file("watched-shows.json", JSON.stringify(watchedShows, null, 2));

    const toTraktRatingEntry = (rating: (typeof ratings)[number]) => {
      const baseEntry = {
        rated_at: rating.updatedAt.toISOString(),
        rating: rating.score,
      };
      const mediaEntry = {
        ids: { tmdb: rating.media.tmdbId },
        title: rating.media.title,
        year: rating.media.releaseDate?.getFullYear() || null,
      };

      if (rating.media.mediaType === "movie") {
        return { ...baseEntry, movie: mediaEntry };
      }
      if (rating.seasonNumber !== null && rating.episodeNumber !== null) {
        return {
          ...baseEntry,
          episode: {
            season: rating.seasonNumber,
            number: rating.episodeNumber,
          },
          show: mediaEntry,
        };
      }
      if (rating.seasonNumber !== null) {
        return {
          ...baseEntry,
          season: { number: rating.seasonNumber },
          show: mediaEntry,
        };
      }
      return { ...baseEntry, show: mediaEntry };
    };

    zip.file(
      "ratings-movies.json",
      JSON.stringify(
        ratings
          .filter((rating) => rating.media.mediaType === "movie")
          .map(toTraktRatingEntry),
        null,
        2,
      ),
    );
    zip.file(
      "ratings-shows.json",
      JSON.stringify(
        ratings
          .filter(
            (rating) =>
              rating.media.mediaType === "tv" &&
              rating.seasonNumber === null &&
              rating.episodeNumber === null,
          )
          .map(toTraktRatingEntry),
        null,
        2,
      ),
    );
    zip.file(
      "ratings-episodes.json",
      JSON.stringify(
        ratings
          .filter(
            (rating) =>
              rating.media.mediaType === "tv" &&
              rating.seasonNumber !== null &&
              rating.episodeNumber !== null,
          )
          .map(toTraktRatingEntry),
        null,
        2,
      ),
    );
    zip.file(
      "ratings-seasons.json",
      JSON.stringify(
        ratings
          .filter(
            (rating) =>
              rating.media.mediaType === "tv" &&
              rating.seasonNumber !== null &&
              rating.episodeNumber === null,
          )
          .map(toTraktRatingEntry),
        null,
        2,
      ),
    );

    const emptyFiles = [
      "user-settings.json",
      "user-profile.json",
      "user-last-activities.json",
      "user-stats.json",
      "hidden-calendar.json",
      "hidden-progress-watched.json",
      "hidden-progress-watched-reset.json",
      "hidden-progress-collected.json",
      "hidden-recommendations.json",
      "network-followers-requests.json",
      "network-followers.json",
      "network-following.json",
      "network-friends.json",
      "likes-comments.json",
      "likes-lists.json",
      "comments-movies.json",
      "comments-shows.json",
      "comments-seasons.json",
      "comments-episodes.json",
      "comments-lists.json",
      "notes-movies.json",
      "notes-shows.json",
      "notes-seasons.json",
      "notes-episodes.json",
      "notes-people.json",
      "notes-activities.json",
      "notes-collection_items.json",
      "notes-ratings.json",
      "watched-playback.json",
      "collection-movies.json",
      "collection-shows.json",
      "collection-episodes.json",
      "lists-watchlist.json",
      "lists-favorites.json",
      "lists-collaborations.json",
      "lists-lists.json",
    ];

    emptyFiles.forEach((fileName) => {
      zip.file(fileName, "[]");
    });

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    return new NextResponse(Buffer.from(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": "attachment; filename=trakt-export.zip",
      },
    });
  } catch (error) {
    console.error("Error exporting data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
