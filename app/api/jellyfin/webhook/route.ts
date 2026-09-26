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
      eventName.includes("itemcompleted") ||
      eventName.includes("playbackfinished") ||
      eventName.includes("markwatched");

    if (!isCompletionEvent) {
      return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
    }

    const userId = String(body?.UserId || body?.userId || "").trim();
    const user = userId
      ? await prisma.user.findFirst({ where: { id: userId } })
      : null;
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Unknown user" },
        { status: 404 },
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
