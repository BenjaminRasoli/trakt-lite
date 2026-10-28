export { isSpecialEpisodeType } from "@/components/episode-type-badge";

function formatRuntime(minutes?: number | null) {
  if (typeof minutes !== "number" || minutes <= 0) return "--h --m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

export default function NextUpEpisodeInfo({
  episodeRuntimeMinutes,
  remainingEpisodeCount,
  remainingRuntimeMinutes,
}: {
  episodeRuntimeMinutes?: number | null;
  remainingEpisodeCount?: number | null;
  remainingRuntimeMinutes?: number | null;
}) {
  return (
    <div className="mt-auto flex min-h-9 flex-col justify-center gap-0.5 rounded-md border border-violet-400/15 bg-violet-500/5 px-1.5 py-1 text-[8px] leading-tight sm:min-h-0 sm:py-[5px] sm:justify-start sm:flex-row sm:items-baseline sm:gap-1 sm:text-[9px]">
      <span className="whitespace-nowrap text-violet-200 sm:shrink-0">
        {formatRuntime(episodeRuntimeMinutes)}
      </span>
      <span className="hidden text-zinc-500 sm:inline">|</span>
      <span className="min-w-0 truncate text-zinc-300">
        {remainingEpisodeCount ?? "--"} left
        <span className="px-0.5 text-zinc-400">·</span>
        {formatRuntime(remainingRuntimeMinutes)}
      </span>
    </div>
  );
}
