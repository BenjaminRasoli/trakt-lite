"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  useParams,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useSupabase } from "@/components/supabase-provider";
import {
  getMediaDetails,
  getPosterUrl,
  getTVSeasonDetails,
  getMediaTitle,
} from "@/lib/tmdb";

export default function EpisodePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [show, setShow] = useState<any>(null);
  const [season, setSeason] = useState<any>(null);
  const [episode, setEpisode] = useState<any>(null);
  const [watchHistory, setWatchHistory] = useState<any[]>([]);
  const [watchDate, setWatchDate] = useState("");
  const [watchTime, setWatchTime] = useState("");
  const [watchOption, setWatchOption] = useState<
    "justWatched" | "releaseDate" | "unknownDate" | "otherDate"
  >("justWatched");
  const [addingWatch, setAddingWatch] = useState(false);
  const [showWatchDialog, setShowWatchDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [watchToDelete, setWatchToDelete] = useState<string | null>(null);
  const supabase = useSupabase();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const mediaId = Number(params.id);
  const seasonNumber = Number(params.season);
  const episodeNumber = Number(params.episode);
  const mediaType = (searchParams.get("type") as "movie" | "tv") || "tv";

  const title = useMemo(() => show ? getMediaTitle(show) : "Unknown", [show]);
  const posterUrl = useMemo(() => getPosterUrl(show?.poster_path, "w500"), [show?.poster_path]);
  const stillUrl = useMemo(() => getPosterUrl(episode?.still_path, "original"), [episode?.still_path]);
  const backdropUrl = useMemo(() => getPosterUrl(show?.backdrop_path, "original"), [show?.backdrop_path]);

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

    const fetchEpisodeData = async () => {
      try {
        const [series, seasonDetails] = await Promise.all([
          getMediaDetails(mediaId, mediaType),
          getTVSeasonDetails(mediaId, seasonNumber),
        ]);

        setShow(series);
        setSeason(seasonDetails);

        const episodeData = seasonDetails?.episodes?.find(
          (ep: any) => ep.episode_number === episodeNumber,
        );
        setEpisode(episodeData);
      } catch (error) {
        console.error("Error loading episode data:", error);
        setShow(null);
        setSeason(null);
        setEpisode(null);
      } finally {
        setDataLoaded(true);
      }
    };

    void fetchEpisodeData();
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

  const handleDeleteWatch = async (watchId: string) => {
    setWatchToDelete(watchId);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteWatch = async () => {
    if (!watchToDelete) return;

    try {
      const response = await fetch(`/api/watch-history/${watchToDelete}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setWatchHistory(watchHistory.filter((w) => w.id !== watchToDelete));
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
          <h1 className="text-2xl font-bold text-white mb-4">Episode Not Found</h1>
          <p className="text-zinc-400 mb-6">The episode you're looking for could not be loaded.</p>
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
            <div className="flex items-center gap-3">
              <Link
                href={`/media/${mediaId}/season/${seasonNumber}?type=tv`}
                className="rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-violet-500/60 hover:text-violet-200"
              >
                Back to season
              </Link>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300">
                  <span
                    onClick={handleTitleClick}
                    className="hover:underline hover:text-violet-200 transition-colors cursor-pointer"
                  >
                    {title}
                  </span>
                </p>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">
                  Season {seasonNumber} Episode {episodeNumber}
                </h1>
              </div>
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

              <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-4">
                <span className="text-zinc-400 text-sm sm:text-base">
                  {episode.air_date
                    ? new Date(episode.air_date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Air date unknown"}
                </span>

                {episode.runtime && (
                  <span className="text-zinc-400 text-sm sm:text-base">
                    {episode.runtime} min
                  </span>
                )}
              </div>

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
                        className="flex sm:flex-row sm:items-center justify-between gap-2 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-zinc-300 text-sm break-words">
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
                          onClick={() => handleDeleteWatch(watch.id)}
                          className="px-3 py-1 cursor-pointer text-red-400 hover:text-red-300 text-sm whitespace-nowrap self-end sm:self-center"
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
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-white mb-2">
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
                  <span className="text-zinc-300">Just watched</span>
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
                  <span className="text-zinc-300">Release date</span>
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
                  <span className="text-zinc-300">
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
                  <span className="text-zinc-300">Other date</span>
                </label>
              </div>

              {watchOption === "otherDate" && (
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-zinc-300 mb-2">Date</label>
                    <input
                      type="date"
                      value={watchDate}
                      onChange={(e) => setWatchDate(e.target.value)}
                      className="w-full px-4 py-2 bg-zinc-800 border border-zinc-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-300 mb-2">Time</label>
                    <input
                      type="time"
                      value={watchTime}
                      onChange={(e) => setWatchTime(e.target.value)}
                      className="w-full px-4 py-2 bg-zinc-800 border border-zinc-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                      required
                    />
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
            <p className="text-zinc-300 mb-6">
              Do you really want to remove this watch history entry?
            </p>
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
