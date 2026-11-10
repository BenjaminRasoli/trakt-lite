import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

async function clearProfilePictures(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const bucket = supabase.storage.from("profile-pictures");

  while (true) {
    const { data: files, error } = await bucket.list(userId, {
      limit: 100,
      offset: 0,
    });

    if (error) {
      throw new Error(`Unable to list profile pictures: ${error.message}`);
    }

    const filePaths = (files ?? []).map((file) => `${userId}/${file.name}`);

    if (filePaths.length === 0) {
      return;
    }

    const { error: removeError } = await bucket.remove(filePaths);
    if (removeError) {
      throw new Error(`Unable to remove profile pictures: ${removeError.message}`);
    }
  }
}

async function clearUserData(userId: string, deleteAccount: boolean) {
  await prisma.$transaction(async (transaction) => {
    await transaction.webhookEventLog.deleteMany({ where: { userId } });
    await transaction.nextUpCache.deleteMany({ where: { userId } });
    await transaction.upcomingEpisodesCache.deleteMany({ where: { userId } });

    if (deleteAccount) {
      await transaction.user.delete({ where: { id: userId } });
      return;
    }

    await transaction.droppedNextUpShow.deleteMany({ where: { userId } });
    await transaction.userRating.deleteMany({ where: { userId } });
    await transaction.watchlist.deleteMany({ where: { userId } });
    await transaction.watchHistory.deleteMany({ where: { userId } });
    await transaction.jellyfinConnection.deleteMany({ where: { userId } });
    await transaction.user.update({
      where: { id: userId },
      data: { username: null },
    });
  });
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (
      !body ||
      typeof body !== "object" ||
      !("action" in body) ||
      !("confirmation" in body)
    ) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { action, confirmation } = body as {
      action: unknown;
      confirmation: unknown;
    };

    if (action !== "reset" && action !== "delete") {
      return NextResponse.json({ error: "Invalid account action" }, { status: 400 });
    }

    const expectedConfirmation = action === "reset" ? "RESET" : "DELETE";
    if (confirmation !== expectedConfirmation) {
      return NextResponse.json(
        { error: `Type ${expectedConfirmation} to confirm this action` },
        { status: 400 },
      );
    }

    let supabaseAdmin: ReturnType<typeof createSupabaseClient> | null = null;
    if (action === "delete") {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceRoleKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
      if (!supabaseUrl || !serviceRoleKey) {
        console.error("Account deletion requires a Supabase server admin key");
        return NextResponse.json(
          {
            error:
              "Permanent account deletion is not configured. Set SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) in the server environment and redeploy. Erasing account data does not require this key.",
          },
          { status: 503 },
        );
      }

      supabaseAdmin = createSupabaseClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }

    const dbUserByAuthId = await prisma.user.findFirst({
      where: { supabaseUserId: user.id },
      select: { id: true },
    });
    const dbUser =
      dbUserByAuthId ??
      (user.email
        ? await prisma.user.findUnique({
        where: { email: user.email },
        select: { id: true },
          })
        : null);

    if (dbUser) {
      await clearUserData(dbUser.id, action === "delete");
    }

    try {
      await clearProfilePictures(supabase, user.id);
    } catch (error) {
      console.error("Error removing account profile pictures:", error);
      return NextResponse.json(
        {
          error:
            "Your app data was cleared, but profile pictures could not be removed. Please try again or contact support.",
        },
        { status: 502 },
      );
    }

    if (action === "reset") {
      const metadataToClear = Object.fromEntries(
        Object.keys(user.user_metadata ?? {}).map((key) => [key, null]),
      );
      const { error } = await supabase.auth.updateUser({
        data: {
          ...metadataToClear,
          avatar_url: null,
          profile_picture: null,
          avatarUrl: null,
        },
      });

      if (error) {
        console.error("Error clearing account profile data:", error);
        return NextResponse.json(
          {
            error:
              "Your app data was cleared, but profile details could not be reset. Please try again or contact support.",
          },
          { status: 502 },
        );
      }

      return NextResponse.json({ success: true });
    }

    if (!supabaseAdmin) {
      throw new Error("Supabase admin client is unavailable for account deletion");
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (error) {
      console.error("Error deleting Supabase account:", error);
      return NextResponse.json(
        {
          error:
            "Your app data was cleared, but your sign-in account could not be deleted. Please try again or contact support.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing account cleanup:", error);
    return NextResponse.json(
      { error: "Unable to complete account cleanup." },
      { status: 500 },
    );
  }
}
