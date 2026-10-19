import EpisodeTypeBadge, {
  isSpecialEpisodeType,
} from "@/components/episode-type-badge";

function formatRuntime(minutes?: number | null) {
  if (typeof minutes !== "number" || minutes <= 0) return "--h --m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

export default function NextUpEpisodeInfo({
  episodeType,
  episodeRuntimeMinutes,
  remainingEpisodeCount,
  remainingRuntimeMinutes,
}: {
  episodeType?: string | null;
  episodeRuntimeMinutes?: number | null;
  remainingEpisodeCount?: number | null;
  remainingRuntimeMinutes?: number | null;
}) {
  return (
    <div className="absolute bottom-2 left-2 right-2 z-10 flex flex-col items-start gap-1">
      {isSpecialEpisodeType(episodeType) && (
        <EpisodeTypeBadge episodeType={episodeType} inline />
      )}
      <div className="flex w-full items-center justify-between gap-1 overflow-hidden whitespace-nowrap rounded-md border border-white/10 bg-black/50 px-1.5 py-1 text-[7px] font-medium text-white shadow-lg backdrop-blur-sm sm:gap-1.5 sm:text-[9px]">
        <span className="shrink-0">{formatRuntime(episodeRuntimeMinutes)}</span>
        <span className="flex min-w-0 items-center justify-end gap-1 overflow-hidden whitespace-nowrap">
          <span className="shrink-0">
            {remainingEpisodeCount ?? "--"}{" "}
            {remainingEpisodeCount === 1 ? "episode" : "episodes"} left
          </span>
          <span className="shrink-0 text-zinc-400">•</span>
          <span className="min-w-0 truncate">
            {formatRuntime(remainingRuntimeMinutes)}
          </span>
        </span>
      </div>
    </div>
  );
}
