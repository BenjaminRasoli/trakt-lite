"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/components/supabase-provider";
import type {
  AchievementApiResponse,
  AchievementSummary,
} from "@/lib/achievements";

const categories = ["All", "Watching", "Movies", "TV", "Discovery", "Ratings"] as const;

export default function AchievementsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [summary, setSummary] = useState<AchievementSummary | null>(null);
  const [loadingAchievements, setLoadingAchievements] = useState(true);
  const [syncingGenres, setSyncingGenres] = useState(false);
  const [genreSyncError, setGenreSyncError] = useState("");
  const [error, setError] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("All");
  const supabase = useSupabase();
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      const {
        data: { user: nextUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (!isMounted) return;
      if (authError) {
        console.error("Error loading achievements user:", authError);
        setError("Could not verify your account. Please refresh and try again.");
      }
      setUser(nextUser);
      setAuthLoading(false);
    };

    void loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      setUser(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/auth");
      return;
    }

    let isMounted = true;

    const loadAchievements = async () => {
      setLoadingAchievements(true);
      setError("");
      setGenreSyncError("");

      try {
        let cursor: number | null = null;
        let initialLoad = true;
        let genreSyncFailed = false;
        const genreSyncHttpStatuses = new Set<number>();

        do {
          const query = cursor === null ? "" : `?genreCursor=${cursor}`;
          const response = await fetch(`/api/achievements${query}`);
          if (!response.ok) {
            const result = await response.json().catch(() => null);
            throw new Error(result?.error || "Failed to load achievements.");
          }

          const result: AchievementApiResponse = await response.json();
          if (isMounted) {
            setSummary(result);
            if (initialLoad) setLoadingAchievements(false);
          }
          initialLoad = false;
          genreSyncFailed ||= result.genreSync.failed > 0;
          result.genreSync.httpStatuses.forEach((status) =>
            genreSyncHttpStatuses.add(status),
          );
          cursor = result.genreSync.cursor;

          if (isMounted) setSyncingGenres(cursor !== null);
        } while (cursor !== null && isMounted);

        if (isMounted && genreSyncFailed) {
          const statuses = [...genreSyncHttpStatuses];
          setGenreSyncError(
            statuses.length > 0
              ? `TMDB couldn't load genre data for some titles (HTTP ${statuses.join(", ")}). Check your TMDB API key or try again later.`
              : "TMDB couldn't load genre data for some titles. Check the server logs and try again later.",
          );
        }
      } catch (fetchError) {
        console.error("Error loading achievements:", fetchError);
        if (isMounted) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Failed to load achievements.",
          );
        }
      } finally {
        if (isMounted) {
          setLoadingAchievements(false);
          setSyncingGenres(false);
        }
      }
    };

    void loadAchievements();

    return () => {
      isMounted = false;
    };
  }, [authLoading, router, user]);

  const visibleBadges = useMemo(
    () =>
      summary?.badges.filter(
        (badge) => category === "All" || badge.category === category,
      ) ?? [],
    [category, summary],
  );

  if (authLoading || loadingAchievements) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-black">
        <div className="flex items-center gap-3 text-violet-300">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-violet-300" />
          <span className="text-sm font-medium uppercase tracking-[0.2em]">
            Loading achievements
          </span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <main className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-black px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-950/40 via-black to-black" />
      <div className="relative mx-auto w-full max-w-[1400px] flex-1">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-300">
              Your journey
            </p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Achievements</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400 sm:text-base">
              Turn the movies, episodes, and ratings you log into XP. Every badge
              is earned from your activity on Trakt Lite.
            </p>
          </div>
          <Link
            href="/profile"
            className="inline-flex w-fit items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/80 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-violet-400 hover:text-white"
          >
            Back to profile
          </Link>
        </div>

        {error ? (
          <section
            role="alert"
            className="rounded-2xl border border-red-500/30 bg-red-950/30 p-6 text-red-100"
          >
            <h2 className="font-semibold">Achievements could not be loaded</h2>
            <p className="mt-2 text-sm text-red-200/80">{error}</p>
          </section>
        ) : summary ? (
          <>
            <section className="relative overflow-hidden rounded-3xl border border-violet-500/25 bg-zinc-900/80 p-6 shadow-2xl shadow-violet-950/20 sm:p-8">
              <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full bg-violet-600/15 blur-3xl" />
              <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">
                    Level {summary.level}
                  </p>
                  <h2 className="mt-2 text-3xl font-bold sm:text-4xl">
                    {summary.rank}
                  </h2>
                  <p className="mt-2 text-zinc-400">
                    {summary.xp} XP earned · {summary.earnedCount} of{" "}
                    {summary.totalBadges} badges unlocked
                  </p>
                </div>
                <div className="w-full max-w-md">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-semibold text-zinc-200">
                      Progress to level {summary.level + 1}
                    </span>
                    <span className="text-zinc-400">
                      {summary.progressInLevel} / 100 XP
                    </span>
                  </div>
                  <div
                    className="h-3 overflow-hidden rounded-full bg-zinc-800"
                    role="progressbar"
                    aria-label="Progress to next level"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={summary.progressPercent}
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400 transition-all"
                      style={{ width: `${summary.progressPercent}%` }}
                    />
                  </div>
                  <p className="mt-2 text-right text-xs text-zinc-500">
                    {summary.xpForNextLevel} XP to your next level
                  </p>
                </div>
              </div>
            </section>
            {(syncingGenres || genreSyncError) && (
              <p
                role="status"
                className={`mt-4 text-sm ${
                  genreSyncError ? "text-amber-200" : "text-violet-200"
                }`}
              >
                {genreSyncError ||
                  "Updating genre badges from the titles you have watched..."}
              </p>
            )}

            <section className="mt-8">
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold">Badge collection</h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    Earn XP once per badge as you keep watching and rating.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2" aria-label="Filter badges">
                  {categories.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setCategory(item)}
                      aria-pressed={category === item}
                      className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        category === item
                          ? "border-violet-400/60 bg-violet-500/20 text-violet-100"
                          : "border-zinc-700 bg-zinc-900/70 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visibleBadges.map((badge) => (
                  <article
                    key={badge.id}
                    className={`rounded-2xl border p-4 transition ${
                      badge.earned
                        ? "border-violet-500/30 bg-gradient-to-br from-violet-950/50 to-zinc-900/90"
                        : "border-zinc-800 bg-zinc-900/70"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${
                          badge.earned
                            ? "bg-violet-500/20"
                            : "bg-zinc-800 grayscale"
                        }`}
                        aria-hidden="true"
                      >
                        {badge.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">
                              {badge.category}
                            </p>
                            <h3 className="mt-1 font-bold text-white">
                              {badge.title}
                            </h3>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${
                              badge.earned
                                ? "bg-violet-500/20 text-violet-200"
                                : "bg-zinc-800 text-zinc-400"
                            }`}
                          >
                            +{badge.xp} XP
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-zinc-400">
                          {badge.description}
                        </p>
                        <div className="mt-4 flex items-center justify-between text-xs">
                          <span
                            className={
                              badge.earned
                                ? "font-semibold text-emerald-300"
                                : "text-zinc-500"
                            }
                          >
                            {badge.earned ? "Unlocked" : "In progress"}
                          </span>
                          <span className="text-zinc-400">
                            {badge.progress} / {badge.target}
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className={`h-full rounded-full transition-all ${
                              badge.earned ? "bg-emerald-400" : "bg-violet-500"
                            }`}
                            style={{
                              width: `${(badge.progress / badge.target) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
