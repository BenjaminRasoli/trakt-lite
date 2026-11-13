import { getOrCreateDbUser, getServerUser } from "@/lib/auth-server";
import { getAchievementSummaryForUser } from "@/lib/achievement-data";
import { MAX_LEVEL } from "@/lib/achievements";
import { resolveCosmetics } from "@/lib/cosmetics";
import { getWatchHistoryFeed } from "@/lib/watch-history-data";
import { getLiveSession } from "@/lib/live-session-data";
import { getTrendingBackdropUrl } from "@/lib/trending-backdrop";
import HomeClient from "@/components/home-client";

interface HomePageProps {
  searchParams: Promise<{
    q?: string | string[];
    filter?: string | string[];
    sort?: string | string[];
  }>;
}

const SEARCH_FILTER_VALUES = ["all", "tv", "movie"] as const;
const SEARCH_SORT_VALUES = [
  "relevance",
  "newest",
  "oldest",
  "az",
  "za",
] as const;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Home({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const searchQuery = firstParam(params.q)?.trim() ?? "";
  const rawFilter = firstParam(params.filter);
  const rawSort = firstParam(params.sort);
  const searchFilter = SEARCH_FILTER_VALUES.includes(
    rawFilter as (typeof SEARCH_FILTER_VALUES)[number],
  )
    ? (rawFilter as (typeof SEARCH_FILTER_VALUES)[number])
    : "all";
  const searchSort = SEARCH_SORT_VALUES.includes(
    rawSort as (typeof SEARCH_SORT_VALUES)[number],
  )
    ? (rawSort as (typeof SEARCH_SORT_VALUES)[number])
    : "relevance";

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
        initialSearchFilter={searchFilter}
        initialSearchSort={searchSort}
        initialCosmetics={null}
        initialIsMaxLevel={false}
      />
    );
  }

  const dbUser = await getOrCreateDbUser(user);

  let homeData: Awaited<ReturnType<typeof getWatchHistoryFeed>> | null = null;
  let liveSession: Awaited<ReturnType<typeof getLiveSession>> | null = null;
  const achievementSummaryPromise = dbUser
    ? getAchievementSummaryForUser(dbUser.id).catch(() => null)
    : Promise.resolve(null);

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

  const achievementSummary = await achievementSummaryPromise;
  const initialCosmetics = resolveCosmetics(
    user.user_metadata,
    achievementSummary?.level ?? 1,
  );
  const initialIsMaxLevel = achievementSummary?.level === MAX_LEVEL;

  return (
    <HomeClient
      key={
        searchQuery
          ? `${searchQuery}|${searchFilter}|${searchSort}`
          : "home"
      }
      initialUser={user}
      initialHomeData={homeData}
      initialLiveSession={liveSession}
      initialBackdrop={backdrop}
      searchQuery={searchQuery}
      initialSearchFilter={searchFilter}
      initialSearchSort={searchSort}
      initialCosmetics={initialCosmetics}
      initialIsMaxLevel={initialIsMaxLevel}
    />
  );
}
