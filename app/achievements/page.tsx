import { redirect } from "next/navigation";
import { getOrCreateDbUser, getServerUser } from "@/lib/auth-server";
import { getAchievementSummaryForUser } from "@/lib/achievement-data";
import { getTrendingBackdropUrl } from "@/lib/trending-backdrop";
import AchievementsClient from "@/components/achievements-client";

export default async function AchievementsPage() {
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

  const initialAchievement = await getAchievementSummaryForUser(dbUser.id).catch(
    () => null,
  );

  return (
    <AchievementsClient
      initialUser={user}
      initialAchievement={initialAchievement}
      initialBackdrop={backdrop}
    />
  );
}
