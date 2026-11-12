import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAchievementDataForUser } from "@/lib/achievement-data";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const cursorParam = request.nextUrl.searchParams.get("genreCursor");
    const cursor = cursorParam === null ? null : Number(cursorParam);
    if (
      cursor !== null &&
      (!Number.isSafeInteger(cursor) || cursor < 0)
    ) {
      return NextResponse.json(
        { error: "Invalid genre sync cursor" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      select: { id: true },
    });

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          supabaseUserId: user.id,
          email: user.email,
          username: user.user_metadata?.username || user.email.split("@")[0],
        },
        select: { id: true },
      });
    }

    const skipGenreSync =
      request.nextUrl.searchParams.get("skipGenreSync") === "true";
    const data = await getAchievementDataForUser(dbUser.id, {
      skipGenreSync,
      genreCursor: cursor,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching achievements:", error);
    return NextResponse.json(
      { error: "Failed to fetch achievements" },
      { status: 500 },
    );
  }
}
