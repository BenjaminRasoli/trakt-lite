"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSupabase } from "@/components/supabase-provider";
import UserRating from "@/components/user-rating";
import {
  getMediaDetails,
  getPosterUrl,
  getTVSeasonDetails,
  getMediaTitle,
  getTVEpisodeAirTime,
} from "@/lib/tmdb";

interface EpisodeNavigationTarget {
  seasonNumber: number;
  episodeNumber: number;
}

async function getAdjacentEpisodeTarget(
  mediaId: number,
  showSeasons: Array<{ season_number: number }>,
  currentSeasonEpisodes: Array<{ episode_number: number }>,
  seasonNumber: number,
  episodeNumber: number,
  direction: "previous" | "next",
): Promise<EpisodeNavigationTarget | null> {
  const sameSeasonEpisodes = currentSeasonEpisodes
    .filter((item) =>
      direction === "previous"
        ? item.episode_number < episodeNumber
        : item.episode_number > episodeNumber,
    )
    .sort((a, b) => a.episode_number - b.episode_number);
  const sameSeasonEpisode =
    direction === "previous"
      ? sameSeasonEpisodes[sameSeasonEpisodes.length - 1]
      : sameSeasonEpisodes[0];

  if (sameSeasonEpisode) {
    return {
      seasonNumber,
      episodeNumber: sameSeasonEpisode.episode_number,
    };
  }

  const seasonNumbers = Array.from(
    new Set(
      showSeasons
        .map((item) => item.season_number)
        .filter((number) => Number.isInteger(number) && number > 0),
    ),
  ).sort((a, b) => a - b);
  const adjacentSeasonNumber =
    direction === "previous"
      ? [...seasonNumbers].reverse().find((number) => number < seasonNumber)
      : seasonNumbers.find((number) => number > seasonNumber);

  if (adjacentSeasonNumber === undefined) return null;

  const adjacentSeason = await getTVSeasonDetails(
    mediaId,
    adjacentSeasonNumber,
  );
  const adjacentEpisodes = [...(adjacentSeason?.episodes ?? [])].sort(
    (a, b) => a.episode_number - b.episode_number,
  );
  const adjacentEpisode =
    direction === "previous"
      ? adjacentEpisodes[adjacentEpisodes.length - 1]
      : adjacentEpisodes[0];

  return adjacentEpisode
    ? {
        seasonNumber: adjacentSeasonNumber,
        episodeNumber: adjacentEpisode.episode_number,
      }
    : null;
}

export default function EpisodePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [show, setShow] = useState<any>(null);
  const [season, setSeason] = useState<any>(null);
  const [episode, setEpisode] = useState<any>(null);
  const [episodeAirTime, setEpisodeAirTime] = useState<string | null>(null);
  const [previousEpisodeTarget, setPreviousEpisodeTarget] =
    useState<EpisodeNavigationTarget | null>(null);
  const [nextEpisodeTarget, setNextEpisodeTarget] =
    useState<EpisodeNavigationTarget | null>(null);
  const [watchHistory, setWatchHistory] = useState<any[]>([]);
  const [watchDate, setWatchDate] = useState("");
  const [watchTime, setWatchTime] = useState("");
  const [watchOption, setWatchOption] = useState<
    "justWatched" | "releaseDate" | "unknownDate" | "otherDate"
  >("justWatched");
  const [addingWatch, setAddingWatch] = useState(false);
  const [showWatchDialog, setShowWatchDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [watchToDelete, setWatchToDelete] = useState<any | null>(null);
  const supabase = useSupabase();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const mediaId = Number(params.id);
  const seasonNumber = Number(params.season);
  const episodeNumber = Number(params.episode);
  const mediaType = (searchParams.get("type") as "movie" | "tv") || "tv";

  const title = useMemo(() => (show ? getMediaTitle(show) : "Unknown"), [show]);
  const posterUrl = useMemo(
    () => getPosterUrl(show?.poster_path, "w500"),
    [show?.poster_path],
  );
  const stillUrl = useMemo(
    () => getPosterUrl(episode?.still_path, "original"),
    [episode?.still_path],
  );
  const backdropUrl = useMemo(
    () => getPosterUrl(show?.backdrop_path, "original"),
    [show?.backdrop_path],
  );

  const episodeHistory = useMemo(
    () =>
      watchHistory
        .filter(
          (watch) =>
            watch.seasonNumber === seasonNumber &&
            watch.episodeNumber === episodeNumber,
        )
        .sort(
          (a, b) =>
            new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime(),
        ),
    [watchHistory, seasonNumber, episodeNumber],
  );

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/media/${mediaId}?type=tv`);
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

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!mediaId || !seasonNumber || !episodeNumber) return;

    let isCurrent = true;
    const fetchEpisodeData = async () => {
      setDataLoaded(false);
      setEpisodeAirTime(null);
      setPreviousEpisodeTarget(null);
      setNextEpisodeTarget(null);

      try {
        const [series, seasonDetails] = await Promise.all([
          getMediaDetails(mediaId, mediaType),
          getTVSeasonDetails(mediaId, seasonNumber),
        ]);
        if (!isCurrent) return;

        setShow(series);
        setSeason(seasonDetails);

        const episodeData = seasonDetails?.episodes?.find(
          (ep) => ep.episode_number === episodeNumber,
        );
        setEpisode(episodeData);
        setDataLoaded(true);

        if (episodeData) {
          try {
            const [previousTarget, nextTarget, airTime] = await Promise.all([
              getAdjacentEpisodeTarget(
                mediaId,
                series?.seasons ?? [],
                seasonDetails?.episodes ?? [],
                seasonNumber,
                episodeNumber,
                "previous",
              ),
              getAdjacentEpisodeTarget(
                mediaId,
                series?.seasons ?? [],
                seasonDetails?.episodes ?? [],
                seasonNumber,
                episodeNumber,
                "next",
              ),
              getTVEpisodeAirTime(mediaId, seasonNumber, episodeNumber),
            ]);
            if (!isCurrent) return;
            setPreviousEpisodeTarget(previousTarget);
            setNextEpisodeTarget(nextTarget);
            setEpisodeAirTime(airTime);
          } catch (error) {
            if (isCurrent) {
              console.error("Error loading episode navigation:", error);
            }
          }
        }
      } catch (error) {
        if (!isCurrent) return;
        console.error("Error loading episode data:", error);
        setShow(null);
        setSeason(null);
        setEpisode(null);
        setPreviousEpisodeTarget(null);
        setNextEpisodeTarget(null);
      } finally {
        if (isCurrent) setDataLoaded(true);
      }
    };

    void fetchEpisodeData();

    return () => {
      isCurrent = false;
    };
  }, [mediaId, mediaType, seasonNumber, episodeNumber]);

  useEffect(() => {
    const fetchWatchHistory = async () => {
      if (!user) return;

      try {
        const response = await fetch(`/api/watch-history?mediaId=${mediaId}`);
        if (!response.ok) {
          setWatchHistory([]);
          return;
        }

        const data = await response.json();
        const watchHistoryData = Array.isArray(data.items)
          ? data.items
          : Array.isArray(data)
            ? data
            : [];
        setWatchHistory(watchHistoryData);
      } catch (error) {
        console.error("Error fetching watch history:", error);
        setWatchHistory([]);
      }
    };

    void fetchWatchHistory();
  }, [user, mediaId]);

  useEffect(() => {
    const isAnyModalOpen = showWatchDialog || showDeleteConfirm;
    document.body.style.overflow = isAnyModalOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [showWatchDialog, showDeleteConfirm]);

  useEffect(() => {
    if (!showWatchDialog && !showDeleteConfirm) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false);
          setWatchToDelete(null);
          return;
        }

        if (showWatchDialog) {
          setShowWatchDialog(false);
          setWatchOption("justWatched");
          setWatchDate("");
          setWatchTime("");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showWatchDialog, showDeleteConfirm]);

  const handleAddWatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !episode) return;

    setAddingWatch(true);
    let watchedAt: Date;

    switch (watchOption) {
      case "justWatched":
        watchedAt = new Date();
        break;
      case "releaseDate": {
        const releaseDate = episode.air_date || show?.first_air_date;
        watchedAt = releaseDate ? new Date(releaseDate) : new Date();
        break;
      }
      case "unknownDate":
        watchedAt = new Date("1990-01-01T00:00:00");
        break;
      case "otherDate":
        if (!watchDate || !watchTime) return;
        watchedAt = new Date(`${watchDate}T${watchTime}`);
        break;
      default:
        watchedAt = new Date();
    }

    try {
      const response = await fetch("/api/watch-history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mediaId,
          mediaType,
          seasonNumber,
          episodeNumber,
          episodeName: episode.name,
          watchedAt: watchedAt.toISOString(),
        }),
      });

      if (response.ok) {
        const newEntry = await response.json();
        setWatchHistory([...watchHistory, newEntry]);
        setShowWatchDialog(false);
        setWatchDate("");
        setWatchTime("");
        setWatchOption("justWatched");
      }
    } catch (error) {
      console.error("Error adding watch history:", error);
    } finally {
      setAddingWatch(false);
    }
  };

  const handleDeleteWatch = (watch: any) => {
    setWatchToDelete(watch);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteWatch = async () => {
    if (!watchToDelete) return;

    try {
      const response = await fetch(`/api/watch-history/${watchToDelete.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setWatchHistory(watchHistory.filter((w) => w.id !== watchToDelete.id));
      }
    } catch (error) {
      console.error("Error deleting watch history:", error);
    } finally {
      setShowDeleteConfirm(false);
      setWatchToDelete(null);
    }
  };

  if (loading || !dataLoaded) {
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

  if (!show || !season || !episode) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-black font-sans">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">
            Episode Not Found
          </h1>
          <p className="text-zinc-400 mb-6">
            The episode you're looking for could not be loaded.
          </p>
          <button
            onClick={() => router.push("/")}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 shadow-lg shadow-violet-500/10 transition hover:border-violet-400 hover:bg-violet-500/20"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `
        linear-gradient(
          180deg,
          rgba(2,6,23,0.75),
          rgba(2,6,23,0.96)
        ),
        url(${backdropUrl})
      `,
          backgroundPosition: "center -55%",
        }}
      />

      <div className="fixed inset-0 z-0 bg-black/10 pointer-events-none" />

      <div className="relative z-10 min-h-screen">
        <main className="w-full max-w-[1650px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
              <Link
                href={`/media/${mediaId}/season/${seasonNumber}?type=tv`}
                className="shrink-0 rounded-full border border-zinc-700 bg-zinc-900/60 px-2.5 py-1.5 text-xs text-zinc-200 transition hover:border-violet-500/60 hover:text-violet-200 sm:px-3 sm:text-sm"
              >
                Back to season
              </Link>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300">
                  <span
                    onClick={handleTitleClick}
                    className="block truncate hover:underline hover:text-violet-200 transition-colors cursor-pointer"
                  >
                    {title}
                  </span>
                </p>
                <h1 className="text-xl font-bold text-white sm:text-3xl">
                  Season {seasonNumber} Episode {episodeNumber}
                </h1>
              </div>
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <Link
                href={
                  previousEpisodeTarget
                    ? `/media/${mediaId}/season/${previousEpisodeTarget.seasonNumber}/episode/${previousEpisodeTarget.episodeNumber}?type=tv`
                    : "#"
                }
                aria-disabled={!previousEpisodeTarget}
                onClick={(event) => {
                  if (!previousEpisodeTarget) event.preventDefault();
                }}
                className={`inline-flex min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-full border px-2 py-1.5 text-[11px] font-medium transition sm:flex-none sm:px-3 sm:text-sm ${
                  previousEpisodeTarget
                    ? "border-violet-500/40 bg-violet-500/10 text-violet-100 hover:border-violet-400 hover:bg-violet-500/20"
                    : "cursor-not-allowed border-zinc-700 bg-zinc-800 text-zinc-500"
                }`}
              >
                <span className="sm:hidden">← Prev episode</span>
                <span className="hidden sm:inline">← Previous episode</span>
              </Link>
              <Link
                href={
                  nextEpisodeTarget
                    ? `/media/${mediaId}/season/${nextEpisodeTarget.seasonNumber}/episode/${nextEpisodeTarget.episodeNumber}?type=tv`
                    : "#"
                }
                aria-disabled={!nextEpisodeTarget}
                onClick={(event) => {
                  if (!nextEpisodeTarget) event.preventDefault();
                }}
                className={`inline-flex min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-full border px-2 py-1.5 text-[11px] font-medium transition sm:flex-none sm:px-3 sm:text-sm ${
                  nextEpisodeTarget
                    ? "border-violet-500/40 bg-violet-500/10 text-violet-100 hover:border-violet-400 hover:bg-violet-500/20"
                    : "cursor-not-allowed border-zinc-700 bg-zinc-800 text-zinc-500"
                }`}
              >
                <span className="sm:hidden">Next episode →</span>
                <span className="hidden sm:inline">Next episode →</span>
              </Link>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-6 md:gap-8 mb-8">
            <div className="w-full md:w-1/3 flex-shrink-0 max-w-[400px]">
              <div className="aspect-video w-full max-h-[300px] rounded-lg overflow-hidden bg-zinc-800">
                {stillUrl ? (
                  <img
                    src={stillUrl}
                    alt={episode.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "/placeholder-poster.svg";
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-400 text-sm">
                    No image available
                  </div>
                )}
              </div>
            </div>

            <div className="w-full md:w-2/3">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-1 bg-violet-600 text-white text-xs font-semibold rounded uppercase">
                  TV
                </span>
                {episode.vote_average != null && (
                  <span className="px-2 py-1 bg-zinc-700 text-zinc-300 text-xs rounded">
                    ★ {Number(episode.vote_average).toFixed(1)}
                  </span>
                )}
              </div>

              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
                {episode.name || `Episode ${episodeNumber}`}
              </h2>

              <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 mb-4">
                <span className="text-zinc-400 text-sm sm:text-base">
                  {episode.air_date
                    ? new Date(episode.air_date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Air date unknown"}
                  {episodeAirTime ? ` at ${episodeAirTime}` : ""}
                </span>

                {episode.runtime && (
                  <>
                    <span className="text-zinc-500 text-sm sm:text-base leading-none">
                      ·
                    </span>
                    <span className="text-zinc-400 text-sm sm:text-base">
                      {episode.runtime} min
                    </span>
                  </>
                )}
              </div>

              <UserRating
                tmdbId={mediaId}
                mediaType="tv"
                title={`${title} - ${episode.name || `Episode ${episodeNumber}`}`}
                seasonNumber={seasonNumber}
                episodeNumber={episodeNumber}
                watched={episodeHistory.length > 0}
              />

              {episode.overview && (
                <div className="mb-6">
                  <h3 className="text-lg sm:text-xl font-bold text-white mb-3">
                    Overview
                  </h3>
                  <p className="text-zinc-300 leading-relaxed text-sm sm:text-base">
                    {episode.overview}
                  </p>
                </div>
              )}

              <button
                onClick={() => setShowWatchDialog(true)}
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-semibold text-violet-100 shadow-lg shadow-violet-500/10 transition hover:border-violet-400 hover:bg-violet-500/20"
              >
                Mark as Watched
              </button>

              {episodeHistory.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-xl font-bold text-white mb-4">
                    Watch History
                  </h3>
                  <div className="space-y-2">
                    {episodeHistory.map((watch) => (
                      <div
                        key={watch.id}
                        className="flex min-w-0 items-center justify-between gap-1 rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-2 sm:gap-2 sm:p-3"
                      >
                        <div className="flex min-w-0 items-center">
                          <span className="whitespace-nowrap text-[11px] text-zinc-300 sm:text-sm">
                            Watched{" "}
                            {new Date(watch.watchedAt).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false,
                              },
                            )}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteWatch(watch)}
                          className="shrink-0 cursor-pointer whitespace-nowrap px-1 py-1 text-xs text-red-400 hover:text-red-300 sm:px-3 sm:text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {showWatchDialog && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowWatchDialog(false);
              setWatchOption("justWatched");
              setWatchDate("");
              setWatchTime("");
            }
          }}
        >
          <div className="min-w-0 w-full max-w-md max-h-[90vh] overflow-x-hidden overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 p-4 shadow-2xl sm:p-6">
            <h3 className="mb-2 text-base font-semibold text-white sm:text-lg">
              Mark Episode as Watched
            </h3>
            <form onSubmit={handleAddWatch}>
              <div className="space-y-3 mb-6">
                <label className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50 cursor-pointer hover:bg-zinc-800 transition-colors">
                  <input
                    type="radio"
                    name="watchOption"
                    value="justWatched"
                    checked={watchOption === "justWatched"}
                    onChange={(e) => setWatchOption(e.target.value as any)}
                    className="cursor-pointer"
                  />
                  <span className="min-w-0 text-sm text-zinc-300">
                    Just watched
                  </span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50 cursor-pointer hover:bg-zinc-800 transition-colors">
                  <input
                    type="radio"
                    name="watchOption"
                    value="releaseDate"
                    checked={watchOption === "releaseDate"}
                    onChange={(e) => setWatchOption(e.target.value as any)}
                    className="cursor-pointer"
                  />
                  <span className="min-w-0 text-sm text-zinc-300">
                    Release date
                  </span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50 cursor-pointer hover:bg-zinc-800 transition-colors">
                  <input
                    type="radio"
                    name="watchOption"
                    value="unknownDate"
                    checked={watchOption === "unknownDate"}
                    onChange={(e) => setWatchOption(e.target.value as any)}
                    className="cursor-pointer"
                  />
                  <span className="min-w-0 break-words text-sm text-zinc-300">
                    Unknown date (01-01-1990)
                  </span>
                </label>
                <label className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50 cursor-pointer hover:bg-zinc-800 transition-colors">
                  <input
                    type="radio"
                    name="watchOption"
                    value="otherDate"
                    checked={watchOption === "otherDate"}
                    onChange={(e) => setWatchOption(e.target.value as any)}
                    className="cursor-pointer"
                  />
                  <span className="min-w-0 text-sm text-zinc-300">
                    Other date
                  </span>
                </label>
              </div>

              {watchOption === "otherDate" && (
                <div className="mb-6 min-w-0 space-y-4">
                  <div className="min-w-0">
                    <label className="block text-zinc-300 mb-2">Date</label>
                    <div className="relative min-w-0">
                      <input
                        type="date"
                        value={watchDate}
                        onChange={(e) => setWatchDate(e.target.value)}
                        className="block w-full min-w-0 max-w-full appearance-none box-border rounded border border-zinc-600 bg-zinc-800 px-3 py-2 pr-11 text-base text-white focus:outline-none focus:ring-2 focus:ring-violet-500 [&::-webkit-calendar-picker-indicator]:opacity-0"
                        style={{
                          colorScheme: "dark",
                          width: "100%",
                          minWidth: 0,
                        }}
                        required
                      />
                      <svg
                        aria-hidden="true"
                        className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-violet-300"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.8}
                          d="M8 3v3m8-3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v12H4V7a2 2 0 0 1 2-2Z"
                        />
                      </svg>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <label className="block text-zinc-300 mb-2">Time</label>
                    <div className="relative min-w-0">
                      <input
                        type="time"
                        value={watchTime}
                        onChange={(e) => setWatchTime(e.target.value)}
                        className="block w-full min-w-0 max-w-full appearance-none box-border rounded border border-zinc-600 bg-zinc-800 px-3 py-2 pr-11 text-base text-white focus:outline-none focus:ring-2 focus:ring-violet-500 [&::-webkit-calendar-picker-indicator]:opacity-0"
                        style={{
                          colorScheme: "dark",
                          width: "100%",
                          minWidth: 0,
                        }}
                        required
                      />
                      <svg
                        aria-hidden="true"
                        className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-violet-300"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.8}
                          d="M12 7v5l3 2"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowWatchDialog(false);
                    setWatchOption("justWatched");
                    setWatchDate("");
                    setWatchTime("");
                  }}
                  className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingWatch}
                  className="px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  {addingWatch ? "Adding..." : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowDeleteConfirm(false);
              setWatchToDelete(null);
            }
          }}
        >
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-full max-w-sm mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-2">
              Are you sure?
            </h3>
            <p className="text-zinc-300 mb-4">
              Do you really want to remove this watch history entry?
            </p>
            {watchToDelete && (
              <div className="mb-6 rounded-lg border border-zinc-700 bg-zinc-800/60 p-3 text-sm text-zinc-300">
                <p className="font-semibold text-white">{title}</p>
                <p className="mt-1">
                  {watchToDelete.seasonNumber !== null &&
                  watchToDelete.episodeNumber !== null
                    ? `S${watchToDelete.seasonNumber} E${watchToDelete.episodeNumber}${watchToDelete.episodeName ? ` — ${watchToDelete.episodeName}` : ""}`
                    : "Full movie"}
                  {" · watched "}
                  {new Date(watchToDelete.watchedAt).toLocaleDateString(
                    "en-US",
                    {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                  )}
                </p>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setWatchToDelete(null);
                }}
                className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteWatch}
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
