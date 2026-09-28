"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useSupabase } from "@/components/supabase-provider";
import {
  getMediaDetails,
  getPosterUrl,
  getTVSeasonDetails,
  getMediaTitle,
} from "@/lib/tmdb";

export default function SeasonPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState<any>(null);
  const [season, setSeason] = useState<any>(null);
  const [watchHistory, setWatchHistory] = useState<any[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<any>(null);
  const [watchDate, setWatchDate] = useState("");
  const [watchTime, setWatchTime] = useState("");
  const [watchOption, setWatchOption] = useState<
    "justWatched" | "releaseDate" | "unknownDate" | "otherDate"
  >("justWatched");
  const [addingWatch, setAddingWatch] = useState(false);
  const supabase = useSupabase();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const mediaId = Number(params.id);
  const seasonNumber = Number(params.season);
  const mediaType = (searchParams.get("type") as "movie" | "tv") || "tv";
  const modalOpen = Boolean(selectedEpisode);

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
    if (!mediaId || !seasonNumber) return;

    const fetchSeasonData = async () => {
      try {
        const [series, seasonDetails] = await Promise.all([
          getMediaDetails(mediaId, mediaType),
          getTVSeasonDetails(mediaId, seasonNumber),
        ]);

        setShow(series);
        setSeason(seasonDetails);
      } catch (error) {
        console.error("Error loading season data:", error);
      }
    };

    void fetchSeasonData();
  }, [mediaId, mediaType, seasonNumber]);

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
    document.body.style.overflow = modalOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [modalOpen]);

  useEffect(() => {
    if (!modalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeWatchModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalOpen]);

  const openWatchModal = (episode: any) => {
    const existingHistory = watchHistory
      .filter(
        (watch) =>
          watch.seasonNumber === seasonNumber &&
          watch.episodeNumber === episode.episode_number,
      )
      .sort(
        (a, b) =>
          new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime(),
      );

    const latestDate = existingHistory[0]?.watchedAt
      ? new Date(existingHistory[0].watchedAt).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    setSelectedEpisode(episode);
    setWatchOption("justWatched");
    setWatchDate(latestDate);
    setWatchTime("12:00");
  };

  const closeWatchModal = () => {
    setSelectedEpisode(null);
    setWatchDate("");
    setWatchTime("");
    setWatchOption("justWatched");
    setAddingWatch(false);
  };

  const handleSaveEpisodeWatch = async () => {
    if (!user || !selectedEpisode) return;

    setAddingWatch(true);

    try {
      let watchedAt: Date;

      switch (watchOption) {
        case "justWatched":
          watchedAt = new Date();
          break;
        case "releaseDate": {
          const releaseDate = show?.first_air_date || show?.release_date;
          watchedAt = releaseDate ? new Date(releaseDate) : new Date();
          break;
        }
        case "unknownDate":
          watchedAt = new Date("1990-01-01T00:00:00");
          break;
        case "otherDate":
          if (!watchDate || !watchTime) {
            return;
          }
          watchedAt = new Date(`${watchDate}T${watchTime}`);
          break;
        default:
          watchedAt = new Date();
      }

      const response = await fetch("/api/watch-history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mediaId,
          mediaType,
          seasonNumber,
          episodeNumber: selectedEpisode.episode_number,
          episodeName: selectedEpisode.name,
          watchedAt: watchedAt.toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to save watch state");
      }

      const updated = await response.json();
      setWatchHistory((current) => {
        if (current.some((item) => item.id === updated.id)) {
          return current;
        }
        return [...current, updated];
      });
      closeWatchModal();
    } catch (error) {
      console.error("Error saving episode watch state:", error);
    } finally {
      setAddingWatch(false);
    }
  };

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

  if (!user) {
    router.push("/auth");
    return null;
  }

  if (!show || !season) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        Season not found
      </div>
    );
  }

  const title = getMediaTitle(show);
  const posterUrl = getPosterUrl(show.poster_path, "w500");

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="mx-auto w-full max-w-[1650px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/media/${mediaId}?type=tv`}
              className="rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-violet-500/60 hover:text-violet-200"
            >
              Back to show
            </Link>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300">
                {title}
              </p>
              <h1 className="text-3xl font-bold text-white">
                Season {seasonNumber}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={
                seasonNumber > 1
                  ? `/media/${mediaId}/season/${seasonNumber - 1}?type=tv`
                  : "#"
              }
              aria-disabled={seasonNumber <= 1}
              className={`inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                seasonNumber > 1
                  ? "border-violet-500/40 bg-violet-500/10 text-violet-100 hover:border-violet-400 hover:bg-violet-500/20"
                  : "pointer-events-none cursor-not-allowed border-zinc-700 bg-zinc-800 text-zinc-500"
              }`}
            >
              ← Previous season
            </Link>
            <Link
              href={
                show?.number_of_seasons && seasonNumber < show.number_of_seasons
                  ? `/media/${mediaId}/season/${seasonNumber + 1}?type=tv`
                  : "#"
              }
              aria-disabled={
                !show?.number_of_seasons ||
                seasonNumber >= show.number_of_seasons
              }
              className={`inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                show?.number_of_seasons && seasonNumber < show.number_of_seasons
                  ? "border-violet-500/40 bg-violet-500/10 text-violet-100 hover:border-violet-400 hover:bg-violet-500/20"
                  : "pointer-events-none cursor-not-allowed border-zinc-700 bg-zinc-800 text-zinc-500"
              }`}
            >
              Next season →
            </Link>
          </div>
        </div>

        <div className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 md:flex md:items-center md:gap-5">
          <img
            src={posterUrl}
            alt={title}
            className="h-28 w-20 rounded-lg object-cover shadow-xl shadow-violet-500/10"
            onError={(e) => {
              e.currentTarget.src = "/placeholder-poster.svg";
            }}
          />
          <div>
            <p className="text-sm text-zinc-400">
              {season.air_date || "Air date unknown"}
            </p>
            <h2 className="text-xl font-semibold text-white">
              {season.name || `Season ${seasonNumber}`}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-300">
              {season.overview || "No season overview is available yet."}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {season.episodes?.map((episode: any) => {
            const episodeHistory = watchHistory
              .filter(
                (watch) =>
                  watch.seasonNumber === seasonNumber &&
                  watch.episodeNumber === episode.episode_number,
              )
              .sort(
                (a, b) =>
                  new Date(a.watchedAt).getTime() -
                  new Date(b.watchedAt).getTime(),
              );

            return (
              <div
                key={`${seasonNumber}-${episode.episode_number}`}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start">
                  <div className="w-full md:w-36">
                    {episode.still_path ? (
                      <img
                        src={getPosterUrl(episode.still_path, "w500")}
                        alt={episode.name}
                        className="h-24 w-full rounded-lg object-cover"
                        onError={(e) => {
                          e.currentTarget.src = "/placeholder-poster.svg";
                        }}
                      />
                    ) : (
                      <div className="flex h-24 w-full items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 text-sm text-zinc-400">
                        No image
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300">
                      <span>E{episode.episode_number}</span>
                      {episode.vote_average != null && (
                        <span className="text-yellow-400">
                          ★ {Number(episode.vote_average).toFixed(1)}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xl font-semibold text-white">
                          {episode.name || `Episode ${episode.episode_number}`}
                        </h3>
                        <p className="mt-1 text-sm text-zinc-400">
                          {episode.runtime
                            ? `${episode.runtime} min`
                            : "Runtime unknown"}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => openWatchModal(episode)}
                        className="inline-flex cursor-pointer items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:border-violet-500/50 hover:text-violet-200"
                      >
                        Mark as watched
                      </button>
                    </div>

                    <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                      {episode.overview ||
                        "No episode summary is available for this one."}
                    </p>

                    <div className="mt-4 rounded-xl border border-zinc-700/60 bg-zinc-800/40 p-3">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                        Watch state
                      </p>

                      {episodeHistory.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {episodeHistory.map((watch) => (
                            <span
                              key={watch.id}
                              className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.15em] text-emerald-300"
                            >
                              Watched{" "}
                              {new Date(watch.watchedAt).toLocaleDateString()}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-zinc-400">
                          Not marked as watched yet.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {selectedEpisode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeWatchModal();
            }
          }}
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 p-6">
            <h2 className="mb-4 text-2xl font-bold text-white">
              Mark Episode as Watched
            </h2>

            <div className="space-y-3 mb-6">
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-3 transition hover:bg-zinc-800">
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
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-3 transition hover:bg-zinc-800">
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
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-3 transition hover:bg-zinc-800">
                <input
                  type="radio"
                  name="watchOption"
                  value="unknownDate"
                  checked={watchOption === "unknownDate"}
                  onChange={(e) => setWatchOption(e.target.value as any)}
                  className="cursor-pointer"
                />
                <span className="text-zinc-300">Unknown date (01-01-1990)</span>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-3 transition hover:bg-zinc-800">
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
              <div className="mb-6 space-y-4">
                <div>
                  <label className="mb-2 block text-zinc-300">Date</label>
                  <input
                    type="date"
                    value={watchDate}
                    onChange={(e) => setWatchDate(e.target.value)}
                    className="w-full rounded border border-zinc-600 bg-zinc-800 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-zinc-300">Time</label>
                  <input
                    type="time"
                    value={watchTime}
                    onChange={(e) => setWatchTime(e.target.value)}
                    className="w-full rounded border border-zinc-600 bg-zinc-800 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                    required
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeWatchModal}
                className="flex-1 cursor-pointer rounded bg-zinc-700 px-4 py-2 text-white transition hover:bg-zinc-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEpisodeWatch}
                disabled={addingWatch}
                className="flex-1 cursor-pointer rounded bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-white transition hover:from-violet-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {addingWatch ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
