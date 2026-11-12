import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { isMissingDroppedNextUpTable } from "@/lib/dropped-next-up-shows";
import { getNextUpForUser } from "@/lib/next-up-data";

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

    const { nextUp, warning } = await getNextUpForUser(dbUser.id);

    return NextResponse.json({ nextUp, warning });
  } catch (error) {
    console.error("Error fetching next up:", error);
    return NextResponse.json(
      { error: "Failed to fetch next up" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tmdbIdParam = request.nextUrl.searchParams.get("tmdbId");
    const tmdbId = Number(tmdbIdParam);
    if (!tmdbIdParam || !Number.isSafeInteger(tmdbId) || tmdbId <= 0) {
      return NextResponse.json({ error: "A valid tmdbId is required" }, { status: 400 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email! },
    });
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.droppedNextUpShow.upsert({
        where: {
          userId_tmdbId: {
            userId: dbUser.id,
            tmdbId,
          },
        },
        create: {
          userId: dbUser.id,
          tmdbId,
        },
        update: {},
      }),
      prisma.nextUpCache.deleteMany({
        where: { userId: dbUser.id, tmdbId },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error dropping Next Up show:", error);
    if (isMissingDroppedNextUpTable(error)) {
      return NextResponse.json(
        {
          error:
            "Dropping shows is unavailable until the database migration is applied.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Failed to drop show from Next Up" },
      { status: 500 },
    );
  }
}
