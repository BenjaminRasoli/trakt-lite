import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      select: { id: true },
    });

    if (!dbUser) {
      return NextResponse.json({ items: [] });
    }

    const items = await prisma.media.findMany({
      where: {
        watchHistory: {
          some: { userId: dbUser.id },
        },
      },
      select: {
        tmdbId: true,
        mediaType: true,
      },
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error fetching watched media:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
