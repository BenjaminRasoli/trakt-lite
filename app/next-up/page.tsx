"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/components/supabase-provider";
import {
  getPosterUrl,
  getRandomBackdropUrl,
  getTrendingMedia,
} from "@/lib/tmdb";

interface NextUpItem {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string;
  overview: string | null;
}

export default function NextUpPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [nextUp, setNextUp] = useState<NextUpItem[]>([]);
  const [pageBackdrop, setPageBackdrop] = useState("");
  const router = useRouter();
  const supabase = useSupabase();

  const handleTitleClick = (e: React.MouseEvent, tmdbId: number) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/media/${tmdbId}?type=tv`);
  };

  useEffect(() => {
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
      updateUser(user);
      setLoading(false);
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      updateUser(session?.user ?? null);
    });

    const fetchBackdrop = async () => {
      const trendingMedia = await getTrendingMedia();
      setPageBackdrop(getRandomBackdropUrl(trendingMedia));
    };

    void fetchBackdrop();

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!user) return;

    const fetchNextUp = async () => {
      setLoadingQueue(true);

      try {
        const response = await fetch(
          "/api/watch-history?nextUp=true&nextUpLimit=20&limit=20",
        );
        if (!response.ok) {
          setNextUp([]);
          return;
        }

        const data = await response.json();
        const filteredNextUp = (
          Array.isArray(data.nextUp) ? data.nextUp : []
        ).filter((item: NextUpItem) => {
          if (!item.episodeNumber || !item.seasonNumber) return false;
          return true;
        });

        setNextUp(filteredNextUp);
      } catch (error) {
        console.error("Error fetching next up:", error);
        setNextUp([]);
      } finally {
        setLoadingQueue(false);
      }
    };

    void fetchNextUp();
  }, [user]);

  if (loading || loadingQueue) {
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
      <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-black/75 via-black/45 to-black/85">
        {pageBackdrop && (
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-35"
            style={{ backgroundImage: `url(${pageBackdrop})` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/55 to-black/80" />
      </div>

      <main className="relative z-10 mx-auto w-full max-w-[1650px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-violet-400/80">
              continue watching
            </p>
            <h1 className="text-3xl font-bold text-white md:text-4xl">
              Next up
            </h1>
          </div>

          <Link
            href="/"
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20"
          >
            Back home
          </Link>
        </div>

        {!loadingQueue && nextUp.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/60 p-12 text-center">
            <h2 className="text-2xl font-semibold text-white">
              Nothing queued yet
            </h2>
            <p className="mt-3 text-zinc-400">
              Watch a few more episodes and your next shows will show up here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
            {nextUp.map((item) => (
              <Link
                key={`${item.tmdbId}-${item.seasonNumber}-${item.episodeNumber}`}
                href={`/media/${item.tmdbId}/season/${item.seasonNumber}/episode/${item.episodeNumber}?type=tv`}
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
                    <span
                      onClick={(e) => handleTitleClick(e, item.tmdbId)}
                      className="hover:underline hover:text-violet-200 transition-colors cursor-pointer"
                    >
                      {item.title}
                    </span>
                  </div>
                  <div className="line-clamp-1 text-[10px] text-zinc-400">
                    {item.episodeTitle}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
