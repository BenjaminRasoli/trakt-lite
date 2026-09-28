import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { upsertJellyfinWatchEntry } from "@/lib/jellyfin";

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

    const result = await upsertJellyfinWatchEntry({
      userId: user.id,
      item,
      watchedAt,
      source: "jellyfin-webhook",
    });

    return NextResponse.json(
      { ok: true, created: result.created, reason: result.reason || null },
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
