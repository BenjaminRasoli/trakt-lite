import { prisma } from "@/lib/prisma";
import { searchMedia } from "@/lib/tmdb";

export type JellyfinConfig = {
  serverUrl: string;
  apiKey: string;
  jellyfinUserId?: string | null;
  enabled?: boolean;
};

function normalizeServerUrl(serverUrl: string) {
  return serverUrl.trim().replace(/\/+$/, "");
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function buildJellyfinHeaders(apiKey: string) {
  return {
    "Content-Type": "application/json",
    "X-Emby-Token": apiKey,
    "X-Emby-Authorization": `MediaBrowser Token="${apiKey}"`,
    Authorization: `MediaBrowser Token="${apiKey}"`,
  };
}

export async function jellyfinRequest<T>(
  config: JellyfinConfig,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const serverUrl = normalizeServerUrl(config.serverUrl);
  const apiKey = config.apiKey.trim();

  if (!serverUrl || !apiKey) {
    throw new Error("Jellyfin server URL and API key are required.");
  }

  const url = new URL(
    path.startsWith("/") ? path : `/${path}`,
    `${serverUrl}/`,
  );
  const response = await fetch(url, {
    ...init,
    headers: {
      ...buildJellyfinHeaders(apiKey),
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      text || `Jellyfin request failed with status ${response.status}`,
    );
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  return (await response.text()) as unknown as T;
}

export async function validateJellyfinConnection(config: JellyfinConfig) {
  const info = await jellyfinRequest<{ ServerName?: string }>(
    config,
    "/System/Info",
  );
  return Boolean(info?.ServerName);
}

export function getJellyfinMediaType(
  item: Record<string, any>,
): "movie" | "tv" {
  const type = String(item?.Type || item?.MediaType || "").toLowerCase();

  if (type === "movie") return "movie";
  if (type === "series" || type === "episode" || type === "tv") return "tv";

  return "movie";
}

export function getJellyfinTmdbId(item: Record<string, any>): number | null {
  const providerIds = item?.ProviderIds || {};
  const candidates = [
    providerIds.Tmdb,
    providerIds.tmdb,
    item?.ProviderIds?.TMDb,
    item?.TmdbId,
    item?.tmdbId,
    item?.Id,
  ];

  for (const candidate of candidates) {
    const value = toNumber(candidate);
    if (value) {
      return value;
    }
  }

  return null;
}

export async function resolveJellyfinTmdbId(
  item: Record<string, any>,
): Promise<number | null> {
  const direct = getJellyfinTmdbId(item);
  if (direct) return direct;

  const title =
    item?.Name || item?.OriginalTitle || item?.SeriesName || item?.Title || "";

  if (!title) return null;

  const results = await searchMedia(title);
  const mediaType = getJellyfinMediaType(item);
  const productionYear = Number(
    item?.ProductionYear ||
      item?.Year ||
      new Date(
        item?.PremiereDate || item?.ProviderIds?.PremiereDate || "",
      ).getFullYear() ||
      0,
  );

  const bestMatch = results.find((result) => {
    if (!result) return false;

    const resultType = result.media_type === "movie" ? "movie" : "tv";
    if (resultType !== mediaType) return false;

    if (!productionYear) return true;

    const resultYear = Number(
      result.release_date?.slice(0, 4) ||
        result.first_air_date?.slice(0, 4) ||
        0,
    );

    return Math.abs(resultYear - productionYear) <= 2;
  });

  return bestMatch ? Number(bestMatch.id) : null;
}

export function getJellyfinTitle(item: Record<string, any>) {
  return item?.Name || item?.OriginalTitle || item?.Title || "Unknown title";
}

export function getJellyfinPlaybackCompletion(
  item: Record<string, any>,
  payload?: Record<string, any>,
) {
  const playState =
    payload?.PlayState || item?.UserData?.PlayState || item?.PlayState || {};
  const positionTicks = Number(
    playState.PositionTicks || payload?.PositionTicks || 0,
  );
  const runtimeTicks = Number(item?.RunTimeTicks || item?.RuntimeTicks || 0);

  if (!runtimeTicks || !positionTicks) {
    return 0;
  }

  return Math.min(1, positionTicks / runtimeTicks);
}

export async function getJellyfinCurrentSession(config: JellyfinConfig) {
  const sessions = await jellyfinRequest<Array<Record<string, any>>>(
    config,
    "/Sessions",
  );

  if (!sessions || sessions.length === 0) {
    return null;
  }

  const filterByUser = config.jellyfinUserId
    ? sessions.filter((session) => session.UserId === config.jellyfinUserId)
    : sessions;

  const activeSession =
    filterByUser.find((session) => session.NowPlayingItem) ?? filterByUser[0];

  return activeSession?.NowPlayingItem ? activeSession : null;
}

export async function upsertJellyfinWatchEntry({
  userId,
  item,
  watchedAt,
  source,
}: {
  userId: string;
  item: Record<string, any>;
  watchedAt: Date;
  source?: string;
}) {
  const tmdbId = await resolveJellyfinTmdbId(item);

  if (!tmdbId) {
    return { created: false, reason: "missing_tmdb_id" };
  }

  const mediaType = getJellyfinMediaType(item);
  const title = getJellyfinTitle(item);
  const parentIndexNumber = toNumber(
    item?.ParentIndexNumber ?? item?.SeasonNumber,
  );
  const episodeNumber = toNumber(item?.IndexNumber ?? item?.EpisodeNumber);
  const seasonNumber =
    parentIndexNumber ?? toNumber(item?.SeasonIndex ?? item?.SeasonNumber);

  const media = await prisma.media.upsert({
    where: { tmdbId },
    update: {
      title,
      mediaType,
      posterPath: item?.ImageTags?.Primary ? `${item.ImageTags.Primary}` : null,
      backdropPath: null,
      overview: item?.Overview || item?.ProviderIds?.Overview || null,
      releaseDate: item?.ProductionYear
        ? new Date(`${item.ProductionYear}-01-01T00:00:00.000Z`)
        : null,
      voteAverage: 0,
    },
    create: {
      tmdbId,
      title,
      mediaType,
      posterPath: item?.ImageTags?.Primary ? `${item.ImageTags.Primary}` : null,
      backdropPath: null,
      overview: item?.Overview || item?.ProviderIds?.Overview || null,
      releaseDate: item?.ProductionYear
        ? new Date(`${item.ProductionYear}-01-01T00:00:00.000Z`)
        : null,
      voteAverage: 0,
      genreIds: [],
    },
  });

  const startOfWindow = new Date(watchedAt.getTime() - 1000 * 60 * 30);
  const existing = await prisma.watchHistory.findFirst({
    where: {
      userId,
      mediaId: media.id,
      seasonNumber: seasonNumber ?? null,
      episodeNumber: episodeNumber ?? null,
      watchedAt: {
        gte: startOfWindow,
      },
    },
    orderBy: { watchedAt: "desc" },
  });

  if (existing) {
    return { created: false, reason: "duplicate_recent_entry" };
  }

  const createdEntry = await prisma.watchHistory.create({
    data: {
      userId,
      mediaId: media.id,
      seasonNumber: seasonNumber ?? null,
      episodeNumber: episodeNumber ?? null,
      watchedAt,
    },
  });

  return {
    created: true,
    entryId: createdEntry.id,
    source: source || "jellyfin",
  };
}
