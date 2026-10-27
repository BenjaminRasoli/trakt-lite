import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { authenticateJellyfin } from "@/lib/jellyfin";

export async function GET() {
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

    const config = await prisma.jellyfinConnection.findUnique({
      where: { userId: dbUser.id },
    });

    return NextResponse.json(
      config
        ? {
          serverUrl: config.serverUrl,
          username: config.username,
          enabled: config.enabled,
          hasPassword: Boolean(config.password),
        }
        : null,
    );
  } catch (error) {
    console.error("Error loading Jellyfin config:", error);
    return NextResponse.json(
      { error: "Unable to load Jellyfin settings" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const serverUrl = String(body.serverUrl || "").trim();
    const username = String(body.username || "").trim();
    const submittedPassword = String(body.password || "");
    const enabled = Boolean(body.enabled ?? true);

    if (!serverUrl || !username) {
      return NextResponse.json(
        { error: "Jellyfin server URL and username are required." },
        { status: 400 },
      );
    }

    const existing = await prisma.jellyfinConnection.findUnique({
      where: { userId: dbUser.id },
    });
    const password = submittedPassword || existing?.password || "";

    let auth: Awaited<ReturnType<typeof authenticateJellyfin>>;
    try {
      auth = await authenticateJellyfin(serverUrl, username, password);
    } catch (error) {
      console.error("Error authenticating Jellyfin settings:", error);
      return NextResponse.json(
        { error: "Jellyfin connection failed. Check your URL, username, and password." },
        { status: 400 },
      );
    }

    const saved = await prisma.jellyfinConnection.upsert({
      where: { userId: dbUser.id },
      update: {
        serverUrl,
        username,
        password,
        jellyfinUserId: auth.userId,
        enabled,
      },
      create: {
        userId: dbUser.id,
        serverUrl,
        username,
        password,
        jellyfinUserId: auth.userId,
        enabled,
      },
    });

    return NextResponse.json({
      ok: true,
      config: {
        serverUrl: saved.serverUrl,
        username: saved.username,
        enabled: saved.enabled,
        hasPassword: Boolean(saved.password),
      },
    });
  } catch (error) {
    console.error("Error saving Jellyfin config:", error);
    return NextResponse.json(
      { error: "Unable to save Jellyfin settings." },
      { status: 500 },
    );
  }
}
