import { redirect } from "next/navigation";
import { getOrCreateDbUser, getServerUser } from "@/lib/auth-server";
import {
  getProfileWatchHistory,
} from "@/lib/watch-history-data";
import { getAchievementSummaryForUser } from "@/lib/achievement-data";
import { getTrendingBackdropUrl } from "@/lib/trending-backdrop";
import ProfileClient from "@/components/profile-client";

export default async function ProfilePage() {
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

  const [watchHistory, achievementSummary] = await Promise.all([
    getProfileWatchHistory(dbUser.id),
    getAchievementSummaryForUser(dbUser.id).catch(() => null),
  ]);

  return (
    <ProfileClient
      initialUser={user}
      initialWatchHistory={watchHistory}
      initialAchievementSummary={achievementSummary}
      initialBackdrop={backdrop}
    />
  );
}
