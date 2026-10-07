import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getPosterUrl, getRandomBackdropUrl, getTrendingMedia, getTVSeasonDetails } from "@/lib/tmdb";

interface NextUpItem {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string;
  overview: string | null;
}

function isReleasedEpisode(
  episode:
    | {
        air_date?: string | null;
      }
    | null
    | undefined,
) {
  if (!episode?.air_date) return false;

  const airDate = new Date(episode.air_date);
  return Number.isFinite(airDate.getTime()) && airDate <= new Date();
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];

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

async function getNextUpData() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, nextUp: [] };
  }

  let dbUser = await prisma.user.findUnique({
    where: { email: user.email! },
  });

  if (!dbUser) {
    return { user, nextUp: [] };
  }

  try {
    const cachedNextUp = await prisma.nextUpCache.findMany({
      where: { userId: dbUser.id },
      orderBy: { lastWatchedAt: "desc" },
      take: 20,
    });

    if (cachedNextUp.length > 0) {
      return {
        user,
        nextUp: cachedNextUp.map((item: any) => ({
          tmdbId: item.tmdbId,
          title: item.title,
          posterPath: item.posterPath,
          seasonNumber: item.seasonNumber,
          episodeNumber: item.episodeNumber,
          episodeTitle: item.episodeTitle,
          overview: item.overview,
        })),
      };
    }
  } catch (error) {
    console.error("Error reading from cache, computing from scratch:", error);
  }

  const watchHistory = await prisma.watchHistory.findMany({
    where: {
      userId: dbUser.id,
      media: { mediaType: "tv" },
      seasonNumber: { not: null },
      episodeNumber: { not: null },
    },
    include: { media: true },
    orderBy: {
      watchedAt: "desc",
    },
    take: 500,
  });

  const latestByShow = new Map<
    number,
    {
      tmdbId: number;
      title: string;
      posterPath: string | null;
      backdropPath: string | null;
      seasonNumber: number;
      episodeNumber: number;
      watchedAt: Date;
    }
  >();

  for (const item of watchHistory) {
    const current = latestByShow.get(item.media.tmdbId);
    const isLater =
      !current ||
      item.seasonNumber! > current.seasonNumber ||
      (item.seasonNumber === current.seasonNumber &&
        item.episodeNumber! > current.episodeNumber);

    if (isLater) {
      latestByShow.set(item.media.tmdbId, {
        tmdbId: item.media.tmdbId,
        title: item.media.title,
        posterPath: item.media.posterPath,
        backdropPath: item.media.backdropPath,
        seasonNumber: item.seasonNumber!,
        episodeNumber: item.episodeNumber!,
        watchedAt: item.watchedAt,
      });
    }
  }

  const seasonDetailCache = new Map<string, any>();
  const getCachedSeasonDetails = async (
    tmdbId: number,
    seasonNumber: number,
  ) => {
    const key = `${tmdbId}:${seasonNumber}`;
    if (seasonDetailCache.has(key)) {
      return seasonDetailCache.get(key);
    }

    const seasonDetails = await getTVSeasonDetails(tmdbId, seasonNumber);
    seasonDetailCache.set(key, seasonDetails ?? null);
    return seasonDetails ?? null;
  };

  const sortedShows = [...latestByShow.values()].sort(
    (a, b) => b.watchedAt.getTime() - a.watchedAt.getTime(),
  );

  const computedShows = await mapWithConcurrency(
    sortedShows,
    3,
    async (show) => {
      const currentSeason = show.seasonNumber;
      const currentEpisode = show.episodeNumber;

      const currentSeasonDetails = await getCachedSeasonDetails(
        show.tmdbId,
        currentSeason,
      );

      const nextEpisodeInCurrentSeason = currentSeasonDetails?.episodes
        ?.filter(
          (episode: { episode_number?: number; air_date?: string | null }) =>
            Number(episode.episode_number) > currentEpisode &&
            isReleasedEpisode(episode),
        )
        .sort(
          (a: { episode_number?: number }, b: { episode_number?: number }) =>
            Number(a.episode_number ?? 0) - Number(b.episode_number ?? 0),
        )[0];

      if (nextEpisodeInCurrentSeason) {
        return {
          tmdbId: show.tmdbId,
          title: show.title,
          posterPath: show.posterPath,
          backdropPath: show.backdropPath,
          seasonNumber: currentSeason,
          episodeNumber: Number(nextEpisodeInCurrentSeason.episode_number),
          episodeTitle:
            nextEpisodeInCurrentSeason.name ||
            `Episode ${Number(nextEpisodeInCurrentSeason.episode_number)}`,
          overview: nextEpisodeInCurrentSeason.overview || null,
        };
      }

      const nextSeasonDetails = await getCachedSeasonDetails(
        show.tmdbId,
        currentSeason + 1,
      );
      const firstReleasedEpisodeNextSeason = nextSeasonDetails?.episodes
        ?.filter(
          (episode: { episode_number?: number; air_date?: string | null }) =>
            Number(episode.episode_number) >= 1 && isReleasedEpisode(episode),
        )
        .sort(
          (a: { episode_number?: number }, b: { episode_number?: number }) =>
            Number(a.episode_number ?? 0) - Number(b.episode_number ?? 0),
        )[0];

      if (!firstReleasedEpisodeNextSeason) return null;

      return {
        tmdbId: show.tmdbId,
        title: show.title,
        posterPath: show.posterPath,
        backdropPath: show.backdropPath,
        seasonNumber: currentSeason + 1,
        episodeNumber: Number(firstReleasedEpisodeNextSeason.episode_number),
        episodeTitle:
          firstReleasedEpisodeNextSeason.name ||
          `Episode ${Number(firstReleasedEpisodeNextSeason.episode_number)}`,
        overview: firstReleasedEpisodeNextSeason.overview || null,
      };
    },
  );

  const nextUp = computedShows.filter(Boolean).slice(0, 20) as NextUpItem[];

  return { user, nextUp };
}

export default async function NextUpPage() {
  const { user, nextUp } = await getNextUpData();
  const trendingMedia = await getTrendingMedia();
  const pageBackdrop = getRandomBackdropUrl(trendingMedia);

  if (!user) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-black">
        <div className="text-zinc-400">Redirecting to auth...</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-black text-white overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-black/75 via-black/45 to-black/85">
        {pageBackdrop && (
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-35"
            style={{ backgroundImage: `url(${pageBackdrop})` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/55 to-black/80" />
      </div>

      <main className="relative z-10 mx-auto w-full max-w-[1650px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-violet-400/80">
              continue watching
            </p>
            <h1 className="text-3xl font-bold text-white md:text-4xl">
              Next up
            </h1>
          </div>

          <Link
            href="/"
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20"
          >
            Back home
          </Link>
        </div>

        {nextUp.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/60 p-12 text-center">
            <h2 className="text-2xl font-semibold text-white">
              Nothing queued yet
            </h2>
            <p className="mt-3 text-zinc-400">
              Watch a few more episodes and your next shows will show up here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
            {nextUp.map((item: NextUpItem) => (
              <Link
                key={`${item.tmdbId}-${item.seasonNumber}-${item.episodeNumber}`}
                href={`/media/${item.tmdbId}/season/${item.seasonNumber}/episode/${item.episodeNumber}?type=tv`}
                className="group w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/80 transition hover:-translate-y-0.5 hover:border-violet-500/50"
              >
                <div className="relative aspect-[2/3] overflow-hidden">
                  <Image
                    src={getPosterUrl(item.posterPath || null)}
                    alt={item.episodeTitle}
                    fill
                    sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 20vw, (max-width: 1280px) 16vw, 14vw"
                    className="object-cover transition duration-300 group-hover:scale-105"
                  />
                </div>

                <div className="space-y-1 border-t border-zinc-800 px-2 py-2">
                  <div className="text-[10px] font-medium uppercase text-violet-300">
                    S{item.seasonNumber} E{item.episodeNumber}
                  </div>
                  <div className="line-clamp-2 text-xs font-semibold text-white">
                    {item.title}
                  </div>
                  <div className="line-clamp-1 text-[10px] text-zinc-400">
                    {item.episodeTitle}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
