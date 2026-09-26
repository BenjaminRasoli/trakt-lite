"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/components/supabase-provider";
import {
  getPosterUrl,
  getRandomBackdropUrl,
  getTrendingMedia,
} from "@/lib/tmdb";

interface UpcomingEpisodeItem {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string;
  overview: string | null;
  airDate: string | null;
}

export default function CalendarPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [upcoming, setUpcoming] = useState<UpcomingEpisodeItem[]>([]);
  const [pageBackdrop, setPageBackdrop] = useState("");
  const router = useRouter();
  const supabase = useSupabase();

  useEffect(() => {
    let isMounted = true;

    const updateUser = (nextUser: any) => {
      setUser((currentUser: any) => {
        if (!nextUser) return null;
        if (currentUser?.id === nextUser.id) return currentUser;
        return nextUser;
      });
    };

    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!isMounted) return;
      updateUser(user);
      setLoading(false);
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      updateUser(session?.user ?? null);
    });

    const fetchBackdrop = async () => {
      const trendingMedia = await getTrendingMedia();
      if (!isMounted) return;
      setPageBackdrop(getRandomBackdropUrl(trendingMedia));
    };

    void fetchBackdrop();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!user) return;

    const fetchUpcoming = async () => {
      setCalendarLoading(true);

      try {
        const response = await fetch(
          "/api/watch-history?upcoming=true&limit=40",
        );

        if (!response.ok) {
          setUpcoming([]);
          return;
        }

        const data = await response.json();
        setUpcoming(Array.isArray(data.upcoming) ? data.upcoming : []);
      } catch (error) {
        console.error("Error fetching calendar:", error);
        setUpcoming([]);
      } finally {
        setCalendarLoading(false);
      }
    };

    void fetchUpcoming();
  }, [user]);

  const groupedByDate = useMemo(() => {
    return [...upcoming]
      .sort(
        (a, b) =>
          new Date(a.airDate || 0).getTime() -
          new Date(b.airDate || 0).getTime(),
      )
      .reduce<Record<string, UpcomingEpisodeItem[]>>((groups, item) => {
        const key = item.airDate || "Unknown date";
        groups[key] = groups[key] ? [...groups[key], item] : [item];
        return groups;
      }, {});
  }, [upcoming]);

  if (loading || calendarLoading) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-black">
        <div className="flex items-center gap-3 text-violet-300">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-violet-300" />
          <span className="text-sm font-medium uppercase tracking-[0.2em]">
            Loading
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    router.push("/auth");
    return null;
  }

  return (
    <div className="relative min-h-screen bg-black text-white overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-black/70 via-black/45 to-black/80">
        {pageBackdrop && (
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-35"
            style={{ backgroundImage: `url(${pageBackdrop})` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/55 to-black/80" />
      </div>

      <main className="relative z-10 mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-violet-400/80">
              upcoming release list
            </p>
            <h1 className="text-3xl font-bold text-white md:text-4xl">
              Calendar
            </h1>
          </div>

          <Link
            href="/"
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20"
          >
            Back home
          </Link>
        </div>

        {!calendarLoading && upcoming.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/60 p-12 text-center">
            <h2 className="text-2xl font-semibold text-white">
              No upcoming episodes
            </h2>
            <p className="mt-3 text-zinc-400">
              Watch a few shows and future episodes will show up here.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedByDate).map(([dateKey, items]) => {
              const dateLabel =
                dateKey === "Unknown date"
                  ? "Unknown date"
                  : new Date(dateKey).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });

              return (
                <section
                  key={dateKey}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 sm:p-5"
                >
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-violet-400/80">
                        Upcoming
                      </p>
                      <h2 className="text-xl font-bold text-white">
                        {dateLabel}
                      </h2>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
                    {items.map((item) => (
                      <Link
                        key={`${item.tmdbId}-${item.seasonNumber}-${item.episodeNumber}-${item.airDate || "unknown"}`}
                        href={`/media/${item.tmdbId}?type=tv`}
                        className="group w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/80 transition hover:-translate-y-0.5 hover:border-violet-500/50"
                      >
                        <div className="relative aspect-[2/3] overflow-hidden">
                          <img
                            src={getPosterUrl(item.posterPath || null)}
                            alt={item.episodeTitle}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                            onError={(e) => {
                              e.currentTarget.src = "/placeholder-poster.svg";
                            }}
                          />
                        </div>

                        <div className="space-y-1 border-t border-zinc-800 px-2 py-2">
                          <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-violet-300">
                            S{item.seasonNumber} • E{item.episodeNumber}
                          </div>
                          <div className="line-clamp-2 text-xs font-semibold text-white">
                            {item.episodeTitle}
                          </div>
                          <div className="line-clamp-1 text-[10px] text-zinc-400">
                            {item.title}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
