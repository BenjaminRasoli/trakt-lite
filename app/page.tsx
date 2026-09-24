import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center font-sans min-h-screen relative overflow-hidden">
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage:
            "url(https://image.tmdb.org/t/p/original/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80"></div>
      </div>

      <main className="relative z-10 flex flex-col items-center justify-center w-full max-w-4xl px-8 py-16 gap-12 flex-1">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
            Trakt Lite
          </h1>
          <p className="text-xl text-zinc-300 max-w-2xl mb-8">
            Track your favorite movies and TV shows
          </p>
          <Link
            href="/auth"
            className="inline-block cursor-pointer px-8 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-violet-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-violet-500/25"
          >
            Get Started
          </Link>
        </div>
      </main>
    </div>
  );
}
