import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  authenticateJellyfin,
  jellyfinRequest,
  upsertJellyfinWatchEntry,
} from "@/lib/jellyfin";
import crypto from "crypto";

interface JellyfinWebhookItem extends Record<string, unknown> {
  Id?: string;
  UserData?: {
    Played?: boolean;
    PlayCount?: number;
    LastPlayedDate?: string | null;
    DatePlayed?: string | null;
  };
  ProviderIds?: Record<string, unknown>;
}

function generateIdempotencyKey(itemId: string, userId: string, timestamp: string): string {
  const key = `jellyfin:${itemId}:${userId}:${timestamp}`;
  return crypto.createHash("sha256").update(key).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const eventName = String(
      body?.NotificationType || body?.EventName || body?.eventName || "",
    ).toLowerCase();

    const item = body?.Item || body?.item || body?.NowPlayingItem || body;

    if (eventName.includes("userdatasaved")) {
      if (!item?.Id && item?.ItemId) {
        item.Id = item.ItemId;
      }

      if (!item?.Type && item?.ItemType) {
        item.Type = item.ItemType;
      }

      if (!item?.ProviderIds) {
        item.ProviderIds = {};
        Object.keys(item).forEach(key => {
          if (key.startsWith('Provider_')) {
            const providerName = key.replace('Provider_', '').toLowerCase();
            item.ProviderIds[providerName] = item[key];
          }
        });
      }
    }

    if (!item || !eventName) {
      return NextResponse.json({ ok: false, skipped: true }, { status: 200 });
    }

    if (!eventName.includes("userdatasaved")) {
      return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
    }

    const saveReason = String(body?.SaveReason || "").toLowerCase();
    if (saveReason === "playbackprogress") {
      return NextResponse.json({ ok: true, skipped: true, reason: "playback_progress_only" }, { status: 200 });
    }

    const jellyfinUserId = String(
      body?.UserId ||
        body?.userId ||
        body?.User?.Id ||
        body?.User?.UserId ||
        body?.Session?.UserId ||
        body?.Session?.User?.Id ||
        item?.UserId ||
        item?.User?.Id ||
        "",
    ).trim();

    const matchingConnection = jellyfinUserId
      ? await prisma.jellyfinConnection.findFirst({
          where: {
            jellyfinUserId,
            enabled: true,
          },
          include: { user: true },
        })
      : null;

    const user = matchingConnection?.user;
    if (!matchingConnection || !user) {
      return NextResponse.json(
        {
          ok: false,
          skipped: true,
          reason: "no_matching_jellyfin_user",
        },
        { status: 200 },
      );
    }

    const itemId = String(item?.Id || item?.ItemId || body?.ItemId || "").trim();
    if (!itemId) {
      return NextResponse.json(
        { ok: true, skipped: true, reason: "missing_item_id" },
        { status: 200 },
      );
    }

    const auth = await authenticateJellyfin(
      matchingConnection.serverUrl,
      matchingConnection.username || "",
      matchingConnection.password || "",
    );
    const jellyfinItem = await jellyfinRequest<JellyfinWebhookItem>(
      {
        serverUrl: matchingConnection.serverUrl,
        username: matchingConnection.username || "",
        password: matchingConnection.password || "",
        accessToken: auth.accessToken,
      },
      `/Users/${auth.userId}/Items/${encodeURIComponent(itemId)}`,
    );
    const played =
      jellyfinItem?.UserData?.Played === true ||
      Number(jellyfinItem?.UserData?.PlayCount || 0) > 0 ||
      jellyfinItem?.UserData?.LastPlayedDate != null ||
      jellyfinItem?.UserData?.DatePlayed != null;
    if (!played) {
      return NextResponse.json(
        { ok: true, skipped: true, reason: "not_marked_played" },
        { status: 200 },
      );
    }

    const providerIds = jellyfinItem?.ProviderIds || {};
    for (const [key, value] of Object.entries(item || {})) {
      if (key.startsWith("Provider_")) {
        const providerName = key.slice("Provider_".length).toLowerCase();
        if (providerIds[providerName] == null) {
          providerIds[providerName] = value;
        }
      }
    }
    const normalizedItem = {
      ...jellyfinItem,
      ProviderIds: providerIds,
      Id: jellyfinItem.Id || itemId,
    };

    const jellyfinTimestamp = body?.UtcTimestamp || body?.Timestamp;
    const watchedAt = jellyfinTimestamp ? new Date(jellyfinTimestamp) : new Date();

    const timeWindow = Math.floor(watchedAt.getTime() / (5 * 60 * 1000));
    const idempotencyKey = generateIdempotencyKey(itemId, user.id, String(timeWindow));

    const existingEvent = await prisma.webhookEventLog.findUnique({
      where: { idempotencyKey },
    });

    if (existingEvent) {
      return NextResponse.json(
        {
          ok: true,
          skipped: true,
          reason: "duplicate_event",
          existingEntryId: existingEvent.id,
        },
        { status: 200 },
      );
    }

    const result = await upsertJellyfinWatchEntry({
      userId: user.id,
      item: normalizedItem,
      watchedAt,
      source: "jellyfin-webhook",
    });

    if (result.created) {
      await prisma.webhookEventLog.create({
        data: {
          idempotencyKey,
          source: "jellyfin",
          eventType: "UserDataSaved",
          itemId,
          userId: user.id,
        },
      });
    }

    return NextResponse.json(
      { ok: true, created: result.created, reason: result.reason || null, existingEntryId: result.existingEntryId || null },
      { status: 200 },
    );
  } catch (error) {
    console.error("Jellyfin webhook error:", error);
    return NextResponse.json(
      { ok: false, error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
