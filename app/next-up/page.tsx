"use client";

import Link from "next/link";
import Image from "next/image";
import EpisodeTypeBadge from "@/components/episode-type-badge";
import NextUpEpisodeInfo, {
  isSpecialEpisodeType,
} from "@/components/next-up-episode-info";
import DropNextUpShowModal from "@/components/drop-next-up-show-modal";
import { getPosterUrl, getRandomBackdropUrl, getTrendingMedia } from "@/lib/tmdb";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useSupabase } from "@/components/supabase-provider";
import type { User } from "@supabase/supabase-js";

interface NextUpItem {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  seasonPosterPath?: string | null;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string;
  episodeType?: string | null;
  episodeRuntimeMinutes?: number | null;
  remainingEpisodeCount?: number | null;
  remainingRuntimeMinutes?: number | null;
  overview: string | null;
}

function NextUpPageContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [nextUpLoading, setNextUpLoading] = useState(true);
  const [nextUp, setNextUp] = useState<NextUpItem[]>([]);
  const [showToDrop, setShowToDrop] = useState<NextUpItem | null>(null);
  const [droppingShow, setDroppingShow] = useState(false);
  const [dropShowError, setDropShowError] = useState<string | null>(null);
  const [nextUpError, setNextUpError] = useState<string | null>(null);
  const [pageBackdrop, setPageBackdrop] = useState("");
  const router = useRouter();
  const supabase = useSupabase();

  const loadNextUp = useCallback(async () => {
    const response = await fetch("/api/next-up");
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to fetch next up.");
    }

    setNextUp(Array.isArray(data.nextUp) ? data.nextUp : []);
    setNextUpError(null);
  }, []);

  const handleConfirmDropShow = async () => {
    if (!showToDrop) return;

    setDroppingShow(true);
    setDropShowError(null);

    try {
      const response = await fetch(`/api/next-up?tmdbId=${showToDrop.tmdbId}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (response.status === 401) {
        router.push("/auth");
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to drop show from Next Up.");
      }

      setNextUp((current) =>
        current.filter((nextItem) => nextItem.tmdbId !== showToDrop.tmdbId),
      );
      setShowToDrop(null);
    } catch (error) {
      console.error("Error dropping show from Next Up:", error);
      setDropShowError(
        error instanceof Error ? error.message : "Failed to drop show from Next Up.",
      );
    } finally {
      setDroppingShow(false);
    }
  };

  const handleCancelDropShow = () => {
    if (droppingShow) return;
    setShowToDrop(null);
    setDropShowError(null);
  };

  const handleTitleClick = (
    e: React.MouseEvent,
    tmdbId: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/media/${tmdbId}?type=tv`);
  };

  useEffect(() => {
    let isMounted = true;

    const updateUser = (nextUser: User | null) => {
      setUser((currentUser) => {
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

    const fetchNextUp = async () => {
      setNextUpLoading(true);
      try {
        await loadNextUp();
      } catch (error) {
        console.error("Error fetching next up:", error);
        setNextUp([]);
        setNextUpError("Failed to load your Next Up list. Please reload the page.");
      } finally {
        setNextUpLoading(false);
      }
    };

    void fetchNextUp();
  }, [user, loadNextUp]);

  if (loading) {
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

  if (nextUpLoading) {
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
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-violet-400/80">
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

        {nextUp.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/60 p-12 text-center">
            <h2 className="text-2xl font-semibold text-white">
              Nothing queued yet
            </h2>
            <p className="mt-3 text-zinc-400">
              Watch a few more episodes and your next shows will show up here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {nextUp.map((item: NextUpItem) => (
              <div
                key={`${item.tmdbId}-${item.seasonNumber}-${item.episodeNumber}`}
                className="group flex h-full w-full flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/80 transition hover:-translate-y-0.5 hover:border-violet-500/50"
              >
                <Link
                  href={`/media/${item.tmdbId}/season/${item.seasonNumber}/episode/${item.episodeNumber}?type=tv`}
                  className="flex flex-1 flex-col"
                >
                  <div className="relative aspect-[2/3] overflow-hidden">
                    {isSpecialEpisodeType(item.episodeType) && (
                      <EpisodeTypeBadge episodeType={item.episodeType} />
                    )}
                    <Image
                      src={getPosterUrl(
                        item.seasonPosterPath || item.posterPath || null,
                      )}
                      alt={item.episodeTitle}
                      fill
                      sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 20vw, (max-width: 1280px) 16vw, 14vw"
                      className="object-cover transition duration-300 group-hover:scale-105"
                    />
                  </div>

                  <div className="flex flex-1 flex-col gap-1 border-t border-zinc-800 px-2 py-2">
                    <div className="h-4 text-[10px] font-medium uppercase leading-4 text-violet-300">
                      S{item.seasonNumber} E{item.episodeNumber}
                    </div>
                    <div className="h-4 truncate text-xs font-semibold leading-4 text-white">
                      <span
                        onClick={(e) => handleTitleClick(e, item.tmdbId)}
                        className="cursor-pointer transition-colors hover:text-violet-200 hover:underline"
                      >
                        {item.title}
                      </span>
                    </div>
                    <div className="h-4 truncate text-[10px] leading-4 text-zinc-400">
                      {item.episodeTitle}
                    </div>
                    <NextUpEpisodeInfo
                      episodeRuntimeMinutes={item.episodeRuntimeMinutes}
                      remainingEpisodeCount={item.remainingEpisodeCount}
                      remainingRuntimeMinutes={item.remainingRuntimeMinutes}
                    />
                  </div>
                </Link>
                <div className="flex justify-end px-2 pb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDropShowError(null);
                      setShowToDrop(item);
                    }}
                    aria-label={`Drop ${item.title} from Next Up`}
                    title="Drop show from Next Up"
                    className="inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-1 text-[10px] text-zinc-500 opacity-70 transition hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                    Drop show
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {nextUpError && (
          <p role="alert" className="mt-4 text-center text-sm text-red-300">
            {nextUpError}
          </p>
        )}
      </main>
      <DropNextUpShowModal
        showTitle={showToDrop?.title ?? null}
        loading={droppingShow}
        error={dropShowError}
        onCancel={handleCancelDropShow}
        onConfirm={handleConfirmDropShow}
      />
    </div>
  );
}

export default function NextUpPage() {
  return (
    <NextUpPageContent />
  );
}
