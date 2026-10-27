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
    <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-md border border-violet-400/15 bg-violet-500/5 px-1.5 py-1 text-[8px] leading-tight sm:text-[9px]">
      <span className="whitespace-nowrap text-violet-200">
        {formatRuntime(episodeRuntimeMinutes)}
      </span>
      <span className="h-2.5 border-l border-white/15" aria-hidden="true" />
      <span className="min-w-0 text-zinc-300">
        {remainingEpisodeCount ?? "--"} left
        <span className="px-0.5 text-xs leading-none text-zinc-400">·</span>
        {formatRuntime(remainingRuntimeMinutes)}
      </span>
    </div>
  );
}
