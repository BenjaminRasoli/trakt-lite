"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { InitialRating } from "@/lib/use-initial-rating";

interface UserRatingProps {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  watched: boolean;
  seasonNumber?: number;
  episodeNumber?: number;
  initialRating?: InitialRating;
}

interface SavedRating {
  score: number;
  updatedAt: string;
}

interface RatingResult {
  key: string;
  eligible: boolean;
  rating: SavedRating | null;
}

export default function UserRating({
  tmdbId,
  mediaType,
  title,
  watched,
  seasonNumber,
  episodeNumber,
  initialRating,
}: UserRatingProps) {
  const targetParams = useMemo(() => {
    const params = new URLSearchParams({
      tmdbId: String(tmdbId),
      mediaType,
    });
    if (seasonNumber !== undefined) {
      params.set("seasonNumber", String(seasonNumber));
    }
    if (episodeNumber !== undefined) {
      params.set("episodeNumber", String(episodeNumber));
    }
    return params;
  }, [tmdbId, mediaType, seasonNumber, episodeNumber]);

  const targetKey = targetParams.toString();
  const [ratingResult, setRatingResult] = useState<RatingResult | null>(() =>
    initialRating && initialRating.key === targetKey
      ? {
          key: targetKey,
          eligible: initialRating.eligible,
          rating: initialRating.rating,
        }
      : null,
  );
  const [requestError, setRequestError] = useState<{
    key: string;
    message: string;
  } | null>(null);
  const [hoveredScore, setHoveredScore] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftScore, setDraftScore] = useState("");
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const adoptedInitialKey = useRef<string | null>(null);

  const currentResult =
    ratingResult?.key === targetKey ? ratingResult : null;
  const currentRequestError =
    requestError?.key === targetKey ? requestError.message : null;
  const loading = !currentResult && !currentRequestError;
  const eligible = currentResult?.eligible === true;
  const savedRating = eligible ? currentResult?.rating ?? null : null;

  useEffect(() => {
    if (
      initialRating &&
      initialRating.key === targetKey &&
      adoptedInitialKey.current !== targetKey
    ) {
      adoptedInitialKey.current = targetKey;
      setRatingResult({
        key: targetKey,
        eligible: initialRating.eligible,
        rating: initialRating.rating,
      });
      setRequestError(null);
      return;
    }

    const controller = new AbortController();

    const loadRating = async () => {
      try {
        const response = await fetch(`/api/ratings?${targetKey}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Could not load your rating.");
        }

        setRatingResult({
          key: targetKey,
          eligible: data.eligible === true,
          rating: data.rating ?? null,
        });
        setRequestError(null);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        console.error("Error loading user rating:", loadError);
        setRequestError({
          key: targetKey,
          message: "Your rating could not be loaded. Please try again.",
        });
      }
    };

    void loadRating();
    return () => controller.abort();
  }, [targetKey, watched, initialRating]);

  useEffect(() => {
    if (!dialogOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) setDialogOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [dialogOpen, saving]);

  const openDialog = (score: number) => {
    setDraftScore(String(score));
    setDialogError(null);
    setDialogOpen(true);
  };

  const displayScore = hoveredScore ?? savedRating?.score ?? 0;

  const handleStarKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowDown" &&
      event.key !== "ArrowRight" &&
      event.key !== "ArrowUp" &&
      event.key !== "Enter" &&
      event.key !== " "
    ) {
      return;
    }
    event.preventDefault();

    if (event.key === "Enter" || event.key === " ") {
      openDialog(hoveredScore ?? savedRating?.score ?? 5);
      return;
    }

    const direction =
      event.key === "ArrowLeft" || event.key === "ArrowDown" ? -0.5 : 0.5;
    const nextScore = Math.min(
      10,
      Math.max(0.5, (hoveredScore ?? savedRating?.score ?? 0) + direction),
    );
    setHoveredScore(nextScore);
  };

  const saveRating = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const score = Number(draftScore);
    if (!Number.isFinite(score) || score < 0.5 || score > 10) {
      setDialogError("Choose a rating between 0.5 and 10.");
      return;
    }

    setSaving(true);
    setDialogError(null);
    try {
      const response = await fetch("/api/ratings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbId,
          mediaType,
          ...(seasonNumber !== undefined ? { seasonNumber } : {}),
          ...(episodeNumber !== undefined ? { episodeNumber } : {}),
          score,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not save your rating.");
      }

      setRatingResult({
        key: targetKey,
        eligible: true,
        rating: data.rating,
      });
      setHoveredScore(null);
      setDialogOpen(false);
    } catch (saveError) {
      console.error("Error saving user rating:", saveError);
      setDialogError(
        saveError instanceof Error
          ? saveError.message
          : "Your rating could not be saved. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const removeRating = async () => {
    setSaving(true);
    setDialogError(null);
    try {
      const response = await fetch(`/api/ratings?${targetKey}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not remove your rating.");
      }

      setRatingResult({ key: targetKey, eligible: true, rating: null });
      setHoveredScore(null);
      setDialogOpen(false);
    } catch (removeError) {
      console.error("Error removing user rating:", removeError);
      setDialogError(
        removeError instanceof Error
          ? removeError.message
          : "Your rating could not be removed. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!eligible || loading) return null;

  return (
    <>
      <div
        role="slider"
        aria-label={`Your rating for ${title}`}
        aria-valuemin={0.5}
        aria-valuemax={10}
        aria-valuenow={displayScore}
        aria-valuetext={
          displayScore > 0 ? `${displayScore} out of 10` : "Not rated"
        }
        tabIndex={0}
        onKeyDown={handleStarKeyDown}
        onPointerLeave={() => setHoveredScore(null)}
        className="my-4 flex w-fit items-center gap-0.5 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
      >
        {Array.from({ length: 10 }, (_, index) => {
          const fill = Math.max(0, Math.min(1, displayScore - index));
          return (
            <span
              key={index}
              aria-hidden="true"
              onPointerMove={(event) => {
                const { left, width } =
                  event.currentTarget.getBoundingClientRect();
                setHoveredScore(
                  index + (event.clientX < left + width / 2 ? 0.5 : 1),
                );
              }}
              onClick={(event) => {
                const { left, width } =
                  event.currentTarget.getBoundingClientRect();
                openDialog(
                  index + (event.clientX < left + width / 2 ? 0.5 : 1),
                );
              }}
              className="relative inline-block cursor-pointer select-none text-2xl leading-none transition-transform duration-150 hover:scale-125"
            >
              <span className="text-zinc-700">★</span>
              <span
                className="pointer-events-none absolute inset-y-0 left-0 block overflow-hidden text-amber-300 transition-[width] duration-150"
                style={{ width: `${fill * 100}%` }}
              >
                ★
              </span>
            </span>
          );
        })}
        {savedRating && (
          <span className="ml-2 text-xs text-zinc-500">
            ({Math.round(savedRating.score * 10) / 10})
          </span>
        )}
      </div>

      {dialogOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
            role="presentation"
            onClick={(event) => {
              if (event.target === event.currentTarget && !saving) {
                setDialogOpen(false);
              }
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="user-rating-title"
              className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl"
            >
              <h2
                id="user-rating-title"
                className="mb-2 text-xl font-bold text-white"
              >
                Confirm your rating
              </h2>
              <p className="mb-5 text-sm text-zinc-300">{title}</p>
              <form onSubmit={saveRating}>
                <label
                  htmlFor="user-rating-score"
                  className="mb-2 block text-sm font-medium text-zinc-200"
                >
                  Your score (out of 10)
                </label>
                <div className="mb-5 flex items-center gap-3">
                  <input
                    id="user-rating-score"
                    type="number"
                    min="0.5"
                    max="10"
                    step="0.1"
                    required
                    value={draftScore}
                    onChange={(event) => setDraftScore(event.target.value)}
                    className="w-28 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-base text-white focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                  />
                  <span className="text-sm text-zinc-400">/ 10</span>
                </div>
                {dialogError && (
                  <p role="alert" className="mb-4 text-sm text-red-300">
                    {dialogError}
                  </p>
                )}
                <div className="flex flex-wrap justify-between gap-3">
                  {savedRating && (
                    <button
                      type="button"
                      onClick={() => void removeRating()}
                      disabled={saving}
                      className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-red-500/40 px-4 py-2 text-sm font-medium text-red-300 transition hover:border-red-400 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? "Removing..." : "Remove rating"}
                    </button>
                  )}
                  <div className="ml-auto flex gap-3">
                    <button
                      type="button"
                      onClick={() => setDialogOpen(false)}
                      disabled={saving}
                      className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save rating"}
                    </button>
                  </div>
                </div>
              </form>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
