"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useSupabase } from "@/components/supabase-provider";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import {
  getMediaDetails,
  getPosterUrl,
  getBackdropUrl,
  getMediaTitle,
  getMediaDate,
  getMediaType,
  getMediaCredits,
  getMediaReviews,
  getMediaRecommendations,
  getProfileUrl,
  getTVSeasonDetails,
  getTVShowCastImages,
  getMediaWatchProviders,
  getMediaVideos,
  getMediaCertification,
  getMovieReleaseDates,
  getMediaImages,
} from "@/lib/tmdb";
import type {
  TMDBMedia,
  TMDBActor,
  TMDBReview,
  TMDBWatchProviders,
  TMDBVideo,
  TMDBImage,
} from "@/lib/tmdb";
import type { TVMazeCastImages } from "@/lib/tmdb";
import MediaCard from "@/components/media-card";
import UserRating from "@/components/user-rating";
import { notifyWatchedChanged } from "@/components/watched-state";
import type { InitialRating } from "@/lib/use-initial-rating";

interface MediaDetailClientProps {
  initialWatchHistory: any[];
  initialRating?: InitialRating;
}

const VIDEO_TYPE_ORDER = [
  "Trailer",
  "Teaser",
  "Featurette",
  "Behind the Scenes",
  "Clip",
] as const;

const GALLERY_PREVIEW_COUNT = 12;

export default function MediaDetailClient({
  initialWatchHistory,
  initialRating,
}: MediaDetailClientProps) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [media, setMedia] = useState<TMDBMedia | null>(null);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [showWatchDialog, setShowWatchDialog] = useState(false);
  const [watchDate, setWatchDate] = useState("");
  const [watchTime, setWatchTime] = useState("");
  const [watchHistory, setWatchHistory] = useState<any[]>(
    initialWatchHistory,
  );
  const [addingWatch, setAddingWatch] = useState(false);
  const [watchOption, setWatchOption] = useState<
    "justWatched" | "releaseDate" | "unknownDate" | "otherDate"
  >("justWatched");
  const [showExpandedWatchHistory, setShowExpandedWatchHistory] =
    useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [watchToDelete, setWatchToDelete] = useState<any | null>(null);
  const [showWatchlistDeleteConfirm, setShowWatchlistDeleteConfirm] =
    useState(false);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [selectedEpisode, setSelectedEpisode] = useState<number>(1);
  const [expandedSeason, setExpandedSeason] = useState<number | null>(1);
  const [tvShowDetails, setTvShowDetails] = useState<any>(null);
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [credits, setCredits] = useState<{
    cast: TMDBActor[];
    crew: any[];
  } | null>(null);
  const [castImages, setCastImages] = useState<TVMazeCastImages | null>(
    null,
  );
  const [reviews, setReviews] = useState<TMDBReview[]>([]);
  const [recommendations, setRecommendations] = useState<TMDBMedia[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [watchProviders, setWatchProviders] =
    useState<TMDBWatchProviders | null>(null);
  const [videos, setVideos] = useState<TMDBVideo[]>([]);
  const [certification, setCertification] = useState<string | null>(null);
  const [releaseDates, setReleaseDates] = useState<
    Array<{ label: string; date: string; certification?: string }>
  >([]);
  const [rtScore, setRtScore] = useState<{
    tomatometer: number | null;
    popcornmeter: number | null;
    tomatometerSentiment: string | null;
    popcornmeterSentiment: string | null;
    url: string | null;
  } | null>(null);
  const [lbScore, setLbScore] = useState<{
    rating: number | null;
    votes: number | null;
    url: string | null;
  } | null>(null);
  const [images, setImages] = useState<TMDBImage[]>([]);
  const [videoFilter, setVideoFilter] = useState<string>("all");
  const [castFilter, setCastFilter] = useState<
    "actors" | "directors" | "writers" | "production"
  >("actors");
  const [lightbox, setLightbox] = useState<{
    kind: "video" | "image";
    index: number;
  } | null>(null);

  const supabase = useSupabase();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const mediaId = params.id as string;
  const mediaType = (searchParams.get("type") as "movie" | "tv") || "movie";


  const title = useMemo(
    () => (media ? getMediaTitle(media) : "Unknown"),
    [media],
  );
  const date = useMemo(
    () => (media ? getMediaDate(media) : "Unknown"),
    [media],
  );
  const type = useMemo(
    () => (media ? getMediaType(media) : "unknown"),
    [media],
  );
  const posterUrl = useMemo(
    () => getPosterUrl(media?.poster_path!, "w500"),
    [media?.poster_path],
  );
  const backdropUrl = useMemo(
    () => getPosterUrl(media?.backdrop_path!, "original"),
    [media?.backdrop_path],
  );
  const ratingSources = useMemo(() => {
    const sources: Array<{
      key: string;
      label: string;
      value: number;
      display: string;
      url: string | null;
      votes?: number | null;
      icon?: "tomato" | "popcorn";
      sentiment?: string | null;
    }> = [];
    if (typeof media?.vote_average === "number" && media.vote_average > 0) {
      sources.push({
        key: "tmdb",
        label: "TMDB",
        value: media.vote_average,
        display: media.vote_average.toFixed(1),
        url: `https://www.themoviedb.org/${mediaType}/${mediaId}`,
      });
    }
    if (lbScore?.rating) {
      sources.push({
        key: "letterboxd",
        label: "Letterboxd",
        value: lbScore.rating * 2,
        display: lbScore.rating.toFixed(1),
        url: lbScore.url,
        votes: lbScore.votes,
      });
    }
    if (rtScore?.tomatometer != null) {
      sources.push({
        key: "rt-critics",
        label: "RT Critics",
        value: rtScore.tomatometer / 10,
        display: `${rtScore.tomatometer}%`,
        url: rtScore.url,
        icon: "tomato",
        sentiment: rtScore.tomatometerSentiment,
      });
    }
    if (rtScore?.popcornmeter != null) {
      sources.push({
        key: "rt-audience",
        label: "RT Audience",
        value: rtScore.popcornmeter / 10,
        display: `${rtScore.popcornmeter}%`,
        url: rtScore.url,
        icon: "popcorn",
        sentiment: rtScore.popcornmeterSentiment,
      });
    }
    return sources;
  }, [media?.vote_average, lbScore, rtScore, mediaType, mediaId]);

  const avgRating = useMemo(
    () =>
      ratingSources.length > 0
        ? ratingSources.reduce((sum, source) => sum + source.value, 0) /
          ratingSources.length
        : null,
    [ratingSources],
  );

  const avgRatingHue = avgRating != null ? avgRating * 12 : 0;

  const formatVotes = (count: number) =>
    count >= 1_000_000
      ? `${(count / 1_000_000).toFixed(1)}M`
      : count >= 1_000
        ? `${(count / 1_000).toFixed(1)}K`
        : String(count);
  const genres = useMemo(
    () => media?.genres?.map((g) => g.name) || [],
    [media?.genres],
  );
  const totalEpisodeCount = useMemo(() => {
    if (mediaType !== "tv") return 0;
    return typeof media?.number_of_episodes === "number"
      ? media.number_of_episodes
      : 0;
  }, [mediaType, media?.number_of_episodes]);

  const displayNames = useMemo(() => {
    try {
      return {
        language: new Intl.DisplayNames(["en"], { type: "language" }),
        region: new Intl.DisplayNames(["en"], { type: "region" }),
      };
    } catch {
      return null;
    }
  }, []);

  const formatMoney = (value?: number) => {
    if (!value || value <= 0) return null;
    if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
    return `$${value}`;
  };

  const detailItems = useMemo(() => {
    if (!media) return [];
    const items: Array<{ label: string; value: string }> = [];
    const push = (label: string, value?: string | null) => {
      if (value) items.push({ label, value });
    };

    const languageName = media.original_language
      ? (displayNames?.language.of(media.original_language) ??
        media.original_language.toUpperCase())
      : null;
    push("Language", languageName);

    if (mediaType === "movie") {
      push("Budget", formatMoney(media.budget));
      push("Revenue", formatMoney(media.revenue));
      push(
        "Production Companies",
        media.production_companies?.map((c) => c.name).join(", "),
      );
      push(
        "Production Countries",
        media.production_countries
          ?.map((c) => c.name)
          .filter(Boolean)
          .join(", "),
      );
      push(
        "Spoken Languages",
        media.spoken_languages?.map((l) => l.name).join(", "),
      );
    } else {
      push(
        "Networks",
        media.networks?.map((n) => n.name).join(", "),
      );
      push(
        "Created By",
        media.created_by?.map((c) => c.name).join(", "),
      );
      push(
        "Origin Country",
        media.origin_country
          ?.map((code) => displayNames?.region.of(code) ?? code)
          .join(", "),
      );
      push(
        "Languages",
        media.languages
          ?.map((l) => l.english_name || l.name)
          .join(", "),
      );
      push(
        "Episode Runtime",
        media.episode_run_time?.length
          ? media.episode_run_time.map((m) => `${m} min`).join(" / ")
          : null,
      );
    }

    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media, mediaType, displayNames]);

  const sortedVideos = useMemo(() => {
    const rank = (type: string) => {
      const index = VIDEO_TYPE_ORDER.indexOf(
        type as (typeof VIDEO_TYPE_ORDER)[number],
      );
      return index === -1 ? VIDEO_TYPE_ORDER.length : index;
    };
    return [...videos].sort(
      (a, b) =>
        rank(a.type) - rank(b.type) ||
        Number(b.official ?? false) - Number(a.official ?? false),
    );
  }, [videos]);

  const videoTypes = useMemo(() => {
    const present = new Set(videos.map((video) => video.type));
    return [
      ...VIDEO_TYPE_ORDER.filter((type) => present.has(type)),
      ...[...present].filter(
        (type) =>
          !VIDEO_TYPE_ORDER.includes(type as (typeof VIDEO_TYPE_ORDER)[number]),
      ),
    ];
  }, [videos]);

  const filteredVideos = useMemo(
    () =>
      videoFilter === "all"
        ? sortedVideos
        : sortedVideos.filter((video) => video.type === videoFilter),
    [sortedVideos, videoFilter],
  );

  const sortedGalleryImages = useMemo(
    () =>
      [...images].sort(
        (a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0),
      ),
    [images],
  );

  const galleryRowRef = useRef<HTMLDivElement>(null);
  const galleryDimsRef = useRef(new Map<string, { w: number; h: number }>());
  const [galleryTick, setGalleryTick] = useState(0);
  const [galleryFit, setGalleryFit] = useState({ count: 0, lastWidth: 0 });

  const galleryCandidates = sortedGalleryImages.slice(
    0,
    GALLERY_PREVIEW_COUNT,
  );
  const galleryVisibleCount = Math.min(
    galleryFit.count,
    galleryCandidates.length,
  );
  const galleryOverflow = Math.max(
    0,
    sortedGalleryImages.length - galleryVisibleCount,
  );

  useEffect(() => {
    const el = galleryRowRef.current;
    if (!el || galleryCandidates.length === 0) return;
    const measure = () => {
      const avail = el.clientWidth;
      const gap = 12;
      const h = 112;
      let used = 0;
      let count = 0;
      let lastNatural = 0;
      for (const image of galleryCandidates) {
        const dim = galleryDimsRef.current.get(image.file_path);
        const w = dim ? (h * dim.w) / dim.h : (h * 16) / 9;
        const itemW = w + (count > 0 ? gap : 0);
        if (count > 0 && used + itemW > avail + 1) break;
        used += itemW;
        lastNatural = w;
        count++;
      }
      count = Math.max(1, Math.min(count, galleryCandidates.length));
      const lastLeft = used - lastNatural - (count > 1 ? gap : 0);
      const lastWidth = Math.max(
        lastNatural,
        avail - lastLeft,
      );
      setGalleryFit({ count, lastWidth });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galleryTick, sortedGalleryImages.length]);

  const castCategories = useMemo(() => {
    const crew = credits?.crew ?? [];
    const unique = (list: any[]) => {
      const seen = new Set<string>();
      return list.filter((member) => {
        const key = `${member.id}:${member.job ?? ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };
    const text = (member: any) =>
      `${member.job ?? ""} ${member.department ?? ""}`.toLowerCase();
    return {
      actors: credits?.cast ?? [],
      directors: unique(
        crew.filter(
          (member) =>
            member.job === "Director" ||
            /director/.test(text(member)),
        ),
      ),
      writers: unique(
        crew.filter((member) => /writ|screenplay|story/.test(text(member))),
      ),
      production: unique(
        crew.filter(
          (member) =>
            member.department === "Production" ||
            /produc/.test(text(member)),
        ),
      ),
    };
  }, [credits]);

  const castFilters = useMemo(() => {
    const options: Array<{
      value: "actors" | "directors" | "writers" | "production";
      label: string;
      count: number;
    }> = [
      { value: "actors", label: "Actors", count: castCategories.actors.length },
      {
        value: "directors",
        label: "Directors",
        count: castCategories.directors.length,
      },
      {
        value: "writers",
        label: "Writers",
        count: castCategories.writers.length,
      },
      {
        value: "production",
        label: "Production",
        count: castCategories.production.length,
      },
    ];
    return options.filter((option) => option.count > 0);
  }, [castCategories]);

  const activeCastEntries = useMemo(() => {
    if (castFilter === "actors") {
      return castCategories.actors.map((actor) => ({
        id: actor.id,
        name: actor.name,
        profile_path: actor.profile_path,
        subtitle: actor.character || "Unknown role",
        tmdbCharacter: actor.character,
      }));
    }
    return castCategories[castFilter].map((member: any) => ({
      id: member.id,
      name: member.name,
      profile_path: member.profile_path,
      subtitle: member.job || member.department || "Crew",
      tmdbCharacter: undefined as string | undefined,
    }));
  }, [castCategories, castFilter]);

  useEffect(() => {
    if (!lightbox) return;

    const list =
      lightbox.kind === "video" ? filteredVideos : sortedGalleryImages;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLightbox(null);
        return;
      }
      const delta = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
      if (delta === 0) return;
      setLightbox((current) => {
        if (!current) return current;
        const next = current.index + delta;
        if (next < 0 || next >= list.length) return current;
        return { ...current, index: next };
      });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightbox, filteredVideos, sortedGalleryImages]);

  useEffect(() => {
    if (!lightbox) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [lightbox]);

  const allProviders = useMemo(() => {
    if (!watchProviders) return [];
    const seen = new Set<number>();
    return [
      ...(watchProviders.flatrate ?? []),
      ...(watchProviders.rent ?? []),
      ...(watchProviders.buy ?? []),
      ...(watchProviders.free ?? []),
      ...(watchProviders.ads ?? []),
    ]
      .filter((provider) => {
        if (seen.has(provider.provider_id)) return false;
        seen.add(provider.provider_id);
        return true;
      })
      .sort(
        (a, b) =>
          (a.display_priority ?? 999) - (b.display_priority ?? 999),
      );
  }, [watchProviders]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [mediaId, mediaType]);

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
        data: { session },
      } = await supabase.auth.getSession();
      updateUser(session?.user ?? null);
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
    const fetchMediaDetails = async () => {
      const type = (searchParams.get("type") as "movie" | "tv") || "movie";
      setDetailsLoading(true);

      const [
        details,
        creditsData,
        reviewsData,
        recommendationsData,
        tvCastImages,
        providersData,
        videosData,
        certificationData,
        movieReleaseDates,
        rtScoreData,
        lbScoreData,
        imagesData,
      ] = await Promise.all([
        getMediaDetails(parseInt(mediaId), type),
        getMediaCredits(parseInt(mediaId), type),
        getMediaReviews(parseInt(mediaId), type),
        getMediaRecommendations(parseInt(mediaId), type),
        type === "tv"
          ? getTVShowCastImages(parseInt(mediaId))
          : Promise.resolve(null),
        getMediaWatchProviders(parseInt(mediaId), type),
        getMediaVideos(parseInt(mediaId), type),
        getMediaCertification(parseInt(mediaId), type),
        type === "movie"
          ? getMovieReleaseDates(parseInt(mediaId))
          : Promise.resolve([]),
        fetch(`/api/rt-score?type=${type}&id=${mediaId}`)
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null),
        fetch(`/api/lb-score?type=${type}&id=${mediaId}`)
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null),
        getMediaImages(parseInt(mediaId), type),
      ]);

      setMedia(details);
      setCredits(creditsData);
      setReviews(reviewsData);
      setRecommendations(recommendationsData);
      setCastImages(tvCastImages);
      setWatchProviders(providersData ?? null);
      setVideos(videosData ?? []);
      setCertification(certificationData ?? null);
      setReleaseDates(movieReleaseDates ?? []);
      setRtScore(rtScoreData ?? null);
      setLbScore(lbScoreData ?? null);
      setImages(imagesData ?? []);
      setMediaLoading(false);
      setDetailsLoading(false);

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
          setExpandedSeason((current) => current ?? 1);
          setSelectedSeason(1);
          setSelectedEpisode(1);
        } catch (error) {
          console.error("Error fetching TV show details:", error);
        }
      }
    };

    fetchMediaDetails();
  }, [mediaId, searchParams]);

  useEffect(() => {
    setWatchHistory(initialWatchHistory);
  }, [initialWatchHistory]);

  useEffect(() => {
    const checkWatchlist = async () => {
      if (!user) return;

      setWatchlistLoading(true);
      try {
        const response = await fetch("/api/watchlist");
        if (!response.ok) {
          setIsInWatchlist(false);
          return;
        }
        const data = await response.json();
        const watchlistData = Array.isArray(data.watchlist)
          ? data.watchlist
          : [];
        setIsInWatchlist(
          watchlistData.some(
            (item: any) => item.media.tmdbId === parseInt(mediaId),
          ),
        );
      } catch (error) {
        console.error("Error checking watchlist:", error);
        setIsInWatchlist(false);
      } finally {
        setWatchlistLoading(false);
      }
    };

    checkWatchlist();
  }, [user, mediaId]);

  useEffect(() => {
    const isAnyModalOpen =
      showWatchDialog || showDeleteConfirm || showWatchlistDeleteConfirm;
    document.body.style.overflow = isAnyModalOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [showWatchDialog, showDeleteConfirm, showWatchlistDeleteConfirm]);

  useEffect(() => {
    if (!showWatchDialog && !showDeleteConfirm && !showWatchlistDeleteConfirm)
      return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false);
          setWatchToDelete(null);
          return;
        }

        if (showWatchlistDeleteConfirm) {
          setShowWatchlistDeleteConfirm(false);
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
  }, [showWatchDialog, showDeleteConfirm, showWatchlistDeleteConfirm]);

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
      let episodeName = null;
      if (mediaType === "tv" && selectedSeason && selectedEpisode) {
        const season = tvShowDetails?.seasons?.[selectedSeason - 1];
        const episode = season?.episodes?.find(
          (ep: any) => ep.episode_number === selectedEpisode,
        );
        episodeName = episode?.name || null;
      }

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
          episodeName,
        }),
      });

      if (response.ok) {
        const newEntry = await response.json();
        setWatchHistory([...watchHistory, newEntry]);
        notifyWatchedChanged();
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
        notifyWatchedChanged();
      }
    } catch (error) {
      console.error("Error deleting watch history:", error);
    } finally {
      setShowDeleteConfirm(false);
      setWatchToDelete(null);
    }
  };

  const renderWatchLabel = (watch: any) => (
    <>
      {watch.seasonNumber !== null && watch.episodeNumber !== null
        ? `S${watch.seasonNumber} E${watch.episodeNumber}${watch.episodeName ? ` - ${watch.episodeName}` : ""} - `
        : "Watched "}
      {new Date(watch.watchedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        ...(mediaType === "movie" && {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
      })}
    </>
  );

  const handleAddToWatchlist = async () => {
    if (!user) return;

    setWatchlistLoading(true);
    try {
      const response = await fetch("/api/watchlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tmdbId: parseInt(mediaId),
          mediaType,
        }),
      });

      if (response.ok) {
        setIsInWatchlist(true);
      }
    } catch (error) {
      console.error("Error adding to watchlist:", error);
    } finally {
      setWatchlistLoading(false);
    }
  };

  const handleRemoveFromWatchlist = () => {
    if (!user) return;
    setShowWatchlistDeleteConfirm(true);
  };

  const confirmRemoveFromWatchlist = async () => {
    if (!user) return;

    setWatchlistLoading(true);
    try {
      const response = await fetch(`/api/watchlist?tmdbId=${mediaId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setIsInWatchlist(false);
      }
    } catch (error) {
      console.error("Error removing from watchlist:", error);
    } finally {
      setWatchlistLoading(false);
      setShowWatchlistDeleteConfirm(false);
    }
  };

  const lightboxListLength = lightbox
    ? lightbox.kind === "video"
      ? filteredVideos.length
      : sortedGalleryImages.length
    : 0;
  const lightboxVideo =
    lightbox?.kind === "video" ? filteredVideos[lightbox.index] : null;
  const lightboxImage =
    lightbox?.kind === "image"
      ? sortedGalleryImages[lightbox.index]
      : null;

  const navigateLightbox = (delta: number) => {
    setLightbox((current) => {
      if (!current) return current;
      const list =
        current.kind === "video" ? filteredVideos : sortedGalleryImages;
      const next = current.index + delta;
      if (next < 0 || next >= list.length) return current;
      return { ...current, index: next };
    });
  };

  if (loading || mediaLoading || detailsLoading) {
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

  if (!media) {
    return (
      <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-black font-sans">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">
            Media Not Found
          </h1>
          <p className="text-zinc-400 mb-6">
            The media you're looking for could not be loaded.
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

  const getAvatarColor = (name: string) => {
    const colors = [
      "linear-gradient(135deg, #8b5cf6, #4f46e5)",
      "linear-gradient(135deg, #ec4899, #8b5cf6)",
      "linear-gradient(135deg, #22c55e, #14b8a6)",
      "linear-gradient(135deg, #f59e0b, #f97316)",
      "linear-gradient(135deg, #06b6d4, #3b82f6)",
      "linear-gradient(135deg, #ef4444, #f97316)",
    ];

    const hash = [...name].reduce(
      (total, char) => total + char.charCodeAt(0),
      0,
    );
    return colors[hash % colors.length];
  };

  const getInitials = (name: string) =>
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "A";

  return (
    <div className="flex flex-col flex-1 font-sans min-h-screen bg-black">
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
          <div className="flex flex-col md:flex-row gap-6 md:gap-8 mb-8">
            <div className="w-full md:w-1/4 flex-shrink-0 max-w-[200px] mx-auto md:mx-0">
              <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg shadow-2xl">
                <img
                  src={posterUrl}
                  alt={title}
                  className="block h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = "/placeholder-poster.svg";
                  }}
                />
                {watchHistory.length > 0 && (
                <div
                  className="absolute bottom-2 left-2 flex h-5 w-5 items-center justify-center rounded bg-violet-600/60 text-violet-100 shadow-sm backdrop-blur-sm"
                  title="Watched"
                  aria-label="Watched"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                )}
              </div>
              {detailItems.length > 0 && (
                <dl className="mt-4 space-y-2.5">
                  {detailItems.map((item) => (
                    <div key={item.label}>
                      <dt className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
                        {item.label}
                      </dt>
                      <dd className="mt-0.5 text-xs leading-relaxed text-zinc-300">
                        {item.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {releaseDates.length > 0 && (
                <div className="mt-4">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
                    Release Dates
                  </p>
                  <div className="space-y-1">
                    {releaseDates.map((entry) => (
                      <div
                        key={entry.label}
                        className="flex items-baseline justify-between gap-2 text-xs"
                      >
                        <span className="shrink-0 text-zinc-500">
                          {entry.label}
                        </span>
                        <span className="text-right text-zinc-300">
                          {new Date(
                            `${entry.date}T00:00:00`,
                          ).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                          {entry.certification
                            ? ` · ${entry.certification}`
                            : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {allProviders.length > 0 && (
                <div className="mt-4">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
                    Where to watch
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {allProviders.map((provider) => (
                      <span
                        key={provider.provider_id}
                        title={provider.provider_name}
                        className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900/60 px-1.5 py-1 text-[10px] text-zinc-300"
                      >
                        {provider.logo_path && (
                          <img
                            src={getPosterUrl(provider.logo_path, "w92")}
                            alt=""
                            className="h-4 w-4 rounded-sm object-contain"
                          />
                        )}
                        {provider.provider_name}
                      </span>
                    ))}
                  </div>
                  {watchProviders?.link && (
                    <a
                      href={watchProviders.link}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1.5 inline-block text-[11px] font-semibold text-violet-300 transition hover:text-violet-200"
                    >
                      All streaming options →
                    </a>
                  )}
                </div>
              )}

              {(media.imdb_id || media.homepage) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {media.imdb_id && (
                    <a
                      href={`https://www.imdb.com/title/${media.imdb_id}/`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-violet-500/50 hover:text-violet-200"
                    >
                      IMDb
                    </a>
                  )}
                  {media.homepage && (
                    <a
                      href={media.homepage}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-violet-500/50 hover:text-violet-200"
                    >
                      Official site
                    </a>
                  )}
                </div>
              )}
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
                {certification && (
                  <span className="px-2 py-1 bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs font-semibold rounded">
                    {certification}
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4">
                {title}
              </h1>

              <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-4">
                <span className="text-zinc-400 text-sm sm:text-base">
                  {date}
                </span>

                {media.runtime && (
                  <span className="text-zinc-400 text-sm sm:text-base">
                    {media.runtime} min
                  </span>
                )}

                {mediaType === "tv" && totalEpisodeCount > 0 && (
                  <span className="text-zinc-400 text-sm sm:text-base">
                    {totalEpisodeCount}{" "}
                    {totalEpisodeCount === 1 ? "episode" : "episodes"}
                  </span>
                )}
              </div>

              {avgRating != null && (
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-bold"
                    style={{
                      backgroundColor: `hsl(${avgRatingHue} 70% 45% / 0.16)`,
                      borderColor: `hsl(${avgRatingHue} 70% 55% / 0.45)`,
                      color: `hsl(${avgRatingHue} 85% 72%)`,
                    }}
                    title={`Average of ${ratingSources.length} rating${ratingSources.length === 1 ? "" : "s"}: ${ratingSources.map((s) => `${s.label} ${s.display}`).join(", ")}`}
                  >
                    <span className="text-[10px] font-bold uppercase leading-none tracking-widest opacity-70">
                      Avg
                    </span>
                    <span className="leading-none">
                      {avgRating.toFixed(1)}
                    </span>
                  </span>
                  {ratingSources.map((source) => {
                    const inner = (
                      <>
                        {source.icon === "tomato" ? (
                          <img
                            src={`/icons/rt-tomato-${source.sentiment === "NEGATIVE" ? "rotten" : "fresh"}.svg`}
                            alt=""
                            className="h-3.5 w-3.5"
                          />
                        ) : source.icon === "popcorn" ? (
                          <img
                            src={`/icons/rt-popcorn-${source.sentiment === "NEGATIVE" ? "rotten" : "fresh"}.svg`}
                            alt=""
                            className="h-3.5 w-3.5"
                          />
                        ) : source.key === "letterboxd" ? (
                          <span className="text-[11px] font-bold text-[#00e054]">
                            ★
                          </span>
                        ) : source.key === "tmdb" ? (
                          <img
                            src="/icons/tmdb.svg"
                            alt=""
                            className="h-3.5 w-3.5"
                          />
                        ) : (
                          <span className="text-[11px] font-bold text-violet-300">
                            ★
                          </span>
                        )}
                        <span className="text-[11px] font-bold text-white">
                          {source.display}
                        </span>
                      </>
                    );
                    const className =
                      "inline-flex items-center gap-1 rounded bg-zinc-900/90 px-1.5 py-1 ring-1 ring-inset ring-zinc-700 transition hover:ring-zinc-500";
                    const title =
                      source.key === "letterboxd" && source.votes
                        ? `${source.label} — ${formatVotes(source.votes)} ratings`
                        : source.label;
                    return source.url ? (
                      <a
                        key={source.key}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        title={title}
                        className={className}
                      >
                        {inner}
                      </a>
                    ) : (
                      <span key={source.key} title={title} className={className}>
                        {inner}
                      </span>
                    );
                  })}
                </div>
              )}

              <div className="mt-6 pb-4">
                <p className="mb-0.5 text-xs font-semibold uppercase tracking-widest text-zinc-400">
                  Rate
                </p>
                <div className="[&>*]:my-0">
                  <UserRating
                    tmdbId={Number(mediaId)}
                    mediaType={mediaType}
                    title={title}
                    initialRating={initialRating}
                    watched={
                      mediaType === "tv"
                        ? watchHistory.some(
                            (watch) =>
                              watch.seasonNumber !== null &&
                              watch.episodeNumber !== null,
                          )
                        : watchHistory.length > 0
                    }
                  />
                </div>
              </div>

              {genres.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {genres.map((genre) => (
                    <span
                      key={genre}
                      className="px-2 py-1 sm:px-3 sm:py-1 bg-zinc-800 text-zinc-300 text-xs sm:text-sm rounded-full"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}

              {media.overview && (
                <div className="mb-6">
                  <h2 className="text-lg sm:text-xl font-bold text-white mb-3">
                    Overview
                  </h2>
                  <p className="text-zinc-300 leading-relaxed text-sm sm:text-base">
                    {media.overview}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setShowWatchDialog(true)}
                  className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-semibold text-violet-100 shadow-lg shadow-violet-500/10 transition hover:border-violet-400 hover:bg-violet-500/20"
                >
                  {type === "tv"
                    ? "Mark Episode as Watched"
                    : "Mark as Watched"}
                </button>

                {isInWatchlist ? (
                  <button
                    onClick={handleRemoveFromWatchlist}
                    disabled={watchlistLoading}
                    className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-semibold text-red-100 shadow-lg shadow-red-500/10 transition hover:border-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    Remove from Watchlist
                  </button>
                ) : (
                  <button
                    onClick={handleAddToWatchlist}
                    disabled={watchlistLoading}
                    className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-zinc-500/40 bg-zinc-500/10 px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-semibold text-zinc-100 shadow-lg shadow-zinc-500/10 transition hover:border-zinc-400 hover:bg-zinc-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                    </svg>
                    Add to Watchlist
                  </button>
                )}
              </div>


              {type === "tv" && media.number_of_seasons && (
                <div className="mb-8 mt-8">
                  <h2 className="mb-4 text-xl font-bold text-white">Seasons</h2>

                  <div className="flex gap-3 overflow-x-auto pb-3 [scrollbar-width:thin] [scrollbar-color:rgba(168,85,247,0.8)_rgba(39,39,42,0.8)]">
                    {Array.from(
                      { length: media.number_of_seasons },
                      (_, i) => i + 1,
                    ).map((seasonNumber) => {
                      const seasonInfo = tvShowDetails?.seasons?.find(
                        (season: any) => season.season_number === seasonNumber,
                      );
                      const episodeCount = seasonInfo?.episodes?.length || 0;

                      return (
                        <Link
                          key={seasonNumber}
                          href={`/media/${mediaId}/season/${seasonNumber}?type=tv`}
                          className="w-44 shrink-0 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 transition hover:border-violet-500/60 hover:bg-zinc-900 sm:w-52"
                        >
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300">
                              Season {seasonNumber}
                            </span>
                            <span className="rounded-full bg-zinc-800 px-2 py-1 text-[10px] text-zinc-300">
                              {episodeCount} eps
                            </span>
                          </div>

                          <p className="text-sm text-zinc-400">
                            {seasonInfo?.name || "Season overview"}
                          </p>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
              {watchHistory.length > 0 && (
                <div className="mt-6">
                  <h2 className="text-xl font-bold text-white mb-4">
                    Watch History
                  </h2>
                  <div className="space-y-2">
                    {showExpandedWatchHistory ? (
                      <div className="max-h-72 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(168,85,247,0.8)_rgba(39,39,42,0.8)]">
                        <div className="space-y-2">
                          {watchHistory
                            .sort(
                              (a, b) =>
                                new Date(b.watchedAt).getTime() -
                                new Date(a.watchedAt).getTime(),
                            )
                            .map((watch) => (
                              <div
                                key={watch.id}
                                className="flex min-w-0 items-center justify-between gap-1 rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-2 sm:gap-2 sm:p-3"
                              >
                                <div className="flex min-w-0 items-center">
                                  {watch.seasonNumber !== null &&
                                  watch.episodeNumber !== null ? (
                                    <Link
                                      href={`/media/${mediaId}/season/${watch.seasonNumber}/episode/${watch.episodeNumber}?type=${mediaType}`}
                                      className="truncate whitespace-nowrap text-[11px] text-zinc-300 transition-colors hover:text-violet-200 sm:text-sm"
                                    >
                                      {renderWatchLabel(watch)}
                                    </Link>
                                  ) : (
                                    <span className="truncate whitespace-nowrap text-[11px] text-zinc-300 sm:text-sm">
                                      {renderWatchLabel(watch)}
                                    </span>
                                  )}
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
                    ) : (
                      <div className="space-y-2">
                        {watchHistory
                          .sort(
                            (a, b) =>
                              new Date(b.watchedAt).getTime() -
                              new Date(a.watchedAt).getTime(),
                          )
                          .slice(
                            0,
                            watchHistory.length >= 4 ? 1 : watchHistory.length,
                          )
                          .map((watch) => (
                            <div
                              key={watch.id}
                              className="flex min-w-0 items-center justify-between gap-1 rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-2 sm:gap-2 sm:p-3"
                            >
                              <div className="flex min-w-0 items-center">
                                {watch.seasonNumber !== null &&
                                watch.episodeNumber !== null ? (
                                  <Link
                                    href={`/media/${mediaId}/season/${watch.seasonNumber}/episode/${watch.episodeNumber}?type=${mediaType}`}
                                    className="truncate whitespace-nowrap text-[11px] text-zinc-300 transition-colors hover:text-violet-200 sm:text-sm"
                                  >
                                    {renderWatchLabel(watch)}
                                  </Link>
                                ) : (
                                  <span className="truncate whitespace-nowrap text-[11px] text-zinc-300 sm:text-sm">
                                    {renderWatchLabel(watch)}
                                  </span>
                                )}
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
                    )}
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

              {castFilters.length > 0 && (
                <div className="mb-8 mt-8">
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-bold text-white">Cast</h2>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {castFilters.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setCastFilter(option.value)}
                          className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition ${
                            castFilter === option.value
                              ? "bg-violet-500/20 text-violet-200"
                              : "text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-3 [scrollbar-width:thin] [scrollbar-color:rgba(168,85,247,0.8)_rgba(39,39,42,0.8)]">
                    {activeCastEntries.map((entry) => {
                      const tvmazeImage =
                        castImages?.byPerson.get(
                          entry.name.trim().toLowerCase(),
                        ) ??
                        (entry.tmdbCharacter
                          ? castImages?.byCharacter.get(
                              entry.tmdbCharacter.trim().toLowerCase(),
                            )
                          : undefined);
                      const avatarUrl = tvmazeImage
                        ? tvmazeImage
                        : entry.profile_path
                          ? getProfileUrl(entry.profile_path)
                          : "";
                      const avatarLabel = getInitials(entry.name);

                      return (
                        <Link
                          href={`/actor/${entry.id}`}
                          aria-label={`View ${entry.name}'s profile`}
                          key={`${entry.id}-${entry.subtitle}`}
                          className="group block w-32 shrink-0 overflow-hidden rounded-xl border border-zinc-700/50 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 text-center shadow-lg shadow-black/20 transition-colors hover:border-violet-500/50 hover:shadow-violet-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 sm:w-36"
                        >
                          <div className="relative aspect-[3/4] overflow-hidden">
                            {avatarUrl && avatarUrl !== "/placeholder-avatar.svg" ? (
                              <img
                                src={avatarUrl}
                                alt={entry.name}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                onError={(e) => {
                                  const fallback = e.currentTarget
                                    .parentElement as HTMLDivElement;
                                  if (fallback) {
                                    const initialCard = document.createElement("div");
                                    initialCard.className =
                                      "flex h-full w-full items-center justify-center text-2xl font-bold text-white";
                                    initialCard.style.background = getAvatarColor(
                                      entry.name,
                                    );
                                    initialCard.textContent = avatarLabel;
                                    fallback.replaceChildren(initialCard);
                                  }
                                }}
                              />
                            ) : (
                              <div
                                className="flex h-full w-full items-center justify-center text-2xl font-bold text-white"
                                style={{
                                  background: getAvatarColor(entry.name),
                                }}
                              >
                                {avatarLabel}
                              </div>
                            )}
                          </div>
                          <div className="px-2.5 py-3">
                            <p className="truncate text-sm font-semibold text-white transition-colors group-hover:text-violet-200">
                              {entry.name}
                            </p>
                            <p className="mt-1 truncate text-xs text-zinc-400">
                              {entry.subtitle}
                            </p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {sortedVideos.length > 0 && (
                <div className="mb-8 pt-6">
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <h2 className="text-xl font-bold text-white">Videos</h2>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setVideoFilter("all")}
                        className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition ${
                          videoFilter === "all"
                            ? "bg-violet-500/20 text-violet-200"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        All
                      </button>
                      {videoTypes.map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setVideoFilter(type)}
                          className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition ${
                            videoFilter === type
                              ? "bg-violet-500/20 text-violet-200"
                              : "text-zinc-400 hover:text-zinc-200"
                          }`}
                        >
                          {type === "Behind the Scenes" ? "BTS" : type}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-3 [scrollbar-width:thin] [scrollbar-color:rgba(168,85,247,0.8)_rgba(39,39,42,0.8)]">
                    {filteredVideos.map((video, index) => (
                      <button
                        key={video.key}
                        type="button"
                        onClick={() =>
                          setLightbox({ kind: "video", index })
                        }
                        className="group block w-60 shrink-0 cursor-pointer text-left"
                      >
                        <div className="relative aspect-video overflow-hidden rounded-lg border border-zinc-800 bg-black">
                          <img
                            src={`https://i.ytimg.com/vi/${video.key}/mqdefault.jpg`}
                            alt={video.name}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          <span className="absolute left-1.5 top-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-300 backdrop-blur-sm">
                            {video.type === "Behind the Scenes"
                              ? "BTS"
                              : video.type}
                          </span>
                          <span className="absolute inset-0 flex items-center justify-center">
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm transition group-hover:bg-violet-600/80">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                className="ml-0.5 h-4 w-4 text-white"
                                fill="currentColor"
                                aria-hidden="true"
                              >
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </span>
                          </span>
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-xs text-zinc-400 transition group-hover:text-zinc-200">
                          {video.name}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {galleryCandidates.length > 0 && (
                <div className="mb-8">
                  <h2 className="mb-4 text-xl font-bold text-white">Images</h2>
                  <div
                    ref={galleryRowRef}
                    className="flex gap-3 overflow-hidden"
                  >
                    {galleryCandidates.map((image, index) => {
                      const visible = index < galleryVisibleCount;
                      const isLast = index === galleryVisibleCount - 1;
                      const hasMore = isLast && galleryOverflow > 0;
                      const stretched =
                        isLast && galleryFit.lastWidth > 0;
                      return (
                        <button
                          key={image.file_path}
                          type="button"
                          onClick={() =>
                            visible &&
                            setLightbox({
                              kind: "image",
                              index: hasMore
                                ? galleryVisibleCount
                                : index,
                            })
                          }
                          style={
                            stretched
                              ? { width: galleryFit.lastWidth }
                              : undefined
                          }
                          className={`group relative h-28 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-zinc-800 ${
                            visible ? "" : "hidden"
                          }`}
                        >
                          <img
                            src={getBackdropUrl(image.file_path, "w780")}
                            alt=""
                            onLoad={(e) => {
                              const img = e.currentTarget;
                              galleryDimsRef.current.set(image.file_path, {
                                w: img.naturalWidth,
                                h: img.naturalHeight,
                              });
                              setGalleryTick((tick) => tick + 1);
                            }}
                            className={`h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                              stretched ? "w-full" : "w-auto"
                            }`}
                          />
                          {hasMore && (
                            <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-lg font-bold text-white">
                              +{galleryOverflow}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          </div>





          {reviews.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-bold text-white mb-4">Reviews</h2>
              <div className="flex gap-4 overflow-x-auto pb-3 scroll-smooth [scrollbar-width:thin] [scrollbar-color:rgba(168,85,247,0.8)_rgba(39,39,42,0.8)]">
                {reviews.map((review) => {
                  const reviewAvatar = review.author_details.avatar_path
                    ? getProfileUrl(review.author_details.avatar_path)
                    : "";
                  const reviewInitials = getInitials(review.author);

                  return (
                    <div
                      key={review.id}
                      className="min-w-[290px] max-w-[290px] flex-shrink-0 rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-4 sm:min-w-[360px]"
                    >
                      <div className="mb-3 flex items-center gap-3">
                        {reviewAvatar &&
                        reviewAvatar !== "/placeholder-avatar.svg" ? (
                          <img
                            src={reviewAvatar}
                            alt={review.author}
                            className="h-10 w-10 rounded-full object-cover"
                            onError={(e) => {
                              const fallback = e.currentTarget
                                .parentElement as HTMLDivElement;
                              if (fallback) {
                                const initialCard =
                                  document.createElement("div");
                                initialCard.className =
                                  "flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white";
                                initialCard.style.background = getAvatarColor(
                                  review.author,
                                );
                                initialCard.textContent = reviewInitials;
                                fallback.replaceChildren(initialCard);
                              }
                            }}
                          />
                        ) : (
                          <div
                            className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                            style={{
                              background: getAvatarColor(review.author),
                            }}
                          >
                            {reviewInitials}
                          </div>
                        )}
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
                      <div className="max-h-52 overflow-y-auto pr-1 text-sm leading-relaxed text-zinc-300 [scrollbar-width:thin] [scrollbar-color:rgba(168,85,247,0.8)_rgba(39,39,42,0.8)]">
                        {review.content}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {recommendations.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-bold text-white mb-4">
                Recommendations
              </h2>
              <div className="flex gap-3 overflow-x-auto pb-3 [scrollbar-width:thin] [scrollbar-color:rgba(168,85,247,0.8)_rgba(39,39,42,0.8)]">
                {recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className="w-32 shrink-0 sm:w-36 md:w-40"
                  >
                    <MediaCard media={rec} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-zinc-600 bg-zinc-900/80 text-zinc-300 transition hover:border-zinc-400 hover:text-white"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>

          {lightboxListLength > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous"
                onClick={(event) => {
                  event.stopPropagation();
                  navigateLightbox(-1);
                }}
                className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-zinc-600 bg-zinc-900/80 text-zinc-200 transition hover:border-violet-400 hover:text-white sm:left-6"
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
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="Next"
                onClick={(event) => {
                  event.stopPropagation();
                  navigateLightbox(1);
                }}
                className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-zinc-600 bg-zinc-900/80 text-zinc-200 transition hover:border-violet-400 hover:text-white sm:right-6"
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
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </>
          )}

          <div
            className="relative"
            onClick={(event) => event.stopPropagation()}
          >
            {lightbox.kind === "video" ? (
              lightboxVideo ? (
                <>
                  <div className="aspect-video w-[min(92vw,960px)] overflow-hidden rounded-xl bg-black">
                    <iframe
                      src={`https://www.youtube.com/embed/${lightboxVideo.key}?autoplay=1&rel=0`}
                      title={lightboxVideo.name}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      className="h-full w-full"
                    />
                  </div>
                  <p className="mt-3 max-w-[min(92vw,960px)] text-center text-sm text-zinc-300">
                    {lightboxVideo.name}
                  </p>
                </>
              ) : null
            ) : lightboxImage ? (
              <img
                src={getBackdropUrl(lightboxImage.file_path, "w1280")}
                alt=""
                className="max-h-[85vh] w-auto max-w-full rounded-lg object-contain"
              />
            ) : null}
          </div>

          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-zinc-900/80 px-3 py-1 text-xs font-medium text-zinc-400">
            {lightbox.index + 1} / {lightboxListLength}
          </p>
        </div>
      )}

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
            <h3 className="text-lg font-semibold text-white mb-2">
              {type === "tv" ? "Mark Episode as Watched" : "Mark as Watched"}
            </h3>
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

      {showWatchlistDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowWatchlistDeleteConfirm(false);
            }
          }}
        >
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-full max-w-sm mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-2">
              Remove from Watchlist
            </h3>
            <p className="text-zinc-300 mb-6">
              Are you sure you want to remove this item from your watchlist?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowWatchlistDeleteConfirm(false);
                }}
                className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemoveFromWatchlist}
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
