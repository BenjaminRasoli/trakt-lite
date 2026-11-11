"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useSupabase } from "@/components/supabase-provider";
import { getRandomBackdropUrl, getTrendingMedia } from "@/lib/tmdb";
import type {
  AchievementApiResponse,
  AchievementSummary,
} from "@/lib/achievements";
import { getRankName, MAX_LEVEL } from "@/lib/achievements";
import {
  COSMETICS_METADATA_KEY,
  getSlotCosmetics,
  isCosmeticUnlocked,
  parseActiveRankNameLevel,
  parseActiveCosmetics,
  RANK_NAME_METADATA_KEY,
  resolveCosmetics,
  SLOT_DESCRIPTIONS,
  SLOT_LABELS,
  type CosmeticSlot,
} from "@/lib/cosmetics";
import FxStars, { STAR_FX } from "@/components/fx-stars";

const categories = [
  "All",
  "Watching",
  "Movies",
  "TV",
  "Discovery",
  "Ratings",
  "Collection",
] as const;
type FilterIconName =
  | "all"
  | "watching"
  | "badges"
  | "rewards"
  | "movies"
  | "tv"
  | "discovery"
  | "ratings"
  | "collection"
  | "unlocked"
  | "locked";

const categoryIcons: Record<(typeof categories)[number], FilterIconName> = {
  All: "all",
  Watching: "watching",
  Movies: "movies",
  TV: "tv",
  Discovery: "discovery",
  Ratings: "ratings",
  Collection: "collection",
};
const pageViews = ["Badges", "Rewards"] as const;
type PageView = (typeof pageViews)[number];
const pageViewIcons: Record<PageView, FilterIconName> = {
  Badges: "badges",
  Rewards: "rewards",
};
const badgeStatuses = ["All badges", "Unlocked", "Locked"] as const;
const badgeStatusIcons: Record<(typeof badgeStatuses)[number], FilterIconName> =
  {
    "All badges": "all",
    Unlocked: "unlocked",
    Locked: "locked",
  };

function FilterIcon({ name }: { name: FilterIconName }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "all" ? (
        <>
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </>
      ) : name === "watching" ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="m10 8 6 4-6 4z" />
        </>
      ) : name === "badges" ? (
        <>
          <circle cx="12" cy="8" r="6" />
          <path d="m8.2 13.2-1.1 8L12 18l4.9 3.2-1.1-8" />
        </>
      ) : name === "rewards" ? (
        <>
          <path d="M20 12v10H4V12" />
          <path d="M2 7h20v5H2z" />
          <path d="M12 22V7" />
          <path d="M12 7H7.5a2.5 2.5 0 1 1 2.5-2.5V7Z" />
          <path d="M12 7h4.5A2.5 2.5 0 1 0 14 4.5V7Z" />
        </>
      ) : name === "movies" ? (
        <>
          <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
          <line x1="7" y1="2" x2="7" y2="22" />
          <line x1="17" y1="2" x2="17" y2="22" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <line x1="2" y1="7" x2="7" y2="7" />
          <line x1="2" y1="17" x2="7" y2="17" />
          <line x1="17" y1="17" x2="22" y2="17" />
          <line x1="17" y1="7" x2="22" y2="7" />
        </>
      ) : name === "tv" ? (
        <>
          <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
          <polyline points="17 2 12 7 7 2" />
        </>
      ) : name === "discovery" ? (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="m16.2 7.8-2.7 5.7-5.7 2.7 2.7-5.7z" />
          <circle cx="12" cy="12" r="1" />
        </>
      ) : name === "ratings" ? (
        <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
      ) : name === "collection" ? (
        <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
      ) : name === "unlocked" ? (
        <path d="M7 11V7a5 5 0 0 1 9.9-1M5 11h14v10H5z" />
      ) : (
        <>
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 1 1 8 0v4" />
        </>
      )}
    </svg>
  );
}

export default function AchievementsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [pageBackdrop, setPageBackdrop] = useState("");
  const [summary, setSummary] = useState<AchievementSummary | null>(null);
  const [loadingAchievements, setLoadingAchievements] = useState(true);
  const [syncingGenres, setSyncingGenres] = useState(false);
  const [genreSyncError, setGenreSyncError] = useState("");
  const [error, setError] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("All");
  const [badgeStatus, setBadgeStatus] =
    useState<(typeof badgeStatuses)[number]>("All badges");
  const [view, setView] = useState<PageView>("Badges");
  const [savingCosmetic, setSavingCosmetic] = useState("");
  const supabase = useSupabase();
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const fetchBackdrop = async () => {
      try {
        const trendingMedia = await getTrendingMedia();
        if (isMounted) {
          setPageBackdrop(getRandomBackdropUrl(trendingMedia));
        }
      } catch (backdropError) {
        console.error("Error loading achievements backdrop:", backdropError);
      }
    };

    void fetchBackdrop();

    const loadUser = async () => {
      const {
        data: { user: nextUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (!isMounted) return;
      if (authError) {
        console.error("Error loading achievements user:", authError);
        setError(
          "Could not verify your account. Please refresh and try again.",
        );
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

  const userId = user?.id;

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
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
  }, [authLoading, router, userId]);

  const visibleBadges = useMemo(
    () =>
      summary?.badges.filter(
        (badge) =>
          (category === "All" || badge.category === category) &&
          (badgeStatus === "All badges" ||
            (badgeStatus === "Unlocked" ? badge.earned : !badge.earned)),
      ) ?? [],
    [badgeStatus, category, summary],
  );

  const level = summary?.level ?? 1;
  const activeCosmetics = parseActiveCosmetics(user?.user_metadata);
  const activeRankNameLevel = parseActiveRankNameLevel(
    user?.user_metadata,
    level,
  );
  const resolvedCosmetics = resolveCosmetics(user?.user_metadata, level);
  const badgeShineClass = resolvedCosmetics.badgeShine?.value ?? "";
  const slotOrder: CosmeticSlot[] = [
    "nameEffect",
    "usernameEffect",
    "nameColor",
    "avatarRing",
    "badgeShine",
  ];

  const updateCosmetic = async (slot: CosmeticSlot, id: string | null) => {
    if (!user || savingCosmetic) return;

    const savingKey = `${slot}:${id ?? "none"}`;
    setSavingCosmetic(savingKey);
    setError("");

    const next = { ...activeCosmetics };
    if (id === null) {
      delete next[slot];
    } else {
      next[slot] = id;
    }

    try {
      const { data, error: updateError } = await supabase.auth.updateUser({
        data: {
          ...(user.user_metadata ?? {}),
          [COSMETICS_METADATA_KEY]: next,
        },
      });

      if (updateError) {
        setError(`Could not save your cosmetic: ${updateError.message}`);
        return;
      }
      if (data.user) setUser(data.user);
    } catch (updateError) {
      console.error("Error saving cosmetic:", updateError);
      setError("Could not save your cosmetic. Please try again.");
    } finally {
      setSavingCosmetic("");
    }
  };

  const updateRankName = async (rankLevel: number) => {
    if (!user || savingCosmetic) return;

    setSavingCosmetic(`rankName:${rankLevel}`);
    setError("");

    try {
      const { data, error: updateError } = await supabase.auth.updateUser({
        data: {
          ...(user.user_metadata ?? {}),
          [RANK_NAME_METADATA_KEY]: rankLevel,
        },
      });

      if (updateError) {
        setError(`Could not save your rank name: ${updateError.message}`);
        return;
      }
      if (data.user) setUser(data.user);
    } catch (updateError) {
      console.error("Error saving rank name:", updateError);
      setError("Could not save your rank name. Please try again.");
    } finally {
      setSavingCosmetic("");
    }
  };

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
    <div className="relative flex min-h-screen flex-1 flex-col overflow-hidden bg-black text-white">
      <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-black/70 via-black/40 to-black/80">
        {pageBackdrop && (
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-35"
            style={{ backgroundImage: `url(${pageBackdrop})` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/55 to-black/80" />
      </div>
      <main className="relative z-10 mx-auto w-full max-w-[1400px] flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-300">
              Your journey
            </p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              Achievements
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400 sm:text-base">
              Turn the movies, episodes, and ratings you log into XP. Every
              badge is earned from your activity on Trakt Lite.
            </p>
          </div>
          <Link
            href="/profile"
            className="inline-flex w-fit cursor-pointer items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20"
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
                    {getRankName(activeRankNameLevel)}
                  </h2>
                  <p className="mt-2 text-zinc-400">
                    {summary.xp} XP earned · {summary.earnedCount} of{" "}
                    {summary.totalBadges} badges unlocked
                  </p>
                </div>
                <div className="w-full max-w-md">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-semibold text-zinc-200">
                      {summary.level >= MAX_LEVEL
                        ? "Maximum level reached"
                        : `Progress to level ${summary.level + 1}`}
                    </span>
                    <span className="text-zinc-400">
                      {summary.level >= MAX_LEVEL
                        ? "MAX"
                        : `${summary.progressInLevel} / ${summary.levelXpCost} XP`}
                    </span>
                  </div>
                  <div
                    className="h-3 overflow-hidden rounded-full bg-zinc-800"
                    role="progressbar"
                    aria-label={
                      summary.level >= MAX_LEVEL
                        ? "Maximum level reached"
                        : "Progress to next level"
                    }
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
                    {summary.level >= MAX_LEVEL
                      ? "You have reached the level cap."
                      : `${summary.xpForNextLevel} XP to your next level`}
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
                  <div
                    className="mb-3 inline-flex rounded-full border border-zinc-700 bg-zinc-900/70 p-1"
                    role="group"
                    aria-label="Switch between badges and rewards"
                  >
                    {pageViews.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setView(item)}
                        aria-pressed={view === item}
                        className={`cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                          view === item
                            ? "bg-violet-500/25 text-violet-100"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <FilterIcon name={pageViewIcons[item]} />
                          {item}
                        </span>
                      </button>
                    ))}
                  </div>
                  <h2 className="text-xl font-bold">
                    {view === "Badges"
                      ? "Badge collection"
                      : "Rewards & cosmetics"}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    {view === "Badges"
                      ? "Earn XP once per badge as you keep watching and rating."
                      : "Every level unlocks a new rank and new cosmetics. Pick one per slot and show it off"}
                  </p>
                </div>
                {view === "Badges" && (
                <div className="flex flex-col gap-3">
                  <div
                    className="flex flex-wrap gap-2"
                    role="group"
                    aria-label="Filter badges by category"
                  >
                    {categories.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setCategory(item)}
                        aria-pressed={category === item}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          category === item
                            ? "border-violet-400/60 bg-violet-500/20 text-violet-100"
                            : "border-zinc-700 bg-zinc-900/70 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                        }`}
                      >
                        <FilterIcon name={categoryIcons[item]} />
                        {item}
                      </button>
                    ))}
                  </div>
                  <div
                    className="flex flex-wrap items-center gap-2"
                    role="group"
                    aria-label="Filter badges by unlock status"
                  >
                    <span className="mr-1 text-xs font-medium text-zinc-500">
                      Filter
                    </span>
                    {badgeStatuses.map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setBadgeStatus(status)}
                        aria-pressed={badgeStatus === status}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          badgeStatus === status
                            ? "border-violet-400/60 bg-violet-500/20 text-violet-100"
                            : "border-zinc-700 bg-zinc-900/70 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                        }`}
                      >
                        <FilterIcon name={badgeStatusIcons[status]} />
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
                )}
              </div>

              {view === "Rewards" ? (
                <div className="space-y-10">
                  <div>
                    <div className="space-y-6">
                      {slotOrder.map((slot) => (
                        <div key={slot}>
                          <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">
                            {SLOT_LABELS[slot]}
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {SLOT_DESCRIPTIONS[slot]}
                          </p>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {getSlotCosmetics(slot).map((cosmetic) => {
                              const unlocked = isCosmeticUnlocked(
                                cosmetic,
                                level,
                              );
                              const isFxRing = cosmetic.value.startsWith(
                                "fx-ring-",
                              );
                              const selected =
                                activeCosmetics[slot] === cosmetic.id;
                              const saving = savingCosmetic.startsWith(
                                `${slot}:`,
                              );
                              return (
                                <button
                                  key={cosmetic.id}
                                  type="button"
                                  disabled={!unlocked || saving}
                                  onClick={() =>
                                    updateCosmetic(
                                      slot,
                                      selected ? null : cosmetic.id,
                                    )
                                  }
                                  aria-pressed={selected}
                                  className={`rounded-xl border p-3 text-left transition ${
                                    selected
                                      ? "cursor-pointer border-violet-400/70 bg-violet-500/15"
                                      : unlocked
                                        ? "cursor-pointer border-zinc-700 bg-zinc-900/70 hover:border-zinc-500"
                                        : "cursor-not-allowed border-zinc-800 bg-zinc-900/40 opacity-60"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-semibold text-white">
                                      {cosmetic.name}
                                    </p>
                                    <span
                                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                        selected
                                          ? "bg-violet-500/30 text-violet-100"
                                          : unlocked
                                            ? "bg-zinc-800 text-zinc-400"
                                            : "bg-zinc-800/60 text-zinc-500"
                                      }`}
                                    >
                                      {selected
                                        ? "Equipped"
                                        : unlocked
                                          ? "Tap to equip"
                                          : `Lv ${cosmetic.unlockLevel}`}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-xs text-zinc-400">
                                    {cosmetic.description}
                                  </p>
                                  <div className="mt-2 flex h-7 items-center">
                                    {slot === "nameEffect" &&
                                      cosmetic.value && (
                                        <span
                                          className={`relative inline-block bg-gradient-to-r from-violet-100 via-fuchsia-200 to-violet-300 bg-clip-text text-[10px] font-semibold text-transparent ${cosmetic.value} ${STAR_FX[cosmetic.value] ? "fx-js-stars" : ""}`}
                                        >
                                          LVL 20 | RANK
                                          {cosmetic.value === "fx-void" && (
                                            <FxStars
                                              count={6}
                                              leftMin={1}
                                              leftMax={99}
                                            />
                                          )}
                                          {STAR_FX[cosmetic.value] && (
                                            <FxStars
                                              {...STAR_FX[cosmetic.value]}
                                              count={4}
                                              leftMin={1}
                                              leftMax={99}
                                            />
                                          )}
                                        </span>
                                      )}
                                    {slot === "usernameEffect" &&
                                      cosmetic.value && (
                                        <span
                                          className={`relative inline-block text-[10px] font-semibold text-white fx-username ${cosmetic.value} ${STAR_FX[cosmetic.value] ? "fx-js-stars" : ""}`}
                                        >
                                          username
                                          {STAR_FX[cosmetic.value] && (
                                            <FxStars
                                              {...STAR_FX[cosmetic.value]}
                                            />
                                          )}
                                        </span>
                                      )}
                                    {slot === "nameColor" && (
                                      <span
                                        className={`text-xs font-semibold ${
                                          cosmetic.value.startsWith("fx-color-")
                                            ? cosmetic.value
                                            : ""
                                        }`}
                                        style={{
                                          color:
                                            cosmetic.value &&
                                            !cosmetic.value.startsWith("fx-color-")
                                              ? cosmetic.value
                                              : undefined,
                                        }}
                                      >
                                        {cosmetic.value
                                          ? "Your username"
                                          : "Your username"}
                                      </span>
                                    )}
                                    {slot === "avatarRing" && (
                                      <span
                                        className={`flex h-6 w-6 items-center justify-center rounded-full p-[2px] ${
                                          isFxRing
                                            ? cosmetic.value
                                            : cosmetic.value
                                              ? ""
                                              : "bg-gradient-to-br from-violet-400 via-fuchsia-400 to-indigo-500"
                                        } ${
                                          cosmetic.value.includes("--ring-angle")
                                            ? "fx-ring-spin"
                                            : ""
                                        }`}
                                        style={
                                          !isFxRing && cosmetic.value
                                            ? { background: cosmetic.value }
                                            : undefined
                                        }
                                      >
                                        <span className="block h-full w-full rounded-full bg-zinc-800" />
                                      </span>
                                    )}
                                    {slot === "badgeShine" && (
                                      <span
                                        className={`rounded-md border border-violet-500/30 bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold text-violet-200 ${cosmetic.value}`}
                                      >
                                        Unlocked badge
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">
                          Rank name
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          Choose any rank name you have already unlocked.
                        </p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {Array.from({ length: level }, (_, index) => index + 1).map(
                        (rankLevel) => {
                          const selected = activeRankNameLevel === rankLevel;
                          const saving = savingCosmetic.startsWith("rankName:");
                          return (
                            <button
                              key={rankLevel}
                              type="button"
                              disabled={saving}
                              onClick={() => void updateRankName(rankLevel)}
                              aria-pressed={selected}
                              className={`cursor-pointer rounded-xl border p-3 text-left transition ${
                                selected
                                  ? "border-violet-400/70 bg-violet-500/15"
                                  : "border-zinc-700 bg-zinc-900/70 hover:border-zinc-500"
                              }`}
                            >
                              <span className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-white">
                                  {getRankName(rankLevel)}
                                </span>
                                <span className="text-[10px] font-medium text-zinc-400">
                                  Level {rankLevel}
                                </span>
                              </span>
                            </button>
                          );
                        },
                      )}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              ) : visibleBadges.length === 0 ? (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-center">
                  <p className="text-sm font-semibold text-zinc-200">
                    No {badgeStatus.toLowerCase()} badges in this category yet.
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">
                    Try another category or status filter.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleBadges.map((badge) => (
                    <article
                      key={badge.id}
                      className={`rounded-2xl border p-4 transition ${
                        badge.earned
                          ? "border-violet-500/30 bg-gradient-to-br from-violet-950/50 to-zinc-900/90"
                          : "border-zinc-800 bg-zinc-900/70"
                      } ${badge.earned && badgeShineClass ? badgeShineClass : ""}`}
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
                              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400 transition-all"
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
              )}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
