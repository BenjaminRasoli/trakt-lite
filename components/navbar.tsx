"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { useSupabase } from "./supabase-provider";
import { usePathname, useRouter } from "next/navigation";

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const supabase = useSupabase();
  const router = useRouter();
  const pathname = usePathname();

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

    return () => subscription.unsubscribe();
  }, [supabase]);

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
          <div className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between lg:py-0 lg:h-16 min-[1050px]:flex-row min-[1050px]:items-center min-[1050px]:justify-between min-[1050px]:py-0 min-[1050px]:h-16">
            <div className="flex items-center justify-between lg:justify-start gap-3 lg:gap-8 w-full lg:w-auto min-[1050px]:justify-start min-[1050px]:gap-8 min-[1050px]:w-auto">
              <Link
                href="/"
                className="text-xl font-bold text-white transition-colors hover:text-violet-400 lg:text-2xl min-[1050px]:text-2xl"
              >
                Trakt <span className="text-violet-400">Lite</span>
              </Link>
              {user && (
                <div className="hidden lg:flex flex-wrap items-center gap-4 min-[1050px]:flex">
                  {[
                    { href: "/new", label: "New" },
                    { href: "/next-up", label: "Next Up" },
                    { href: "/calendar", label: "Calendar" },
                    { href: "/weekly", label: "Weekly" },
                    { href: "/watchlist", label: "Watchlist" },
                    { href: "/history", label: "History" },
                    { href: "/profile", label: "Profile" },
                    { href: "/settings", label: "Settings" },
                  ].map(({ href, label }) => {
                    const isActive = pathname === href;

                    return (
                      <Link
                        key={href}
                        href={href}
                        className={[
                          "text-sm font-medium transition-colors lg:text-base min-[1050px]:text-base",
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
              <div className="flex items-center gap-2 lg:hidden min-[1050px]:hidden">
                {loading ? (
                  <div className="flex items-center gap-2 text-violet-300">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-violet-300" />
                    <span className="text-[10px] font-medium uppercase tracking-[0.2em] lg:text-xs min-[1050px]:text-xs">
                      Loading
                    </span>
                  </div>
                ) : user ? (
                  <>
                    <Link
                      href="/profile"
                      className="flex items-center gap-2"
                    >
                      {avatarUrl ? (
                        <NextImage
                          src={avatarUrl}
                          alt={capitalizedUsername}
                          width={32}
                          height={32}
                          className="h-8 w-8 rounded-full border border-violet-500/50 object-cover shadow-lg shadow-violet-500/20"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-violet-500/50 bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-bold text-white shadow-lg shadow-violet-500/20">
                          {capitalizedUsername.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </Link>
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

            <div className="hidden lg:flex flex-wrap items-center justify-end gap-2 lg:gap-4 min-[1050px]:flex min-[1050px]:justify-end min-[1050px]:gap-4">
              {loading ? (
                <div className="flex items-center gap-2 text-violet-300">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-violet-300" />
                  <span className="text-[10px] font-medium uppercase tracking-[0.2em] lg:text-xs min-[1050px]:text-xs">
                    Loading
                  </span>
                </div>
              ) : user ? (
                <>
                  <Link
                    href="/profile"
                    className="flex items-center gap-2 lg:gap-3 min-[1050px]:gap-3"
                  >
                    {avatarUrl ? (
                      <NextImage
                        src={avatarUrl}
                        alt={capitalizedUsername}
                        width={32}
                        height={32}
                        className="h-8 w-8 rounded-full border border-violet-500/50 object-cover shadow-lg shadow-violet-500/20 lg:h-9 lg:w-9 min-[1050px]:h-9 min-[1050px]:w-9"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-violet-500/50 bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-bold text-white shadow-lg shadow-violet-500/20 lg:h-9 lg:w-9 lg:text-sm min-[1050px]:h-9 min-[1050px]:w-9 min-[1050px]:text-sm">
                        {capitalizedUsername.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="hidden lg:block max-w-[150px] truncate text-xs text-zinc-300 lg:max-w-none lg:text-sm min-[1050px]:block min-[1050px]:max-w-none min-[1050px]:text-sm">
                      <span className="font-semibold text-violet-400">
                        {capitalizedUsername}
                      </span>
                    </div>
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20 lg:px-4 lg:py-2 lg:text-sm min-[1050px]:px-4 min-[1050px]:py-2 min-[1050px]:text-sm"
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
            <div className="flex flex-wrap items-start gap-3 lg:hidden pb-2 min-[1050px]:hidden">
              {[
                { href: "/new", label: "New" },
                { href: "/next-up", label: "Next Up" },
                { href: "/calendar", label: "Calendar" },
                { href: "/weekly", label: "Weekly" },
                { href: "/watchlist", label: "Watchlist" },
                { href: "/history", label: "History" },
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
