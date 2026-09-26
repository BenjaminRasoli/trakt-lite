"use client";

import { useEffect, useState } from "react";
import AuthForm from "@/components/auth-form";
import { getRandomBackdropUrl, getTrendingMedia } from "@/lib/tmdb";

export default function AuthPage() {
  const [backdrop, setBackdrop] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadBackdrop = async () => {
      const trendingMedia = await getTrendingMedia();
      if (!isMounted) return;
      setBackdrop(getRandomBackdropUrl(trendingMedia));
    };

    void loadBackdrop();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="relative flex h-screen flex-col items-center justify-center overflow-hidden font-sans">
      <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80">
        {backdrop && (
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-70"
            style={{ backgroundImage: `url(${backdrop})` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/40 to-black/70"></div>
      </div>

      <main className="relative z-10 flex h-full w-full max-w-5xl items-center justify-center px-8 py-8">
        <AuthForm />
      </main>
    </div>
  );
}
