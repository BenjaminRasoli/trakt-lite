import { getOrCreateDbUser, getServerUser } from "@/lib/auth-server";
import { getWatchHistoryFeed } from "@/lib/watch-history-data";
import { getLiveSession } from "@/lib/live-session-data";
import { getTrendingBackdropUrl } from "@/lib/trending-backdrop";
import HomeClient from "@/components/home-client";

interface HomePageProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

export default async function Home({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const rawQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const searchQuery = rawQuery?.trim() ?? "";

  const [user, backdrop] = await Promise.all([
    getServerUser(),
    getTrendingBackdropUrl(),
  ]);

  if (!user) {
    return (
      <HomeClient
        initialUser={null}
        initialHomeData={null}
        initialLiveSession={null}
        initialBackdrop={backdrop}
        searchQuery={searchQuery}
      />
    );
  }

  const dbUser = await getOrCreateDbUser(user);

  let homeData: Awaited<ReturnType<typeof getWatchHistoryFeed>> | null = null;
  let liveSession: Awaited<ReturnType<typeof getLiveSession>> | null = null;

  if (dbUser && !searchQuery) {
    [homeData, liveSession] = await Promise.all([
      getWatchHistoryFeed(dbUser.id, {
        limit: 6,
        nextUpLimit: 6,
        includeNextUp: true,
        includeUpcoming: true,
      }),
      Promise.race([
        getLiveSession(dbUser.id),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
      ]).catch(() => null),
    ]);
  }

  return (
    <HomeClient
      key={searchQuery || "home"}
      initialUser={user}
      initialHomeData={homeData}
      initialLiveSession={liveSession}
      initialBackdrop={backdrop}
      searchQuery={searchQuery}
    />
  );
}
