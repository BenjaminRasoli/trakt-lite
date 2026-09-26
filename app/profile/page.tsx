"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { type User } from "@supabase/supabase-js";
import { useSupabase } from "@/components/supabase-provider";
import { useRouter } from "next/navigation";
import {
  getMediaDetails,
  getRandomBackdropUrl,
  getTrendingMedia,
} from "@/lib/tmdb";

type WatchHistoryEntry = {
  watchedAt: string;
  media?: {
    mediaType?: string;
    title?: string;
    tmdbId?: number;
  };
  mediaId?: number;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
};

type RuntimeStats = {
  movieMinutes: number;
  tvMinutes: number;
  totalMinutes: number;
};



export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [watchHistory, setWatchHistory] = useState<WatchHistoryEntry[]>([]);
  const [backdrop, setBackdrop] = useState("");
  const [uploading, setUploading] = useState(false);
  const [runtimeStats, setRuntimeStats] = useState<RuntimeStats>({
    movieMinutes: 0,
    tvMinutes: 0,
    totalMinutes: 0,
  });
  const [loadingRuntime, setLoadingRuntime] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [viewFilter, setViewFilter] = useState<"all" | "year">("all");
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const formatEuropeanDate = (date: Date | string) => {
    const normalizedDate = date instanceof Date ? date : new Date(date);

    if (Number.isNaN(normalizedDate.getTime())) {
      return "Unknown date";
    }

    return normalizedDate.toLocaleDateString("en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const supabase = useSupabase();
  const router = useRouter();

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
      setBackdrop(getRandomBackdropUrl(trendingMedia));
    };

    void fetchBackdrop();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    document.body.style.overflow = showDeleteConfirm ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [showDeleteConfirm]);

  useEffect(() => {
    if (!showDeleteConfirm) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowDeleteConfirm(false);
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      const modal = document.getElementById("delete-photo-modal");
      if (modal && !modal.contains(event.target as Node)) {
        setShowDeleteConfirm(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDeleteConfirm]);

  useEffect(() => {
    if (!user) return;

    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const response = await fetch(
          "/api/watch-history?limit=all&nextUp=false&upcoming=false",
        );
        if (!response.ok) {
          setWatchHistory([]);
          return;
        }

        const data = await response.json();
        const nextItems = Array.isArray(data.items) ? data.items : [];
        setWatchHistory(nextItems);
        if (nextItems.length === 0) {
          setRuntimeStats({ movieMinutes: 0, tvMinutes: 0, totalMinutes: 0 });
        }
      } catch (error) {
        console.error("Error fetching profile watch history:", error);
        setWatchHistory([]);
        setRuntimeStats({ movieMinutes: 0, tvMinutes: 0, totalMinutes: 0 });
      } finally {
        setLoadingHistory(false);
      }
    };

    void fetchHistory();
  }, [user]);

  useEffect(() => {
    const filteredHistory = selectedYear
      ? watchHistory.filter(
          (entry) => new Date(entry.watchedAt).getFullYear() === selectedYear,
        )
      : watchHistory;

    if (filteredHistory.length === 0) {
      setRuntimeStats({ movieMinutes: 0, tvMinutes: 0, totalMinutes: 0 });
      setLoadingRuntime(false);
      return;
    }

    let isMounted = true;

    const loadRuntimeStats = async () => {
      setLoadingRuntime(true);
      const mediaById = new Map<
        number,
        { type: "movie" | "tv"; count: number }
      >();

      for (const item of filteredHistory) {
        const mediaType =
          item.media?.mediaType === "tv" ||
          (item.seasonNumber != null && item.episodeNumber != null)
            ? "tv"
            : "movie";
        const mediaId = item.media?.tmdbId ?? item.mediaId;
        if (!mediaId) continue;

        const current = mediaById.get(mediaId) ?? { type: mediaType, count: 0 };
        mediaById.set(mediaId, {
          type: mediaType,
          count: current.count + 1,
        });
      }

      let movieMinutes = 0;
      let tvMinutes = 0;

      const batchSize = 10;
      const mediaIds = Array.from(mediaById.keys());

      for (let i = 0; i < mediaIds.length; i += batchSize) {
        const batch = mediaIds.slice(i, i + batchSize);

        const batchPromises = batch.map(async (mediaId) => {
          const info = mediaById.get(mediaId)!;
          const mediaType = info.type;
          const details = (await getMediaDetails(mediaId, mediaType)) as {
            runtime?: number;
            episode_run_time?: number[];
          } | null;
          const runtime =
            mediaType === "movie"
              ? (details?.runtime ?? 90)
              : (details?.episode_run_time?.[0] ?? details?.runtime ?? 45);

          return {
            mediaType,
            runtime,
            count: info.count,
          };
        });

        const batchResults = await Promise.all(batchPromises);

        for (const result of batchResults) {
          if (result.mediaType === "movie") {
            movieMinutes += result.runtime * result.count;
          } else {
            tvMinutes += result.runtime * result.count;
          }
        }
      }

      if (!isMounted) return;
      setRuntimeStats({
        movieMinutes,
        tvMinutes,
        totalMinutes: movieMinutes + tvMinutes,
      });
      setLoadingRuntime(false);
    };

    void loadRuntimeStats();

    return () => {
      isMounted = false;
    };
  }, [watchHistory, selectedYear]);

  const stats = useMemo(() => {
    // Filter by year if selected
    const filteredHistory = selectedYear
      ? watchHistory.filter(
          (entry) => new Date(entry.watchedAt).getFullYear() === selectedYear,
        )
      : watchHistory;

    // Movies: entries where mediaType is "movie" OR no season/episode info
    const movieEntries = filteredHistory.filter((entry) => {
      const type = entry.media?.mediaType;
      return type === "movie" || (type !== "tv" && entry.seasonNumber == null);
    });

    // Episodes: entries with both season and episode numbers
    const episodeEntries = filteredHistory.filter(
      (entry) => entry.seasonNumber != null && entry.episodeNumber != null,
    );

    // TV shows: entries where mediaType is "tv"
    const tvEntries = filteredHistory.filter((entry) => {
      const type = entry.media?.mediaType;
      return type === "tv";
    });

    const uniqueMovieIds = new Set(
      movieEntries
        .map((entry) => entry.media?.tmdbId ?? entry.mediaId)
        .filter((id): id is number => typeof id === "number"),
    );

    const uniqueTvIds = new Set(
      tvEntries
        .map((entry) => entry.media?.tmdbId ?? entry.mediaId)
        .filter((id): id is number => typeof id === "number"),
    );

    const years = new Map<number, number>();
    for (const entry of filteredHistory) {
      const year = new Date(entry.watchedAt).getFullYear();
      years.set(year, (years.get(year) ?? 0) + 1);
    }

    const titleCounts = new Map<string, number>();
    for (const entry of filteredHistory) {
      const title = entry.media?.title || `Media ${entry.mediaId}`;
      titleCounts.set(title, (titleCounts.get(title) ?? 0) + 1);
    }

    const titleBreakdown = [...titleCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const topTitle = titleBreakdown[0];
    const topYear = [...years.entries()].sort((a, b) => b[1] - a[1])[0];

    // Watch time by day of week (European: Monday = 0, Sunday = 6)
    const dayOfWeekStats = new Map<number, number>(); // 0 = Monday, 6 = Sunday
    for (const entry of filteredHistory) {
      const day = new Date(entry.watchedAt).getDay();
      const europeanDay = day === 0 ? 6 : day - 1; // Convert Sunday(0) to 6, shift others
      dayOfWeekStats.set(
        europeanDay,
        (dayOfWeekStats.get(europeanDay) ?? 0) + 1,
      );
    }

    // Watch time by hour of day
    const hourOfDayStats = new Map<number, number>();
    for (const entry of filteredHistory) {
      const hour = new Date(entry.watchedAt).getHours();
      hourOfDayStats.set(hour, (hourOfDayStats.get(hour) ?? 0) + 1);
    }

    // Calculate available years from full history (not filtered)
    const allYears = new Map<number, number>();
    for (const entry of watchHistory) {
      const year = new Date(entry.watchedAt).getFullYear();
      allYears.set(year, (allYears.get(year) ?? 0) + 1);
    }

    // Calculate overall best year from full history (not filtered)
    const overallTopYear = [...allYears.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0];

    return {
      totalEntries: filteredHistory.length,
      movieEntries: movieEntries.length,
      episodeEntries: episodeEntries.length,
      tvEntries: tvEntries.length,
      uniqueMovies: uniqueMovieIds.size,
      uniqueTvShows: uniqueTvIds.size,
      topTitle,
      titleBreakdown,
      topYear,
      overallTopYear,
      yearBreakdown: [...years.entries()].sort((a, b) => b[0] - a[0]),
      dayOfWeekStats: [...dayOfWeekStats.entries()].sort((a, b) => a[0] - b[0]),
      hourOfDayStats: [...hourOfDayStats.entries()].sort((a, b) => a[0] - b[0]),
      availableYears: [...allYears.keys()].sort((a, b) => b - a),
    };
  }, [watchHistory, selectedYear]);

  const formatCompactDuration = (minutes: number) => {
    const totalMinutes = Math.max(0, minutes);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const mins = totalMinutes % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (mins > 0 || parts.length === 0) parts.push(`${mins}m`);

    return parts.join(" ");
  };

  const displayName =
    user?.user_metadata?.username || user?.email?.split("@")[0] || "User";
  const email = user?.email || "No email";
  const avatarUrl =
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.profile_picture ||
    user?.user_metadata?.avatarUrl ||
    "";

  const handlePhotoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/profile-picture", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload profile picture");
      }

      const data = await response.json();

      // Update local state with new avatar URL
      setUser(
        (currentUser) =>
          ({
            ...(currentUser ?? {}),
            user_metadata: {
              ...(currentUser?.user_metadata ?? {}),
              avatar_url: data.url,
            },
          }) as User,
      );
    } catch (error) {
      console.error("Error updating profile photo:", error);
      alert(error instanceof Error ? error.message : "Failed to upload profile picture");
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoDelete = async () => {
    if (!avatarUrl) return;
    setShowDeleteConfirm(true);
  };

  const confirmPhotoDelete = async () => {
    if (!avatarUrl) return;

    setUploading(true);
    setShowDeleteConfirm(false);

    try {
      const response = await fetch("/api/profile-picture", {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete profile picture");
      }

      // Update local state to remove avatar
      setUser(
        (currentUser) =>
          ({
            ...(currentUser ?? {}),
            user_metadata: {
              ...(currentUser?.user_metadata ?? {}),
              avatar_url: null,
              profile_picture: null,
              avatarUrl: null,
            },
          }) as User,
      );
    } catch (error) {
      console.error("Error deleting profile photo:", error);
      alert(error instanceof Error ? error.message : "Failed to delete profile picture");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-black font-sans">
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
    <div className="relative flex min-h-screen flex-col bg-black font-sans text-white">
      <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-black/80 via-black/50 to-black/90">
        {backdrop && (
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40"
            style={{ backgroundImage: `url(${backdrop})` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/85" />
      </div>

      <main className="relative z-10 mx-auto w-full max-w-[1650px] flex-1 px-4 py-8 sm:px-6 lg:px-8 overflow-y-auto">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-300">
              Profile
            </p>
            <h1 className="mt-2 text-3xl font-bold text-white">Your stats</h1>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-800/50 px-3 py-1.5">
              <button
                onClick={() => {
                  setViewFilter("all");
                  setSelectedYear(null);
                }}
                className={`text-xs font-semibold uppercase tracking-[0.2em] transition cursor-pointer ${
                  viewFilter === "all"
                    ? "text-violet-300"
                    : "text-zinc-400 hover:text-zinc-300"
                }`}
              >
                All Time
              </button>
              <span className="text-zinc-600">|</span>
              <button
                onClick={() => setViewFilter("year")}
                className={`text-xs font-semibold uppercase tracking-[0.2em] transition cursor-pointer ${
                  viewFilter === "year"
                    ? "text-violet-300"
                    : "text-zinc-400 hover:text-zinc-300"
                }`}
              >
                By Year
              </button>
            </div>
            {viewFilter === "year" && stats.availableYears.length > 0 && (
              <select
                value={selectedYear || ""}
                onChange={(e) =>
                  setSelectedYear(
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
                className="rounded-full border border-zinc-700 bg-zinc-800/50 px-3 py-1.5 text-sm text-white outline-none focus:border-violet-500 cursor-pointer"
              >
                <option value="">All Years</option>
                {stats.availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            )}
            <Link
              href="/settings"
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20"
            >
              Settings
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-2xl shadow-violet-900/10 backdrop-blur-sm sm:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <div className="relative">
              {avatarUrl ? (
                <NextImage
                  src={avatarUrl}
                  alt={displayName}
                  width={112}
                  height={112}
                  className="h-24 w-24 rounded-full border border-violet-500/50 object-cover shadow-lg shadow-violet-500/20 sm:h-28 sm:w-28"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full border border-violet-500/50 bg-gradient-to-br from-violet-500 to-indigo-600 text-2xl font-bold text-white shadow-lg shadow-violet-500/20 sm:h-28 sm:w-28">
                  {displayName.slice(0, 2).toUpperCase()}
                </div>
              )}

              <div className="absolute -bottom-2 -right-2 flex gap-2">
                {avatarUrl && (
                  <button
                    onClick={handlePhotoDelete}
                    disabled={uploading}
                    className="inline-flex cursor-pointer items-center justify-center rounded-full border border-red-500/40 bg-zinc-900 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-red-200 shadow-lg shadow-red-500/10 transition hover:border-red-400 hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {uploading ? "..." : "Delete"}
                  </button>
                )}
                <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-violet-500/40 bg-zinc-900 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-200 shadow-lg shadow-violet-500/10 transition hover:border-violet-400 hover:bg-zinc-800">
                  {uploading ? "Saving..." : "Photo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                </label>
              </div>
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-bold text-white sm:text-3xl">
                  {displayName}
                </h2>
                <span className="rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-violet-200">
                  Member
                </span>
              </div>
              <p className="text-zinc-300">{email}</p>
              <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
                <span>
                  Joined{" "}
                  {formatEuropeanDate(
                    new Date(user.created_at ?? "1970-01-01T00:00:00.000Z"),
                  )}
                </span>
                {loadingHistory ? (
                  <span>Loading stats...</span>
                ) : (
                  <span>{stats.totalEntries} watch entries</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
              Total entries
            </p>
            {loadingHistory ? (
              <div className="mt-3 flex items-center gap-2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-500" />
              </div>
            ) : (
              <p className="mt-3 text-3xl font-bold text-white">
                {stats.totalEntries}
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
              Movies watched
            </p>
            {loadingHistory ? (
              <div className="mt-3 flex items-center gap-2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-500" />
              </div>
            ) : (
              <p className="mt-3 text-3xl font-bold text-white">
                {stats.uniqueMovies}
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
              TV shows
            </p>
            {loadingHistory ? (
              <div className="mt-3 flex items-center gap-2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-500" />
              </div>
            ) : (
              <p className="mt-3 text-3xl font-bold text-white">
                {stats.uniqueTvShows}
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
              Episodes logged
            </p>
            {loadingHistory ? (
              <div className="mt-3 flex items-center gap-2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-500" />
              </div>
            ) : (
              <p className="mt-3 text-3xl font-bold text-white">
                {stats.episodeEntries}
              </p>
            )}
          </div>
        </div>

        <div className="mt-8 w-full rounded-3xl border border-zinc-800 bg-zinc-900/80 p-6">
          <div className="mb-6 flex items-center justify-between gap-3">
            <h3 className="text-xl font-bold text-white">Recap</h3>
            <span className="rounded-full border border-violet-500/40 bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-violet-200">
              {selectedYear ? selectedYear : "All time"}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
                Most watched title
              </p>
              <p className="mt-3 text-lg font-semibold text-violet-200">
                {stats.topTitle ? stats.topTitle[0] : "No data yet"}
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                {stats.topTitle
                  ? `${stats.topTitle[1]} entries`
                  : "Start tracking shows"}
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
                {selectedYear ? "Selected year" : "Best year"}
              </p>
              <p className="mt-3 text-lg font-semibold text-violet-200">
                {selectedYear
                  ? selectedYear
                  : stats.overallTopYear
                    ? stats.overallTopYear[0]
                    : "No data yet"}
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                {selectedYear
                  ? `${stats.totalEntries} entries`
                  : stats.overallTopYear
                    ? `${stats.overallTopYear[1]} entries`
                    : "No year yet"}
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
                Movie runtime
              </p>
              {loadingRuntime ? (
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-500" />
                  <p className="text-sm text-zinc-400">Loading...</p>
                </div>
              ) : (
                <>
                  <p className="mt-3 text-lg font-semibold text-violet-200">
                    {formatCompactDuration(runtimeStats.movieMinutes)}
                  </p>
                </>
              )}
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400">
                TV runtime
              </p>
              {loadingRuntime ? (
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-500" />
                  <p className="text-sm text-zinc-400">Loading...</p>
                </div>
              ) : (
                <>
                  <p className="mt-3 text-lg font-semibold text-violet-200">
                    {formatCompactDuration(runtimeStats.tvMinutes)}
                  </p>
                </>
              )}
            </div>
          </div>

          <div
            className={`mt-6 grid gap-6 ${
              selectedYear ? "xl:grid-cols-1" : "xl:grid-cols-[1.15fr_0.85fr]"
            }`}
          >
            {!selectedYear && (
              <div className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
                <h4 className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-300">
                  Year breakdown
                </h4>
                <div className="mt-4 overflow-x-auto pb-1">
                  <div className="flex min-w-[640px] items-end gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3 pt-5">
                    {stats.yearBreakdown.length === 0 ? (
                      <div className="w-full rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/40 p-4 text-sm text-zinc-400">
                        No watch activity yet.
                      </div>
                    ) : (
                      stats.yearBreakdown.map(([year, count]) => {
                        const maxCount = Math.max(
                          ...stats.yearBreakdown.map(([, value]) => value),
                          1,
                        );
                        const height = Math.max((count / maxCount) * 100, 8);
                        return (
                          <div
                            key={year}
                            className="flex w-full min-w-[52px] flex-col items-center justify-end gap-1.5"
                          >
                            <div className="flex h-36 w-full items-end justify-center rounded-t-xl bg-zinc-800 p-0.5">
                              <div
                                className="w-[52%] rounded-t-xl bg-violet-500 shadow-[0_0_16px_rgba(168,85,247,0.5)]"
                                style={{ height: `${height}%` }}
                              />
                            </div>
                            <div className="text-center">
                              <div className="text-xs font-semibold text-zinc-300">
                                {year}
                              </div>
                              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                                {count}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            <div
              className={`min-w-0 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4 ${
                selectedYear ? "xl:col-span-1" : ""
              }`}
            >
              <h4 className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-300">
                Top titles
              </h4>
              <div className="mt-4 overflow-x-auto pb-1">
                <div className="flex min-w-[640px] items-end gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3 pt-5">
                  {stats.titleBreakdown.length === 0 ? (
                    <div className="w-full rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/40 p-4 text-sm text-zinc-400">
                      No titles yet.
                    </div>
                  ) : (
                    stats.titleBreakdown.map(([title, count], index) => {
                      const maxCount = Math.max(
                        ...stats.titleBreakdown.map(([, value]) => value),
                        1,
                      );
                      const height = Math.max((count / maxCount) * 100, 8);
                      return (
                        <div
                          key={`${title}-${index}`}
                          className="flex w-full min-w-[56px] flex-col items-center justify-end gap-1.5"
                        >
                          <div className="flex h-36 w-full items-end justify-center rounded-t-xl bg-zinc-800 p-0.5">
                            <div
                              className="w-[58%] rounded-t-xl bg-violet-500 shadow-[0_0_16px_rgba(168,85,247,0.5)]"
                              style={{ height: `${height}%` }}
                            />
                          </div>
                          <div className="text-center">
                            <div
                              className="max-w-[70px] truncate text-[10px] font-medium text-zinc-300"
                              title={title}
                            >
                              {title}
                            </div>
                            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                              {count}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-6">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-300">
                  Watch time by day
                </h4>
              </div>
              <div className="overflow-x-auto pb-1">
                <div className="flex min-w-[640px] items-end gap-2.5 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3 pt-5">
                  {stats.dayOfWeekStats.length === 0 ? (
                    <div className="w-full rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/40 p-4 text-sm text-zinc-400">
                      No data yet.
                    </div>
                  ) : (
                    stats.dayOfWeekStats.map(([day, count]) => {
                      const dayNames = [
                        "Monday",
                        "Tuesday",
                        "Wednesday",
                        "Thursday",
                        "Friday",
                        "Saturday",
                        "Sunday",
                      ];
                      const maxCount = Math.max(
                        ...stats.dayOfWeekStats.map(([, c]) => c),
                        1,
                      );
                      const height = Math.max((count / maxCount) * 100, 8);
                      return (
                        <div
                          key={day}
                          className="flex w-full min-w-[70px] flex-col items-center justify-end gap-1.5"
                        >
                          <div className="flex h-32 w-full items-end justify-center rounded-t-xl bg-zinc-800 p-0.5">
                            <div
                              className="w-[58%] rounded-t-xl bg-violet-500 shadow-[0_0_16px_rgba(168,85,247,0.5)]"
                              style={{ height: `${height}%` }}
                            />
                          </div>
                          <div className="text-center">
                            <div className="text-xs font-medium text-zinc-300">
                              {dayNames[day]}
                            </div>
                            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                              {count}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-300">
                  Watch time by hour
                </h4>
              </div>
              <div className="overflow-x-auto pb-1">
                <div className="min-w-[960px] rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3 pt-5">
                  <div className="flex h-[220px] w-full items-end gap-1.5">
                    {stats.hourOfDayStats.length === 0 ? (
                      <div className="w-full rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/40 p-4 text-sm text-zinc-400">
                        No data yet.
                      </div>
                    ) : (
                      stats.hourOfDayStats.map(([hour, count]) => {
                        const maxCount = Math.max(
                          ...stats.hourOfDayStats.map(([, c]) => c),
                          1,
                        );
                        const height = Math.max((count / maxCount) * 100, 8);
                        const formattedHour = `${hour.toString().padStart(2, "0")}:00`;
                        return (
                          <div
                            key={hour}
                            className="flex h-full w-full min-w-[34px] flex-col items-center justify-end gap-1.5"
                          >
                            <div className="flex h-full w-full items-end justify-center rounded-t-xl bg-zinc-800 p-0.5">
                              <div
                                className="w-[60%] rounded-t-xl bg-violet-500 shadow-[0_0_16px_rgba(168,85,247,0.5)]"
                                style={{ height: `${height}%` }}
                              />
                            </div>
                            <div className="text-center">
                              <div className="text-[10px] font-medium text-zinc-300">
                                {formattedHour}
                              </div>
                              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                                {count}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div
            id="delete-photo-modal"
            className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 max-w-sm w-full mx-4 shadow-2xl"
          >
            <h3 className="text-lg font-semibold text-white mb-2">
              Remove profile picture?
            </h3>
            <p className="text-zinc-300 mb-6">
              Are you sure you want to remove your profile picture? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20"
              >
                Cancel
              </button>
              <button
                onClick={confirmPhotoDelete}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition cursor-pointer"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
