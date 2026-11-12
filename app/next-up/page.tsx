import { redirect } from "next/navigation";
import { getOrCreateDbUser, getServerUser } from "@/lib/auth-server";
import { getNextUpForUser } from "@/lib/next-up-data";
import { getTrendingBackdropUrl } from "@/lib/trending-backdrop";
import NextUpClient from "@/components/next-up-client";

export default async function NextUpPage() {
  const [user, backdrop] = await Promise.all([
    getServerUser(),
    getTrendingBackdropUrl(),
  ]);

  if (!user) {
    redirect("/auth");
  }

  const dbUser = await getOrCreateDbUser(user);

  if (!dbUser) {
    redirect("/auth");
  }

  const nextUpData = await getNextUpForUser(dbUser.id);

  return (
    <NextUpClient
      initialUser={user}
      initialNextUp={nextUpData.nextUp}
      initialBackdrop={backdrop}
    />
  );
}
