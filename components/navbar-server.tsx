import { prisma } from "@/lib/prisma";
import { getServerUser } from "@/lib/auth-server";
import { getAchievementSummaryForUser } from "@/lib/achievement-data";
import Navbar from "@/components/navbar";
import type { AchievementApiResponse } from "@/lib/achievements";

export default async function NavbarServer() {
  const user = await getServerUser();

  let achievementSummary: AchievementApiResponse | null = null;
  if (user?.email) {
    const dbUser = await prisma.user.findUnique({
      where: { email: user.email },
      select: { id: true },
    });
    if (dbUser) {
      achievementSummary = await getAchievementSummaryForUser(dbUser.id).catch(
        () => null,
      );
    }
  }

  return (
    <Navbar
      initialUser={user}
      initialAchievementSummary={achievementSummary}
    />
  );
}
