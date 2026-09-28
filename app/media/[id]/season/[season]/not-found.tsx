import Link from "next/link";

export default function SeasonNotFound() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center font-sans min-h-screen bg-black relative overflow-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80">
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/40 to-black/70"></div>
      </div>

      <main className="relative z-10 flex flex-col items-center justify-center w-full max-w-4xl px-8 py-16 gap-12 flex-1">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-violet-400 mb-4 tracking-tight">
            404
          </h1>
          <h2 className="text-3xl font-bold text-white mb-4">
            Season not found
          </h2>
          <p className="text-xl text-zinc-300 max-w-2xl mb-8">
            The season you're looking for doesn't exist or has been removed.
          </p>
          <Link
            href="/"
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-8 py-3 text-base font-semibold text-violet-100 shadow-lg shadow-violet-500/10 transition hover:border-violet-400 hover:bg-violet-500/20"
          >
            Go back home
          </Link>
        </div>
      </main>
    </div>
  );
}
