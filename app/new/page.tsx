"use client";

import { useState, useEffect } from "react";
import MediaCard from "@/components/media-card";
import { getRandomBackdropUrl, getTrendingMedia } from "@/lib/tmdb";

export default function NewPage() {
  const [trendingMedia, setTrendingMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageBackdrop, setPageBackdrop] = useState("");

  useEffect(() => {
    let isMounted = true;

    const fetchTrending = async () => {
      const media = await getTrendingMedia();
      if (!isMounted) return;
      setTrendingMedia(media);
      setPageBackdrop(getRandomBackdropUrl(media));
      setLoading(false);
    };

    void fetchTrending();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="relative flex flex-col flex-1 items-center font-sans min-h-screen bg-black overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-black/70 via-black/40 to-black/80">
        {pageBackdrop && (
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40"
            style={{ backgroundImage: `url(${pageBackdrop})` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/50 to-black/80" />
      </div>

      <main className="relative z-10 w-full max-w-[1650px] mx-auto px-4 sm:px-6 lg:px-8 py-16 flex-1">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">
            New & Trending
          </h1>
          <p className="text-xl text-zinc-400">
            Discover the latest movies and TV shows everyone is watching
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-3 py-8 text-violet-300">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-violet-300" />
            <span className="text-sm font-medium uppercase tracking-[0.2em]">
              Loading
            </span>
          </div>
        ) : trendingMedia.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {trendingMedia.map((media) => (
              <MediaCard key={media.id} media={media} />
            ))}
          </div>
        ) : (
          <div className="text-center text-zinc-400">
            No trending media available at the moment.
          </div>
        )}
      </main>
    </div>
  );
}
