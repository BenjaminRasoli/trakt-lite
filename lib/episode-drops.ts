export interface CollapsibleEpisodeItem {
  tmdbId: number;
  airDate?: string | null;
  seasonNumber?: number | null;
  episodeNumber?: number | null;
  episodeTitle?: string | null;
  episodeType?: string | null;
}

export type CollapsedEpisodeItem<T extends CollapsibleEpisodeItem> = T & {
  episodeRange?: string;
  isEntireSeason?: boolean;
};

/**
 * Collapses groups of episodes from the same show airing on the same date
 * into a single "Season N" entry when they all belong to one season.
 * Preserves the relative order of first appearance.
 */
export function collapseEpisodeDrops<T extends CollapsibleEpisodeItem>(
  items: T[],
): CollapsedEpisodeItem<T>[] {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const key = `${item.airDate ?? "unknown"}:${item.tmdbId}`;
    const group = groups.get(key);
    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }

  const result: CollapsedEpisodeItem<T>[] = [];

  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }

    const seasons = new Set(group.map((item) => item.seasonNumber));
    if (seasons.size !== 1) {
      result.push(...group);
      continue;
    }

    const seasonNumber = group[0].seasonNumber;
    const episodeNumbers = group
      .map((item) => item.episodeNumber)
      .filter((n): n is number => typeof n === "number" && n !== null)
      .sort((a, b) => a - b);

    if (episodeNumbers.length === 0) {
      result.push(...group);
      continue;
    }

    const minEp = episodeNumbers[0];
    const maxEp = episodeNumbers[episodeNumbers.length - 1];
    const premiere = group.find(
      (item) => item.episodeNumber === 1 && item.episodeType === "season_premiere",
    );

    const combined: CollapsedEpisodeItem<T> = {
      ...group[0],
      episodeType: premiere ? "season_premiere" : null,
      episodeTitle:
        minEp === maxEp ? group[0].episodeTitle : `Season ${seasonNumber}`,
      episodeRange: minEp === maxEp ? `E${minEp}` : `E${minEp}-${maxEp}`,
      isEntireSeason: episodeNumbers.length > 5,
    };

    result.push(combined);
  }

  return result;
}
