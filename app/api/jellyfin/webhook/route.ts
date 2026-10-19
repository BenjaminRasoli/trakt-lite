import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { upsertJellyfinWatchEntry } from "@/lib/jellyfin";
import crypto from "crypto";

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

    console.log("Jellyfin webhook:", {
      event: body?.NotificationType,
      item: item?.Name || item?.SeriesName,
      type: item?.Type || item?.ItemType,
    });

    if (!item || !eventName) {
      return NextResponse.json({ ok: false, skipped: true }, { status: 200 });
    }

    if (!eventName.includes("userdatasaved")) {
      return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
    }

    const played = body?.Played || item?.Played || body?.UserData?.Played || item?.UserData?.Played;
    if (!played) {
      return NextResponse.json({ ok: true, skipped: true, reason: "not_marked_played" }, { status: 200 });
    }

    const saveReason = String(body?.SaveReason || "").toLowerCase();
    if (saveReason === "playbackprogress") {
      return NextResponse.json({ ok: true, skipped: true, reason: "playback_progress_only" }, { status: 200 });
    }

    const jellyfinUserId = String(
      body?.UserId ||
        body?.userId ||
        body?.Session?.UserId ||
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

    const user = matchingConnection?.user ?? null;
    if (!user) {
      return NextResponse.json(
        {
          ok: false,
          skipped: true,
          reason: "no_matching_jellyfin_user",
        },
        { status: 200 },
      );
    }

    const jellyfinTimestamp = body?.UtcTimestamp || body?.Timestamp;
    const watchedAt = jellyfinTimestamp ? new Date(jellyfinTimestamp) : new Date();

    const timeWindow = Math.floor(watchedAt.getTime() / (5 * 60 * 1000));
    const itemId = String(item?.Id || item?.ItemId || "");
    const idempotencyKey = generateIdempotencyKey(itemId, user.id, String(timeWindow));

    const existingEvent = await prisma.webhookEventLog.findUnique({
      where: { idempotencyKey },
    });

    if (existingEvent) {
      console.log("Duplicate webhook event detected, skipping:", {
        idempotencyKey,
        itemId,
        originalProcessedAt: existingEvent.processedAt,
      });
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
      item,
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
