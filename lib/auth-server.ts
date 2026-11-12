import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { User } from "@supabase/supabase-js";

export const getServerUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getServerUserFast = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as Record<string, unknown> | undefined;
  if (!claims || typeof claims.sub !== "string") return null;

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : undefined,
    phone: typeof claims.phone === "string" ? claims.phone : undefined,
    user_metadata:
      (claims.user_metadata as User["user_metadata"]) ?? {},
    app_metadata:
      (claims.app_metadata as User["app_metadata"]) ?? {},
    aud: "authenticated",
    role: "authenticated",
    created_at: "",
  } as User;
});

export async function getOrCreateDbUser(user: {
  email?: string | null;
  id: string;
  user_metadata?: { username?: string } | null;
}) {
  if (!user.email) return null;

  let dbUser = await prisma.user.findUnique({
    where: { email: user.email },
  });

  if (!dbUser) {
    dbUser = await prisma.user.create({
      data: {
        supabaseUserId: user.id,
        email: user.email,
        username: user.user_metadata?.username || user.email.split("@")[0],
      },
    });
  }

  return dbUser;
}
