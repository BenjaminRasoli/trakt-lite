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
    <div className="absolute bottom-2 left-2 right-2 z-10 flex flex-col items-start gap-1">
      <div className="flex w-full flex-col gap-0.5 whitespace-nowrap rounded-md border border-white/10 bg-black/50 px-1.5 py-1 text-[8px] font-medium text-white shadow-lg backdrop-blur-sm sm:text-[9px] xl:flex-row xl:items-center xl:justify-between xl:gap-1.5">
        <span className="shrink-0">{formatRuntime(episodeRuntimeMinutes)}</span>
        <span className="flex min-w-0 flex-col items-start gap-0.5 whitespace-nowrap lg:flex-row lg:items-center lg:gap-1 xl:justify-end">
          <span className="shrink-0">
            {remainingEpisodeCount ?? "--"}{" "}
            {remainingEpisodeCount === 1 ? "episode" : "episodes"} left
          </span>
          <span className="hidden shrink-0 text-zinc-400 lg:inline">•</span>
          <span className="hidden lg:block shrink-0">
            {formatRuntime(remainingRuntimeMinutes)}
          </span>
        </span>
      </div>
    </div>
  );
}
