"use client";

import { useState, useEffect } from "react";
import MediaCard from "@/components/media-card";
import { getTrendingMedia } from "@/lib/tmdb";

export default function NewPage() {
  const [trendingMedia, setTrendingMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrending = async () => {
      const media = await getTrendingMedia();
      setTrendingMedia(media);
      setLoading(false);
    };

    fetchTrending();
  }, []);

  return (
    <div className="flex flex-col flex-1 items-center font-sans min-h-screen bg-black">
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex-1">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">
            New & Trending
          </h1>
          <p className="text-xl text-zinc-400">
            Discover the latest movies and TV shows everyone is watching
          </p>
        </div>

        {loading ? (
          <div className="text-center text-zinc-400">Loading trending media...</div>
        ) : trendingMedia.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
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