import { prisma } from "@/lib/prisma";
import { searchMedia, getMediaDetails } from "@/lib/tmdb";

export const JELLYFIN_CLIENT_AUTH =
  'MediaBrowser Client="Trakt Lite", Device="Trakt Lite", DeviceId="TraktExportScript", Version="1.0.0"';

export type JellyfinConfig = {
  serverUrl: string;
  username: string;
  password: string;
  jellyfinUserId?: string | null;
  enabled?: boolean;
  accessToken?: string;
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

export async function authenticateJellyfin(
  serverUrl: string,
  username: string,
  password: string,
): Promise<{ userId: string; accessToken: string }> {
  const url = `${normalizeServerUrl(serverUrl)}/Users/AuthenticateByName`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": JELLYFIN_CLIENT_AUTH,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      Username: username,
      Pw: password || "",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Jellyfin authentication failed");
  }

  const data = await response.json();
  return {
    userId: data.User.Id,
    accessToken: data.AccessToken,
  };
}

export function buildJellyfinHeaders(accessToken: string) {
  return {
    "Content-Type": "application/json",
    "Authorization": `${JELLYFIN_CLIENT_AUTH}, Token="${accessToken}"`,
    "X-Emby-Token": accessToken,
    "Accept": "application/json",
  };
}

export async function jellyfinRequest<T>(
  config: JellyfinConfig,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const serverUrl = normalizeServerUrl(config.serverUrl);
  const username = config.username?.trim();
  const password = config.password;

  if (!serverUrl || !username) {
    throw new Error("Jellyfin server URL and username are required.");
  }

  // Authenticate if we don't have an access token
  let accessToken = config.accessToken;
  if (!accessToken) {
    const auth = await authenticateJellyfin(serverUrl, username, password);
    accessToken = auth.accessToken;
  }

  const url = new URL(
    path.startsWith("/") ? path : `/${path}`,
    `${serverUrl}/`,
  );
  const response = await fetch(url, {
    ...init,
    headers: {
      ...buildJellyfinHeaders(accessToken),
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
  try {
    const auth = await authenticateJellyfin(
      config.serverUrl,
      config.username,
      config.password,
    );
    return Boolean(auth.accessToken);
  } catch {
    return false;
  }
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

  const mediaType = getJellyfinMediaType(item);
  const title =
    mediaType === "tv"
      ? item?.SeriesName ||
        item?.Name ||
        item?.OriginalTitle ||
        item?.Title ||
        ""
      : item?.Name ||
        item?.OriginalTitle ||
        item?.SeriesName ||
        item?.Title ||
        "";

  if (!title) return null;

  const results = await searchMedia(title);
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
  const mediaType = getJellyfinMediaType(item);
  
  // For TV shows, use SeriesName instead of episode Name
  if (mediaType === "tv") {
    return item?.SeriesName || item?.Name || item?.OriginalTitle || item?.Title || "Unknown title";
  }
  
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
  const mediaType = getJellyfinMediaType(item);
  const title = getJellyfinTitle(item);

  const tmdbId = await resolveJellyfinTmdbId(item);

  if (!tmdbId) {
    return {
      created: false,
      reason: "missing_tmdb_id",
      existingEntryId: undefined,
    };
  }
  const parentIndexNumber = toNumber(
    item?.ParentIndexNumber ?? item?.SeasonNumber,
  );
  const episodeNumber = toNumber(item?.IndexNumber ?? item?.EpisodeNumber);
  const seasonNumber =
    parentIndexNumber ?? toNumber(item?.SeasonIndex ?? item?.SeasonNumber);
  
  const episodeName = mediaType === "tv"
    ? (item?.Name || item?.OriginalTitle || item?.Title || null)
    : null;

  let tmdbPosterPath = null;
  try {
    const mediaDetails = await getMediaDetails(tmdbId, mediaType);
    if (mediaDetails?.poster_path) {
      tmdbPosterPath = mediaDetails.poster_path;
    }
  } catch (error) {
    console.error("Error fetching TMDB poster for history:", error);
  }

  const media = await prisma.media.upsert({
    where: { tmdbId },
    update: {
      title,
      mediaType,
      posterPath: tmdbPosterPath || (item?.ImageTags?.Primary ? `${item.ImageTags.Primary}` : null),
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
      posterPath: tmdbPosterPath || (item?.ImageTags?.Primary ? `${item.ImageTags.Primary}` : null),
      backdropPath: null,
      overview: item?.Overview || item?.ProviderIds?.Overview || null,
      releaseDate: item?.ProductionYear
        ? new Date(`${item.ProductionYear}-01-01T00:00:00.000Z`)
        : null,
      voteAverage: 0,
      genreIds: [],
    },
  });

  return prisma.$transaction(async (transaction) => {
    const lockKey = [
      userId,
      media.id,
      seasonNumber ?? "",
      episodeNumber ?? "",
    ].join(":");
    await transaction.$queryRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))::text
    `;

    const existingEntry = await transaction.watchHistory.findFirst({
      where: {
        userId,
        mediaId: media.id,
        seasonNumber: seasonNumber ?? null,
        episodeNumber: episodeNumber ?? null,
      },
      orderBy: {
        watchedAt: "desc",
      },
    });

    if (existingEntry) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (existingEntry.watchedAt >= oneDayAgo) {
        return {
          created: false,
          reason: "duplicate_within_24_hours",
          existingEntryId: existingEntry.id,
        };
      }

    }

    const createdEntry = await transaction.watchHistory.create({
      data: {
        userId,
        mediaId: media.id,
        seasonNumber: seasonNumber ?? null,
        episodeNumber: episodeNumber ?? null,
        episodeName,
        watchedAt,
      },
    });

    return {
      created: true,
      entryId: createdEntry.id,
      source: source || "jellyfin",
    };
  });
}
