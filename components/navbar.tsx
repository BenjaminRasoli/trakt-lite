"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { useSupabase } from "./supabase-provider";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  getLevelIcon,
  getPrestigeTier,
  MAX_LEVEL,
  type AchievementSummary,
} from "@/lib/achievements";

function GlobalSearch() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";

  return <GlobalSearchForm key={query} initialQuery={query} />;
}

function GlobalSearchForm({ initialQuery }: { initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  const router = useRouter();

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    router.push(`/?q=${encodeURIComponent(trimmedQuery)}`);
  };

  return (
    <form
      role="search"
      onSubmit={handleSearch}
      className="flex w-full max-w-2xl items-stretch gap-2 pb-3"
    >
      <div className="relative min-w-0 flex-1">
        <input
          type="text"
          aria-label="Search movies and TV shows"
          placeholder="Search for movies and TV shows..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-10 w-full rounded-lg border border-zinc-600/50 bg-zinc-800/50 px-4 pr-11 text-sm text-white placeholder-zinc-500 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-violet-500/50"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              router.push("/");
            }}
            className="absolute inset-y-0 right-0 inline-flex w-10 cursor-pointer items-center justify-center text-violet-400 transition-colors hover:text-violet-300"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18"></path>
              <path d="m6 6 12 12"></path>
            </svg>
          </button>
        )}
      </div>
      <button
        type="submit"
        aria-label="Search"
        className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-violet-500/40 bg-violet-500/10 text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.3-4.3"></path>
        </svg>
      </button>
    </form>
  );
}

function ProfileLink({
  username,
  avatarUrl,
  summary,
  compact = false,
}: {
  username: string;
  avatarUrl: string;
  summary: AchievementSummary | null;
  compact?: boolean;
}) {
  const prestigeTier = summary ? getPrestigeTier(summary.level) : null;
  const isMaxLevel = summary?.level === MAX_LEVEL;
  const prestigeGlowLength =
    summary && prestigeTier !== null
      ? isMaxLevel
        ? summary.rank.length
        : Math.ceil((summary.rank.length * prestigeTier) / 5)
      : 0;
  const levelLabel = summary
    ? `Level ${summary.level} · ${summary.rank}${prestigeTier ? ` · Prestige ${prestigeTier}` : ""}`
    : "Loading level";

  return (
    <Link
      href="/profile"
      className={`flex min-w-0 items-center ${compact ? "gap-2" : "gap-2.5"}`}
      aria-label={`Profile: ${username}, ${levelLabel}`}
    >
      <span className="relative h-11 w-11 shrink-0 rounded-full bg-gradient-to-br from-violet-400 via-fuchsia-400 to-indigo-500 p-[2px]">
        {avatarUrl ? (
          <NextImage
            src={avatarUrl}
            alt=""
            width={44}
            height={44}
            className="h-full w-full rounded-full border-2 border-zinc-950 object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center rounded-full border-2 border-zinc-950 bg-gradient-to-br from-violet-600 to-indigo-700 text-sm font-bold text-white">
            {username.slice(0, 2).toUpperCase()}
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-col justify-center gap-0.5">
        <span
          className={`max-w-28 truncate font-semibold leading-tight text-white ${
            compact ? "text-xs min-[420px]:max-w-36" : "max-w-40 text-sm"
          }`}
          title={username}
        >
          {username}
        </span>
        <span
          className={`flex min-w-0 items-center gap-1 whitespace-nowrap text-[10px] font-semibold leading-none text-violet-100 ${
            prestigeTier !== null
              ? "rounded-md bg-violet-500/10 px-1.5 py-1 text-violet-100 ring-1 ring-inset ring-violet-400/30"
              : ""
          }`}
          title={`${levelLabel} · ${summary?.xp ?? 0} XP`}
        >
          <span aria-hidden="true" className="text-sm leading-none">
            {summary ? getLevelIcon(summary.level) : "✦"}
          </span>
          <span
            className={
              isMaxLevel
                ? "bg-gradient-to-r from-violet-200 via-fuchsia-200 to-violet-300 bg-clip-text text-transparent drop-shadow-[0_0_5px_rgba(167,139,250,0.85)]"
                : prestigeTier !== null
                  ? "text-violet-200"
                  : ""
            }
          >
            {summary ? `LVL ${summary.level}` : "…"}
          </span>
          {prestigeTier !== null && (
            <span className="rounded-full bg-violet-300/15 px-1 py-0.5 text-[8px] leading-none text-violet-100">
              P{prestigeTier}
            </span>
          )}
          {summary && (
            <>
              <span
                aria-hidden="true"
                className={
                  prestigeTier !== null ? "text-violet-300/60" : "text-zinc-500"
                }
              >
                |
              </span>
              <span
                className={`flex min-w-0 -mt-3 truncate pb-2 pt-4 font-medium ${
                  prestigeTier === null
                    ? "text-violet-50/80"
                    : "text-violet-200/50"
                } ${compact ? "max-w-12 min-[420px]:max-w-20" : "max-w-24"}`}
                title={summary.rank}
              >
                {prestigeTier !== null ? (
                  <>
                    <span className="prestige-starlight relative -mx-1 inline-block px-1">
                      <span
                        aria-hidden="true"
                        className="absolute -inset-x-4 -inset-y-1 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(139,92,246,0.18)_0%,rgba(139,92,246,0.06)_48%,transparent_80%)] opacity-70"
                      />
                      <span className="relative bg-gradient-to-r from-violet-100 via-fuchsia-200 to-violet-300 bg-clip-text font-semibold text-transparent drop-shadow-[0_0_5px_rgba(167,139,250,0.85)]">
                        {summary.rank.slice(0, prestigeGlowLength)}
                      </span>
                      <span
                        className="prestige-star"
                        style={{ left: "30%", animationDelay: "0.6s" }}
                      >
                        ✦
                      </span>
                      <span
                        className="prestige-star"
                        style={{ left: "68%", animationDelay: "1.5s" }}
                      >
                        ✦
                      </span>
                    </span>
                    {summary.rank.slice(prestigeGlowLength)}
                  </>
                ) : (
                  summary.rank
                )}
              </span>
            </>
          )}
        </span>
      </span>
    </Link>
  );
}

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [achievementSummary, setAchievementSummary] =
    useState<AchievementSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const supabase = useSupabase();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const updateUser = (nextUser: User | null) => {
      setUser((currentUser) => {
        if (!nextUser) return null;
        if (currentUser?.id === nextUser.id) return currentUser;
        return nextUser;
      });
      if (!nextUser) setAchievementSummary(null);
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

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!user) return;

    let isMounted = true;

    const loadAchievementLevel = async () => {
      try {
        const response = await fetch("/api/achievements?skipGenreSync=true");
        if (!response.ok) {
          throw new Error(
            `Failed to load achievement level (${response.status})`,
          );
        }

        const summary: AchievementSummary = await response.json();
        if (isMounted) setAchievementSummary(summary);
      } catch (error) {
        console.error("Error loading navbar achievement level:", error);
      }
    };

    void loadAchievementLevel();

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    document.body.style.overflow = showSignOutConfirm ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [showSignOutConfirm]);

  useEffect(() => {
    if (!showSignOutConfirm) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowSignOutConfirm(false);
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      const modal = document.getElementById("sign-out-modal");
      if (modal && !modal.contains(event.target as Node)) {
        setShowSignOutConfirm(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSignOutConfirm]);

  const handleSignOut = async () => {
    setShowSignOutConfirm(true);
  };

  const confirmSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth");
    setShowSignOutConfirm(false);
  };

  const username =
    user?.user_metadata?.username || user?.email?.split("@")[0] || "User";
  const capitalizedUsername =
    username.charAt(0).toUpperCase() + username.slice(1);
  const avatarUrl =
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.profile_picture ||
    user?.user_metadata?.avatarUrl ||
    "";

  if (loading || (!user && !loading)) {
    return null;
  }

  return (
    <>
      <nav className="sticky top-0 z-40 border-b border-zinc-700/50 bg-zinc-950/85 backdrop-blur-md">
        <div className="mx-auto max-w-[1650px] px-3 min-[1050px]:px-6 lg:px-8">
          <div className="flex flex-col gap-3 py-3 min-[1500px]:h-16 min-[1500px]:flex-row min-[1500px]:items-center min-[1500px]:justify-between min-[1500px]:py-0">
            <div className="flex w-full items-center justify-between gap-3 min-[1500px]:w-auto min-[1500px]:justify-start min-[1500px]:gap-6">
              <Link
                href="/"
                className="text-xl font-bold text-white transition-colors hover:text-violet-400 lg:text-2xl min-[1050px]:text-2xl"
              >
                Trakt <span className="text-violet-400">Lite</span>
              </Link>
              {user && (
                <div className="hidden flex-wrap items-center gap-3 min-[1500px]:flex">
                  {[
                    { href: "/new", label: "New" },
                    { href: "/recommendations", label: "For You" },
                    { href: "/next-up", label: "Next Up" },
                    { href: "/calendar", label: "Calendar" },
                    { href: "/weekly", label: "Weekly" },
                    { href: "/watchlist", label: "Watchlist" },
                    { href: "/history", label: "History" },
                    { href: "/ratings", label: "Ratings" },
                    { href: "/achievements", label: "Achievements" },
                    { href: "/profile", label: "Profile" },
                    { href: "/settings", label: "Settings" },
                  ].map(({ href, label }) => {
                    const isActive = pathname === href;

                    return (
                      <Link
                        key={href}
                        href={href}
                        className={[
                          "whitespace-nowrap text-sm font-medium transition-colors",
                          isActive
                            ? "text-violet-400"
                            : "text-zinc-300 hover:text-violet-400",
                        ].join(" ")}
                      >
                        {label}
                      </Link>
                    );
                  })}
                </div>
              )}
              <div className="flex items-center gap-4 min-[1500px]:hidden">
                {loading ? (
                  <div className="flex items-center gap-2 text-violet-300">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-violet-300" />
                    <span className="text-[10px] font-medium uppercase tracking-[0.2em] lg:text-xs min-[1050px]:text-xs">
                      Loading
                    </span>
                  </div>
                ) : user ? (
                  <>
                    <ProfileLink
                      username={capitalizedUsername}
                      avatarUrl={avatarUrl}
                      summary={achievementSummary}
                      compact
                    />
                    <button
                      onClick={handleSignOut}
                      className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <Link
                    href="/auth"
                    className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 shadow-lg shadow-violet-500/10 transition hover:border-violet-400 hover:bg-violet-500/20"
                  >
                    Sign In
                  </Link>
                )}
              </div>
            </div>

            <div className="hidden flex-wrap items-center justify-end gap-4 min-[1500px]:flex">
              {loading ? (
                <div className="flex items-center gap-2 text-violet-300">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-violet-300" />
                  <span className="text-[10px] font-medium uppercase tracking-[0.2em] lg:text-xs min-[1050px]:text-xs">
                    Loading
                  </span>
                </div>
              ) : user ? (
                <>
                  <ProfileLink
                    username={capitalizedUsername}
                    avatarUrl={avatarUrl}
                    summary={achievementSummary}
                  />
                  <button
                    onClick={handleSignOut}
                    className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <Link
                  href="/auth"
                  className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 shadow-lg shadow-violet-500/10 transition hover:border-violet-400 hover:bg-violet-500/20"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
          {user && (
            <Suspense
              fallback={
                <div className="h-10 w-full max-w-2xl rounded-lg border border-zinc-700/50 bg-zinc-800/30" />
              }
            >
              <GlobalSearch />
            </Suspense>
          )}
          {user && (
            <div className="flex flex-wrap items-start gap-3 pb-2 min-[1500px]:hidden">
              {[
                { href: "/new", label: "New" },
                { href: "/recommendations", label: "For You" },
                { href: "/next-up", label: "Next Up" },
                { href: "/calendar", label: "Calendar" },
                { href: "/weekly", label: "Weekly" },
                { href: "/watchlist", label: "Watchlist" },
                { href: "/history", label: "History" },
                { href: "/ratings", label: "Ratings" },
                { href: "/achievements", label: "Achievements" },
                { href: "/profile", label: "Profile" },
                { href: "/settings", label: "Settings" },
              ].map(({ href, label }) => {
                const isActive = pathname === href;

                return (
                  <Link
                    key={href}
                    href={href}
                    className={[
                      "text-sm font-medium transition-colors",
                      isActive
                        ? "text-violet-400"
                        : "text-zinc-300 hover:text-violet-400",
                    ].join(" ")}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      {showSignOutConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div
            id="sign-out-modal"
            className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 max-w-sm w-full mx-4 shadow-2xl"
          >
            <h3 className="text-lg font-semibold text-white mb-2">
              Are you sure?
            </h3>
            <p className="text-zinc-300 mb-6">
              Do you really want to sign out?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowSignOutConfirm(false)}
                className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20"
              >
                Cancel
              </button>
              <button
                onClick={confirmSignOut}
                className="px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
