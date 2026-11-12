import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOrCreateDbUser, getServerUser } from "@/lib/auth-server";
import { getWatchHistoryFeed } from "@/lib/watch-history-data";
import { getTrendingBackdropUrl } from "@/lib/trending-backdrop";
import HistoryClient from "@/components/history-client";

const PAGE_SIZE = 42;

interface HistoryPageProps {
  searchParams: Promise<{ filter?: string | string[] }>;
}

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const params = await searchParams;
  const rawFilter = Array.isArray(params.filter)
    ? params.filter[0]
    : params.filter;
  const filter =
    rawFilter === "movie" || rawFilter === "tv" ? rawFilter : "all";

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

  const [feed, totalCount] = await Promise.all([
    getWatchHistoryFeed(dbUser.id, {
      limit: PAGE_SIZE,
      offset: 0,
      mediaType: filter === "all" ? undefined : filter,
      includeStreak: false,
    }),
    prisma.watchHistory.count({ where: { userId: dbUser.id } }),
  ]);

  return (
    <HistoryClient
      key={filter}
      initialUser={user}
      initialItems={feed.items}
      initialHasMore={feed.hasMore}
      initialHasAnyHistory={totalCount > 0}
      initialFilter={filter}
      initialBackdrop={backdrop}
    />
  );
}
