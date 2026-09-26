import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { validateJellyfinConnection } from "@/lib/jellyfin";

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
            apiKey: config.apiKey,
            jellyfinUserId: config.jellyfinUserId,
            enabled: config.enabled,
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
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const serverUrl = String(body.serverUrl || "").trim();
    const apiKey = String(body.apiKey || "").trim();
    const jellyfinUserId = String(body.jellyfinUserId || "").trim();
    const enabled = Boolean(body.enabled ?? true);

    if (!serverUrl || !apiKey) {
      return NextResponse.json(
        { error: "Jellyfin server URL and API key are required." },
        { status: 400 },
      );
    }

    const config = {
      serverUrl,
      apiKey,
      jellyfinUserId: jellyfinUserId || null,
      enabled,
    };

    const valid = await validateJellyfinConnection(config).catch(() => false);
    if (!valid) {
      return NextResponse.json(
        { error: "Jellyfin connection failed. Check your URL and API key." },
        { status: 400 },
      );
    }

    const saved = await prisma.jellyfinConnection.upsert({
      where: { userId: dbUser.id },
      update: {
        serverUrl,
        apiKey,
        jellyfinUserId: jellyfinUserId || null,
        enabled,
      },
      create: {
        userId: dbUser.id,
        serverUrl,
        apiKey,
        jellyfinUserId: jellyfinUserId || null,
        enabled,
      },
    });

    return NextResponse.json({
      ok: true,
      config: {
        serverUrl: saved.serverUrl,
        apiKey: saved.apiKey,
        jellyfinUserId: saved.jellyfinUserId,
        enabled: saved.enabled,
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
