import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getLiveSession } from "@/lib/live-session-data";

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
      select: { id: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const active = await getLiveSession(dbUser.id);
    return NextResponse.json({ active });
  } catch (error) {
    console.error("Error fetching Jellyfin live session:", error);
    return NextResponse.json({ active: null }, { status: 200 });
  }
}
