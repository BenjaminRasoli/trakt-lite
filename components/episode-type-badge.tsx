const EPISODE_TYPE_STYLES: Record<string, string> = {
  premiere:
    "border-emerald-300/30 bg-emerald-950/90 text-emerald-200",
  season_premiere:
    "border-emerald-300/30 bg-emerald-950/90 text-emerald-200",
  series_premiere:
    "border-emerald-300/30 bg-emerald-950/90 text-emerald-200",
  finale: "border-rose-300/30 bg-rose-950/90 text-rose-200",
  season_finale: "border-rose-300/30 bg-rose-950/90 text-rose-200",
  series_finale: "border-rose-300/30 bg-rose-950/90 text-rose-200",
  mid_season: "border-sky-300/30 bg-sky-950/90 text-sky-200",
  mid_season_premiere: "border-sky-300/30 bg-sky-950/90 text-sky-200",
  mid_season_finale: "border-sky-300/30 bg-sky-950/90 text-sky-200",
};

const EPISODE_TYPE_LABELS: Record<string, string> = {
  premiere: "Premiere",
  season_premiere: "Premiere",
  series_premiere: "Series Premiere",
  finale: "Finale",
  season_finale: "Season Finale",
  series_finale: "Series Finale",
  mid_season: "Mid-Season",
  mid_season_premiere: "Mid-Season Premiere",
  mid_season_finale: "Mid-Season Finale",
};

export default function EpisodeTypeBadge({
  episodeType,
}: {
  episodeType?: string | null;
}) {
  if (!episodeType) return null;

  const type = episodeType.toLowerCase().replace(/[\s-]+/g, "_");
  const label = EPISODE_TYPE_LABELS[type];
  const style = EPISODE_TYPE_STYLES[type];
  if (!label || !style) return null;

  return (
    <span
      className={`absolute left-2 top-2 z-10 max-w-[calc(100%-1rem)] truncate rounded-md border px-1.5 py-1 text-[9px] font-semibold leading-none shadow-lg backdrop-blur-sm sm:text-[10px] ${style}`}
    >
      {label}
    </span>
  );
}
