"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import MediaCard from "@/components/media-card";
import { useSupabase } from "@/components/supabase-provider";
import { getPersonDetails, getProfileUrl } from "@/lib/tmdb";
import type { TMDBPersonDetails } from "@/lib/tmdb";

interface WatchedMedia {
  tmdbId: number;
  mediaType: "movie" | "tv";
}

function isWatchedMedia(value: unknown): value is WatchedMedia {
  return (
    typeof value === "object" &&
    value !== null &&
    "tmdbId" in value &&
    typeof value.tmdbId === "number" &&
    "mediaType" in value &&
    (value.mediaType === "movie" || value.mediaType === "tv")
  );
}

function formatPersonDate(value: string | null): string | null {
  if (!value) return null;

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getPersonAge(
  birthday: string | null,
  deathday: string | null,
): number | null {
  if (!birthday) return null;

  const birthDate = new Date(`${birthday}T00:00:00`);
  const endDate = deathday ? new Date(`${deathday}T00:00:00`) : new Date();
  if (
    Number.isNaN(birthDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    birthDate > endDate
  ) {
    return null;
  }

  let age = endDate.getFullYear() - birthDate.getFullYear();
  if (
    endDate.getMonth() < birthDate.getMonth() ||
    (endDate.getMonth() === birthDate.getMonth() &&
      endDate.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }

  return age;
}

export default function ActorPage() {
  const params = useParams<{ id: string }>();
  const personId = Number(params.id);
  const validPersonId = Number.isSafeInteger(personId) && personId > 0;
  const supabase = useSupabase();
  const [personResult, setPersonResult] = useState<{
    id: number;
    person: TMDBPersonDetails | null;
    failed: boolean;
  } | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [watchedMedia, setWatchedMedia] = useState<WatchedMedia[]>([]);
  const [watchedLoading, setWatchedLoading] = useState(true);
  const [watchedError, setWatchedError] = useState(false);
  const [expandedBiographyId, setExpandedBiographyId] = useState<number | null>(
    null,
  );

  const person = personResult?.id === personId ? personResult.person : null;
  const personLoading = validPersonId && personResult?.id !== personId;
  const personError = personResult?.id === personId && personResult.failed;

  useEffect(() => {
    if (!validPersonId) return;

    let active = true;

    getPersonDetails(personId)
      .then((details) => {
        if (!active) return;
        setPersonResult({ id: personId, person: details, failed: !details });
      })
      .catch((error) => {
        console.error("Error loading actor details:", error);
        if (active) {
          setPersonResult({ id: personId, person: null, failed: true });
        }
      });

    return () => {
      active = false;
    };
  }, [personId, validPersonId]);

  useEffect(() => {
    let active = true;

    const loadWatchedMedia = async () => {
      setAuthLoading(true);
      setWatchedLoading(true);
      setWatchedError(false);

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;
        if (!active) return;

        setIsAuthenticated(Boolean(user));
        if (!user) {
          setWatchedMedia([]);
          return;
        }

        const response = await fetch("/api/watch-history/media");
        if (!response.ok) {
          throw new Error(`Watched media request failed (${response.status})`);
        }

        const data: { items?: unknown } = await response.json();
        if (!Array.isArray(data.items)) {
          throw new Error("Watched media response was invalid");
        }

        if (active) setWatchedMedia(data.items.filter(isWatchedMedia));
      } catch (error) {
        console.error("Error loading watched media for actor:", error);
        if (active) setWatchedError(true);
      } finally {
        if (active) {
          setAuthLoading(false);
          setWatchedLoading(false);
        }
      }
    };

    loadWatchedMedia();

    return () => {
      active = false;
    };
  }, [supabase]);

  const allCredits = useMemo(() => {
    const seen = new Set<string>();
    return (person?.combined_credits?.cast ?? []).filter((credit) => {
      const key = `${credit.media_type}:${credit.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [person]);

  const credits = useMemo(
    () =>
      allCredits.filter((credit) => {
        const character = credit.character?.trim() ?? "";
        const isSelfAppearance =
          /^(as\s+)?(himself|herself|themself|themselves|self)(\b|$)/i.test(
            character,
          );
        const isTalkShow = credit.genre_ids?.includes(10767);
        return !isSelfAppearance && !isTalkShow;
      }),
    [allCredits],
  );

  const watchedKeys = useMemo(
    () =>
      new Set(
        watchedMedia.map((media) => `${media.mediaType}:${media.tmdbId}`),
      ),
    [watchedMedia],
  );

  const watchedCredits = useMemo(
    () =>
      allCredits.filter((credit) =>
        watchedKeys.has(`${credit.media_type}:${credit.id}`),
      ),
    [allCredits, watchedKeys],
  );

  const popularCredits = useMemo(
    () =>
      [...credits]
        .sort(
          (a, b) =>
            (b.popularity ?? 0) - (a.popularity ?? 0) ||
            (b.vote_count ?? 0) - (a.vote_count ?? 0),
        )
        .slice(0, 6),
    [credits],
  );

  if (personLoading || authLoading) {
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

  if (!validPersonId || personError || !person) {
    return (
      <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-black px-4 font-sans">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-white">
            Actor Not Found
          </h1>
          <p className="mb-6 text-zinc-400">
            This actor&apos;s details could not be loaded.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:border-violet-400 hover:bg-violet-500/20"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  const birthDate = formatPersonDate(person.birthday);
  const deathDate = formatPersonDate(person.deathday);
  const age = getPersonAge(person.birthday, person.deathday);
  const profileUrl = getProfileUrl(person.profile_path, "h632");
  const hasLongBiography = person.biography.length > 300;
  const biographyExpanded = expandedBiographyId === person.id;

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-black font-sans">
      <main className="relative z-10 mx-auto w-full max-w-[1650px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <section className="mb-14 flex flex-col gap-6 md:flex-row md:gap-8">
          <div className="mx-auto w-full max-w-[240px] flex-shrink-0 md:mx-0 md:w-1/4">
            <img
              src={profileUrl}
              alt={person.name}
              className="w-full rounded-xl border border-zinc-700/50 object-cover shadow-2xl shadow-violet-500/10"
              onError={(event) => {
                event.currentTarget.src = "/placeholder-avatar.svg";
              }}
            />
          </div>

          <div className="w-full md:w-3/4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {person.known_for_department && (
                <span className="rounded bg-violet-600 px-2 py-1 text-xs font-semibold uppercase text-white">
                  {person.known_for_department}
                </span>
              )}
              {birthDate && (
                <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
                  Born {birthDate}
                </span>
              )}
              {deathDate && (
                <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
                  Died {deathDate}
                </span>
              )}
              {age !== null && (
                <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
                  {deathDate ? `Age ${age} at death` : `Age ${age}`}
                </span>
              )}
            </div>

            <h1 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
              {person.name}
            </h1>

            {person.place_of_birth && (
              <p className="mb-4 text-sm text-zinc-400">
                {person.place_of_birth}
              </p>
            )}

            <h2 className="mb-2 text-lg font-semibold text-white">Biography</h2>
            <p
              className={`whitespace-pre-line text-sm leading-7 text-zinc-300 ${
                hasLongBiography && !biographyExpanded ? "line-clamp-5" : ""
              }`}
            >
              {person.biography || "No biography is available for this actor."}
            </p>
            {hasLongBiography && (
              <button
                type="button"
                onClick={() =>
                  setExpandedBiographyId(biographyExpanded ? null : person.id)
                }
                className="mt-2 cursor-pointer text-sm font-semibold text-violet-300 transition-colors hover:text-violet-200"
                aria-expanded={biographyExpanded}
              >
                {biographyExpanded ? "Read less" : "Read more"}
              </button>
            )}
          </div>
        </section>

        <section className="mb-14">
          <h2 className="mb-5 text-2xl font-bold text-white">
            You&apos;ve watched
          </h2>

          {authLoading || watchedLoading ? (
            <p className="text-sm text-zinc-400">
              Checking your watch history...
            </p>
          ) : watchedError ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              Your watch history could not be loaded. Please try again later.
            </p>
          ) : !isAuthenticated ? (
            <p className="rounded-lg border border-zinc-700/50 bg-zinc-900/60 p-4 text-sm text-zinc-400">
              <Link
                href="/auth"
                className="font-semibold text-violet-300 hover:text-violet-200"
              >
                Sign in
              </Link>{" "}
              to see titles you&apos;ve watched featuring {person.name}.
            </p>
          ) : watchedCredits.length > 0 ? (
            <div className="grid gap-3 grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
              {watchedCredits.map((credit) => (
                <MediaCard
                  key={`${credit.media_type}:${credit.id}`}
                  media={credit}
                  subtitle={
                    credit.character ? `as ${credit.character}` : undefined
                  }
                />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-zinc-700/50 bg-zinc-900/60 p-4 text-sm text-zinc-400">
              You haven&apos;t watched any titles featuring {person.name} yet.
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-5 text-2xl font-bold text-white">Known for</h2>
          {credits.length > 0 ? (
            <div className="grid gap-3 grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
              {popularCredits.map((credit) => (
                <MediaCard
                  key={`${credit.media_type}:${credit.id}`}
                  media={credit}
                  subtitle={
                    credit.character ? `as ${credit.character}` : undefined
                  }
                />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-zinc-700/50 bg-zinc-900/60 p-4 text-sm text-zinc-400">
              No acting credits are available.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
