import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { upsertJellyfinWatchEntry } from "@/lib/jellyfin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const item = body?.Item || body?.item || body?.NowPlayingItem || null;
    const eventName = String(
      body?.EventName || body?.eventName || "",
    ).toLowerCase();

    if (!item || !eventName) {
      return NextResponse.json({ ok: false, skipped: true }, { status: 200 });
    }

    const isCompletionEvent =
      eventName.includes("playbackstop") ||
      eventName.includes("playbackstopped") ||
      eventName.includes("itemcompleted") ||
      eventName.includes("playbackfinished") ||
      eventName.includes("markwatched");

    if (!isCompletionEvent) {
      return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
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

    const result = await upsertJellyfinWatchEntry({
      userId: user.id,
      item,
      watchedAt: new Date(),
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
