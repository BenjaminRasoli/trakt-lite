"use client";

import { useState, useEffect } from "react";
import { useSupabase } from "@/components/supabase-provider";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import {
  getMediaDetails,
  getPosterUrl,
  getMediaTitle,
  getMediaDate,
  getMediaType,
  getMediaCredits,
  getMediaReviews,
  getMediaRecommendations,
  getProfileUrl,
  getTVSeasonDetails,
} from "@/lib/tmdb";
import type { TMDBMedia, TMDBActor, TMDBReview } from "@/lib/tmdb";
import MediaCard from "@/components/media-card";

export default function MediaDetailsPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [media, setMedia] = useState<TMDBMedia | null>(null);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [showWatchDialog, setShowWatchDialog] = useState(false);
  const [watchDate, setWatchDate] = useState("");
  const [watchTime, setWatchTime] = useState("");
  const [watchHistory, setWatchHistory] = useState<any[]>([]);
  const [addingWatch, setAddingWatch] = useState(false);
  const [watchOption, setWatchOption] = useState<
    "justWatched" | "releaseDate" | "unknownDate" | "otherDate"
  >("justWatched");
  const [showExpandedWatchHistory, setShowExpandedWatchHistory] =
    useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [watchToDelete, setWatchToDelete] = useState<string | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [selectedEpisode, setSelectedEpisode] = useState<number>(1);
  const [tvShowDetails, setTvShowDetails] = useState<any>(null);
  const [credits, setCredits] = useState<{
    cast: TMDBActor[];
    crew: any[];
  } | null>(null);
  const [reviews, setReviews] = useState<TMDBReview[]>([]);
  const [recommendations, setRecommendations] = useState<TMDBMedia[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(true);

  const supabase = useSupabase();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const mediaId = params.id as string;
  const mediaType = (searchParams.get("type") as "movie" | "tv") || "movie";

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    const fetchMediaDetails = async () => {
      const type = (searchParams.get("type") as "movie" | "tv") || "movie";
      setDetailsLoading(true);

      const [details, creditsData, reviewsData, recommendationsData] =
        await Promise.all([
          getMediaDetails(parseInt(mediaId), type),
          getMediaCredits(parseInt(mediaId), type),
          getMediaReviews(parseInt(mediaId), type),
          getMediaRecommendations(parseInt(mediaId), type),
        ]);

      setMedia(details);
      setCredits(creditsData);
      setReviews(reviewsData);
      setRecommendations(recommendationsData);

      if (type === "tv" && details?.number_of_seasons) {
        try {
          const seasonDetails = await Promise.all(
            Array.from(
              { length: details.number_of_seasons },
              (_, i) => i + 1,
            ).map((seasonNum) =>
              getTVSeasonDetails(parseInt(mediaId), seasonNum),
            ),
          );
          setTvShowDetails({ seasons: seasonDetails });
        } catch (error) {
          console.error("Error fetching TV show details:", error);
        }
      }

      setMediaLoading(false);
      setDetailsLoading(false);
    };

    fetchMediaDetails();
  }, [mediaId, searchParams]);

  useEffect(() => {
    const fetchWatchHistory = async () => {
      if (!user) return;

      try {
        const response = await fetch(`/api/watch-history?mediaId=${mediaId}`);
        if (!response.ok) {
          console.error("Error fetching watch history:", response.status);
          setWatchHistory([]);
          return;
        }
        const data = await response.json();
        const watchHistoryData = data.items || data; // Handle both formats
        setWatchHistory(watchHistoryData);
      } catch (error) {
        console.error("Error fetching watch history:", error);
        setWatchHistory([]);
      }
    };

    fetchWatchHistory();
  }, [user, mediaId]);

  const handleAddWatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setAddingWatch(true);
    let watchedAt: Date;

    switch (watchOption) {
      case "justWatched":
        watchedAt = new Date();
        break;
      case "releaseDate":
        const releaseDate = media?.release_date || media?.first_air_date;
        watchedAt = releaseDate ? new Date(releaseDate) : new Date();
        break;
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
          mediaId: parseInt(mediaId),
          mediaType,
          watchedAt: watchedAt.toISOString(),
          seasonNumber: mediaType === "tv" ? selectedSeason : null,
          episodeNumber: mediaType === "tv" ? selectedEpisode : null,
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

  if (loading || mediaLoading || detailsLoading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center font-sans min-h-screen bg-black">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!user) {
    router.push("/auth");
    return null;
  }

  if (!media) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center font-sans min-h-screen bg-black">
        <div className="text-white">Media not found</div>
      </div>
    );
  }

  const title = getMediaTitle(media);
  const date = getMediaDate(media);
  const type = getMediaType(media);
  const posterUrl = getPosterUrl(media.poster_path, "w500");
  const backdropUrl = getPosterUrl(media.backdrop_path, "original");
  const rating =
    typeof media.vote_average === "number"
      ? media.vote_average.toFixed(1)
      : "N/A";
  const genres = media.genres?.map((g) => g.name) || [];

  return (
    <div className="flex flex-col flex-1 font-sans min-h-screen bg-black">
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        <div className="flex flex-col md:flex-row gap-6 md:gap-8 mb-8">
          <div className="w-full md:w-1/4 flex-shrink-0">
            <img
              src={posterUrl}
              alt={title}
              className="w-full rounded-lg shadow-2xl"
              onError={(e) => {
                e.currentTarget.src = "/placeholder-poster.svg";
              }}
            />
          </div>

          <div className="w-full md:w-3/4">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-1 bg-violet-600 text-white text-xs font-semibold rounded uppercase">
                {type}
              </span>
              {media.status && (
                <span className="px-2 py-1 bg-zinc-700 text-zinc-300 text-xs rounded">
                  {media.status}
                </span>
              )}
            </div>

            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
              {title}
            </h1>

            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-1">
                <span className="text-yellow-400 text-lg">★</span>
                <span className="text-white text-lg font-semibold">
                  {rating}
                </span>
              </div>
              <span className="text-zinc-400">{date}</span>
              {media.runtime && (
                <span className="text-zinc-400">{media.runtime} min</span>
              )}
            </div>

            {genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {genres.map((genre) => (
                  <span
                    key={genre}
                    className="px-3 py-1 bg-zinc-800 text-zinc-300 text-sm rounded-full"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}

            {media.overview && (
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white mb-3">Overview</h2>
                <p className="text-zinc-300 leading-relaxed">
                  {media.overview}
                </p>
              </div>
            )}

            <button
              onClick={() => setShowWatchDialog(true)}
              className="px-6 py-3 cursor-pointer bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-violet-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-violet-500/25"
            >
              {type === "tv" ? "Mark Episode as Watched" : "Mark as Watched"}
            </button>

            {watchHistory.length > 0 && (
              <div className="mt-6">
                <h2 className="text-xl font-bold text-white mb-4">
                  Watch History
                </h2>
                <div className="space-y-2">
                  {watchHistory
                    .sort(
                      (a, b) =>
                        new Date(b.watchedAt).getTime() -
                        new Date(a.watchedAt).getTime(),
                    )
                    .slice(
                      0,
                      showExpandedWatchHistory
                        ? undefined
                        : watchHistory.length >= 4
                          ? 1
                          : watchHistory.length,
                    )
                    .map((watch) => (
                      <div
                        key={watch.id}
                        className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-zinc-300">
                            {watch.seasonNumber !== null &&
                            watch.episodeNumber !== null
                              ? `S${watch.seasonNumber} E${watch.episodeNumber} - `
                              : ""}
                            {new Date(watch.watchedAt).toLocaleString()}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteWatch(watch.id)}
                          className="px-3 py-1 cursor-pointer text-red-400 hover:text-red-300 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  {watchHistory.length >= 4 && !showExpandedWatchHistory && (
                    <button
                      onClick={() => setShowExpandedWatchHistory(true)}
                      className="w-full py-2 cursor-pointer text-zinc-400 hover:text-zinc-300 text-sm border border-zinc-700/50 rounded-lg bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors"
                    >
                      Show {watchHistory.length - 1} more entries
                    </button>
                  )}
                  {showExpandedWatchHistory && watchHistory.length >= 4 && (
                    <button
                      onClick={() => setShowExpandedWatchHistory(false)}
                      className="w-full py-2 cursor-pointer text-zinc-400 hover:text-zinc-300 text-sm border border-zinc-700/50 rounded-lg bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors"
                    >
                      Show less
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {type === "tv" && media.number_of_seasons && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-white mb-3">Series Info</h2>
            <div className="text-zinc-300">
              <p>
                {media.number_of_seasons} Season
                {media.number_of_seasons !== 1 ? "s" : ""}
              </p>
              <p>
                {media.number_of_episodes} Episode
                {media.number_of_episodes !== 1 ? "s" : ""}
              </p>
            </div>

            {tvShowDetails?.seasons && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Episodes
                </h3>
                <div className="space-y-4">
                  {tvShowDetails.seasons.map(
                    (season: any, seasonIndex: number) => (
                      <div
                        key={seasonIndex}
                        className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700/50"
                      >
                        <h4 className="text-white font-semibold mb-3">
                          Season {season.season_number}
                        </h4>
                        <div className="space-y-2">
                          {season.episodes?.map((episode: any) => {
                            const isWatched = watchHistory.some(
                              (w) =>
                                w.seasonNumber === season.season_number &&
                                w.episodeNumber === episode.episode_number,
                            );
                            return (
                              <div
                                key={episode.episode_number}
                                className="flex items-center justify-between p-2 bg-zinc-700/30 rounded border border-zinc-600/30"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-zinc-300 text-sm">
                                    {episode.episode_number}. {episode.name}
                                  </span>
                                  {isWatched && (
                                    <span className="px-2 py-0.5 bg-green-600/20 text-green-400 text-xs rounded">
                                      Watched
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => {
                                    setSelectedSeason(season.season_number);
                                    setSelectedEpisode(episode.episode_number);
                                    setShowWatchDialog(true);
                                  }}
                                  className="px-3 py-1 cursor-pointer text-xs bg-violet-600/20 text-violet-400 rounded hover:bg-violet-600/30 transition-colors"
                                >
                                  {isWatched ? "Update" : "Mark"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {credits && credits.cast.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">Top Cast</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {credits.cast.slice(0, 6).map((actor) => (
                <div key={actor.id} className="text-center">
                  <img
                    src={getProfileUrl(actor.profile_path)}
                    alt={actor.name}
                    className="w-full aspect-square object-cover rounded-lg mb-2"
                    onError={(e) => {
                      e.currentTarget.src = "/placeholder-avatar.svg";
                    }}
                  />
                  <p className="text-white text-sm font-semibold truncate">
                    {actor.name}
                  </p>
                  <p className="text-zinc-400 text-xs truncate">
                    {actor.character}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {reviews.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">Reviews</h2>
            <div className="space-y-4">
              {reviews.slice(0, 3).map((review) => (
                <div
                  key={review.id}
                  className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700/50"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <img
                      src={getProfileUrl(review.author_details.avatar_path)}
                      alt={review.author}
                      className="w-10 h-10 rounded-full"
                      onError={(e) => {
                        e.currentTarget.src = "/placeholder-avatar.svg";
                      }}
                    />
                    <div>
                      <p className="text-white font-semibold">
                        {review.author}
                      </p>
                      {review.author_details.rating && (
                        <p className="text-yellow-400 text-sm">
                          ★ {review.author_details.rating}/10
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-zinc-300 text-sm line-clamp-4">
                    {review.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {recommendations.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">
              Recommendations
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {recommendations.slice(0, 5).map((rec) => (
                <MediaCard key={rec.id} media={rec} />
              ))}
            </div>
          </div>
        )}
      </main>

      {showWatchDialog && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-lg p-6 w-full max-w-md border border-zinc-700">
            <h2 className="text-2xl font-bold text-white mb-4">
              {type === "tv" ? "Mark Episode as Watched" : "Mark as Watched"}
            </h2>
            <form onSubmit={handleAddWatch}>
              {type === "tv" && (
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-zinc-300 mb-2">Season</label>
                    <select
                      value={selectedSeason}
                      onChange={(e) => {
                        setSelectedSeason(parseInt(e.target.value));
                        setSelectedEpisode(1);
                      }}
                      className="w-full px-4 py-2 bg-zinc-800 border border-zinc-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-violet-500 cursor-pointer"
                    >
                      {media?.number_of_seasons &&
                        Array.from(
                          { length: media.number_of_seasons },
                          (_, i) => i + 1,
                        ).map((seasonNum) => (
                          <option key={seasonNum} value={seasonNum}>
                            Season {seasonNum}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-zinc-300 mb-2">Episode</label>
                    <select
                      value={selectedEpisode}
                      onChange={(e) =>
                        setSelectedEpisode(parseInt(e.target.value))
                      }
                      className="w-full px-4 py-2 bg-zinc-800 border border-zinc-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-violet-500 cursor-pointer"
                    >
                      {tvShowDetails?.seasons?.[selectedSeason - 1]?.episodes
                        ?.length > 0
                        ? tvShowDetails.seasons[
                            selectedSeason - 1
                          ].episodes.map((episode: any) => (
                            <option
                              key={episode.episode_number}
                              value={episode.episode_number}
                            >
                              Episode {episode.episode_number} - {episode.name}
                            </option>
                          ))
                        : Array.from({ length: 10 }, (_, i) => i + 1).map(
                            (epNum) => (
                              <option key={epNum} value={epNum}>
                                Episode {epNum}
                              </option>
                            ),
                          )}
                    </select>
                  </div>
                </div>
              )}
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

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowWatchDialog(false);
                    setWatchOption("justWatched");
                    setWatchDate("");
                    setWatchTime("");
                  }}
                  className="flex-1 px-4 py-2 cursor-pointer bg-zinc-700 text-white rounded hover:bg-zinc-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingWatch}
                  className="flex-1 px-4 py-2 cursor-pointer bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {addingWatch ? "Adding..." : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-lg p-6 w-full max-w-md border border-zinc-700">
            <h2 className="text-xl font-bold text-white mb-4">
              Confirm Removal
            </h2>
            <p className="text-zinc-300 mb-6">
              Are you sure you want to remove this watch history entry?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setWatchToDelete(null);
                }}
                className="flex-1 px-4 py-2 cursor-pointer bg-zinc-700 text-white rounded hover:bg-zinc-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteWatch}
                className="flex-1 px-4 py-2 cursor-pointer bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
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
