import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import {
  getJellyfinCurrentSession,
  getJellyfinTmdbId,
  getJellyfinMediaType,
} from "@/lib/jellyfin";
import { getMediaDetails, getPosterUrl, searchMedia } from "@/lib/tmdb";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email! },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const config = await prisma.jellyfinConnection.findUnique({
      where: { userId: dbUser.id },
    });

    if (!config || !config.enabled) {
      return NextResponse.json({ active: null }, { status: 200 });
    }

    const session = await getJellyfinCurrentSession({
      serverUrl: config.serverUrl,
      apiKey: config.apiKey,
      jellyfinUserId: config.jellyfinUserId,
      enabled: config.enabled,
    }).catch(() => null);

    if (!session || !session.NowPlayingItem) {
      return NextResponse.json({ active: null }, { status: 200 });
    }

    const item = session.NowPlayingItem;
    const mediaType = getJellyfinMediaType(item);
    const runtimeTicks = Number(item.RunTimeTicks || 0);
    const positionTicks = Number(session.PlayState?.PositionTicks || 0);
    const percent = runtimeTicks > 0 ? (positionTicks / runtimeTicks) * 100 : 0;
    const normalizedPercent = Number.isFinite(percent)
      ? Math.max(0, Math.min(100, percent))
      : 0;
    const runtimeMinutes = runtimeTicks > 0 ? runtimeTicks / 600000000 : 0;
    const positionMinutes = positionTicks > 0 ? positionTicks / 600000000 : 0;
    const remainingMinutes = Math.max(
      0,
      Math.ceil(runtimeMinutes - positionMinutes),
    );
    const seasonNumber =
      Number(
        item.ParentIndexNumber ?? item.SeasonNumber ?? item.seasonNumber ?? 0,
      ) || null;
    const episodeNumber =
      Number(
        item.IndexNumber ?? item.EpisodeNumber ?? item.episodeNumber ?? 0,
      ) || null;
    const episodeLabel =
      seasonNumber !== null && episodeNumber !== null
        ? `S${String(seasonNumber).padStart(2, "0")}E${String(episodeNumber).padStart(2, "0")}`
        : null;
    const itemId = item.Id ?? item.id;
    const seriesId = item.SeriesId ?? item.seriesId ?? item.Series?.Id ?? null;
    const itemPosterTag =
      item.ImageTags?.Primary ||
      item.ImageTags?.primary ||
      item.PrimaryImageTag ||
      item.AlbumPrimaryImageTag ||
      item.ImageTags?.AlbumPrimary;
    const seriesPosterTag =
      item.SeriesPrimaryImageTag ||
      item.ImageTags?.SeriesPrimary ||
      item.ImageTags?.Primary ||
      item.PrimaryImageTag ||
      item.Series?.PrimaryImageTag ||
      null;

    let posterUrl = "/placeholder-poster.svg";
    let tmdbId: number | null = null;

    if (mediaType === "tv") {
      tmdbId = getJellyfinTmdbId(item);

      if (!tmdbId) {
        const searchTitle =
          item.SeriesName ||
          item.Name ||
          item.OriginalTitle ||
          item.Title ||
          "";
        if (searchTitle) {
          try {
            const matches = await searchMedia(searchTitle);
            const tvMatch = matches.find(
              (result) =>
                result.media_type === "tv" || result.media_type === undefined,
            );
            if (tvMatch) {
              tmdbId = Number(tvMatch.id);
            }
          } catch (error) {
            console.error("Error searching TMDB for series poster:", error);
          }
        }
      }

      if (tmdbId) {
        try {
          const mediaDetails = await getMediaDetails(tmdbId, "tv");
          if (mediaDetails?.poster_path) {
            posterUrl = getPosterUrl(mediaDetails.poster_path);
          }
        } catch (error) {
          console.error("Error fetching TMDB TV poster:", error);
        }
      }

      if (posterUrl === "/placeholder-poster.svg" && seriesId) {
        const imageUrl = `${config.serverUrl}/Items/${seriesId}/Images/Primary?maxHeight=500&maxWidth=400&quality=90${seriesPosterTag ? `&tag=${encodeURIComponent(seriesPosterTag)}` : ""}&api_key=${encodeURIComponent(config.apiKey)}`;
        posterUrl = imageUrl;
      }

      if (posterUrl === "/placeholder-poster.svg" && itemId && itemPosterTag) {
        posterUrl = `${config.serverUrl}/Items/${itemId}/Images/Primary?maxHeight=500&maxWidth=400&quality=90&tag=${encodeURIComponent(itemPosterTag)}&api_key=${encodeURIComponent(config.apiKey)}`;
      }
    } else {
      tmdbId = getJellyfinTmdbId(item);
      if (tmdbId) {
        try {
          const mediaDetails = await getMediaDetails(tmdbId, "movie");
          if (mediaDetails?.poster_path) {
            posterUrl = getPosterUrl(mediaDetails.poster_path);
          }
        } catch (error) {
          console.error("Error fetching TMDB movie poster:", error);
        }
      }

      if (posterUrl === "/placeholder-poster.svg" && itemId && itemPosterTag) {
        posterUrl = `${config.serverUrl}/Items/${itemId}/Images/Primary?maxHeight=500&maxWidth=400&quality=90&tag=${encodeURIComponent(itemPosterTag)}&api_key=${encodeURIComponent(config.apiKey)}`;
      }
    }

    const completed = normalizedPercent >= 80;

    let title = item.Name || item.OriginalTitle || item.Title || "Unknown";
    let seriesName = item.SeriesName || null;
    let episodeName = item.Name || null;
    if (mediaType === "tv" && item.SeriesName && item.Name) {
      title = `${item.SeriesName} • ${item.Name}`;
    }

    return NextResponse.json({
      active: {
        title,
        seriesName,
        episodeName,
        type: item.Type || "media",
        mediaType,
        tmdbId,
        percent: normalizedPercent,
        completed,
        runtimeMinutes: Number.isFinite(runtimeMinutes)
          ? Math.max(1, Math.round(runtimeMinutes))
          : 0,
        remainingMinutes,
        posterUrl,
        episodeLabel,
        seasonNumber,
        episodeNumber,
      },
    });
  } catch (error) {
    console.error("Error fetching Jellyfin live session:", error);
    return NextResponse.json({ active: null }, { status: 200 });
  }
}
