export type AchievementMetric =
  | "totalWatches"
  | "movies"
  | "episodes"
  | "tvShows"
  | "genres"
  | "ratings"
  | "highRatings"
  | "lowRatings"
  | "activeDays"
  | "longestStreak"
  | "weekendWatches"
  | "activeMonths"
  | "filmEras"
  | "watchlist"
  | "rewatch"
  | "longestDay"
  | "lateNight"
  | "activeYears"
  | "perfectRatings";

export type AchievementStats = Record<AchievementMetric, number>;

export type Achievement = {
  id: string;
  title: string;
  description: string;
  category:
    | "Watching"
    | "Movies"
    | "TV"
    | "Discovery"
    | "Ratings"
    | "Collection";
  icon: string;
  metric: AchievementMetric;
  target: number;
  xp: number;
};

export type AchievementProgress = Achievement & {
  progress: number;
  earned: boolean;
};

export type AchievementSummary = {
  badges: AchievementProgress[];
  earnedCount: number;
  totalBadges: number;
  xp: number;
  level: number;
  rank: string;
  progressInLevel: number;
  xpForNextLevel: number;
  levelXpCost: number;
  progressPercent: number;
};

export type AchievementApiResponse = AchievementSummary & {
  genreSync: {
    cursor: number | null;
    failed: number;
    httpStatuses: number[];
  };
};

export const achievementDefinitions: Achievement[] = [
  {
    id: "first-watch",
    title: "Opening Credits",
    description: "Log your first movie or episode.",
    category: "Watching",
    icon: "🎬",
    metric: "totalWatches",
    target: 1,
    xp: 10,
  },
  {
    id: "watch-100",
    title: "Century on Screen",
    description: "Log 100 movies and episodes.",
    category: "Watching",
    icon: "🍿",
    metric: "totalWatches",
    target: 100,
    xp: 75,
  },
  {
    id: "watch-500",
    title: "Screen Marathon",
    description: "Log 500 movies and episodes.",
    category: "Watching",
    icon: "🏆",
    metric: "totalWatches",
    target: 500,
    xp: 150,
  },
  {
    id: "watch-1000",
    title: "Four-Digit Film Buff",
    description: "Log 1,000 movies and episodes.",
    category: "Watching",
    icon: "🎟️",
    metric: "totalWatches",
    target: 1000,
    xp: 200,
  },
  {
    id: "watch-2500",
    title: "Archive Keeper",
    description: "Log 2,500 movies and episodes.",
    category: "Watching",
    icon: "🗃️",
    metric: "totalWatches",
    target: 2500,
    xp: 300,
  },
  {
    id: "watch-5000",
    title: "The Living Library",
    description: "Log 5,000 movies and episodes.",
    category: "Watching",
    icon: "🏛️",
    metric: "totalWatches",
    target: 5000,
    xp: 500,
  },
  {
    id: "first-movie",
    title: "First Feature",
    description: "Watch your first movie.",
    category: "Movies",
    icon: "🎞️",
    metric: "movies",
    target: 1,
    xp: 10,
  },
  {
    id: "three-movies",
    title: "Triple Feature",
    description: "Watch 3 different movies.",
    category: "Movies",
    icon: "🍿",
    metric: "movies",
    target: 3,
    xp: 15,
  },
  {
    id: "ten-movies",
    title: "Movie Buff",
    description: "Watch 10 different movies.",
    category: "Movies",
    icon: "🎥",
    metric: "movies",
    target: 10,
    xp: 30,
  },
  {
    id: "twenty-five-movies",
    title: "Film Fanatic",
    description: "Watch 25 different movies.",
    category: "Movies",
    icon: "🌟",
    metric: "movies",
    target: 25,
    xp: 50,
  },
  {
    id: "hundred-movies",
    title: "Reel Legend",
    description: "Watch 100 different movies.",
    category: "Movies",
    icon: "🏅",
    metric: "movies",
    target: 100,
    xp: 100,
  },
  {
    id: "two-hundred-fifty-movies",
    title: "Feature Archivist",
    description: "Watch 250 different movies.",
    category: "Movies",
    icon: "🎞️",
    metric: "movies",
    target: 250,
    xp: 175,
  },
  {
    id: "first-episode",
    title: "Series Premiere",
    description: "Log your first TV episode.",
    category: "TV",
    icon: "📺",
    metric: "episodes",
    target: 1,
    xp: 10,
  },
  {
    id: "ten-episodes",
    title: "Binge Starter",
    description: "Log 10 TV episodes.",
    category: "TV",
    icon: "📼",
    metric: "episodes",
    target: 10,
    xp: 20,
  },
  {
    id: "twenty-five-episodes",
    title: "Episode Enthusiast",
    description: "Log 25 TV episodes.",
    category: "TV",
    icon: "📺",
    metric: "episodes",
    target: 25,
    xp: 35,
  },
  {
    id: "fifty-episodes",
    title: "Seasoned Viewer",
    description: "Log 50 TV episodes.",
    category: "TV",
    icon: "🌙",
    metric: "episodes",
    target: 50,
    xp: 50,
  },
  {
    id: "hundred-episodes",
    title: "Episode Century",
    description: "Log 100 TV episodes.",
    category: "TV",
    icon: "💯",
    metric: "episodes",
    target: 100,
    xp: 80,
  },
  {
    id: "five-hundred-episodes",
    title: "TV Legend",
    description: "Log 500 TV episodes.",
    category: "TV",
    icon: "🏆",
    metric: "episodes",
    target: 500,
    xp: 150,
  },
  {
    id: "three-shows",
    title: "Series Hopper",
    description: "Watch episodes from 3 different shows.",
    category: "TV",
    icon: "🧭",
    metric: "tvShows",
    target: 3,
    xp: 20,
  },
  {
    id: "ten-shows",
    title: "Show Collector",
    description: "Watch episodes from 10 different shows.",
    category: "TV",
    icon: "📚",
    metric: "tvShows",
    target: 10,
    xp: 35,
  },
  {
    id: "twenty-five-shows",
    title: "Small-Screen Scholar",
    description: "Watch episodes from 25 different shows.",
    category: "TV",
    icon: "🎓",
    metric: "tvShows",
    target: 25,
    xp: 75,
  },
  {
    id: "fifty-shows",
    title: "Television Connoisseur",
    description: "Watch episodes from 50 different shows.",
    category: "TV",
    icon: "📡",
    metric: "tvShows",
    target: 50,
    xp: 125,
  },
  {
    id: "three-genres",
    title: "Genre Sampler",
    description: "Explore 3 different genres.",
    category: "Discovery",
    icon: "🧭",
    metric: "genres",
    target: 3,
    xp: 15,
  },
  {
    id: "five-genres",
    title: "Genre Explorer",
    description: "Explore 5 different genres.",
    category: "Discovery",
    icon: "🗺️",
    metric: "genres",
    target: 5,
    xp: 30,
  },
  {
    id: "ten-genres",
    title: "Genre Adventurer",
    description: "Explore 10 different genres.",
    category: "Discovery",
    icon: "🌎",
    metric: "genres",
    target: 10,
    xp: 60,
  },
  {
    id: "twenty-genres",
    title: "Genre Cartographer",
    description: "Explore 20 different genres.",
    category: "Discovery",
    icon: "🧭",
    metric: "genres",
    target: 20,
    xp: 100,
  },
  {
    id: "first-rating",
    title: "First Impression",
    description: "Rate your first movie, show, season, or episode.",
    category: "Ratings",
    icon: "⭐",
    metric: "ratings",
    target: 1,
    xp: 10,
  },
  {
    id: "ten-ratings",
    title: "The Critic",
    description: "Rate 10 movies, shows, seasons, or episodes.",
    category: "Ratings",
    icon: "✍️",
    metric: "ratings",
    target: 10,
    xp: 35,
  },
  {
    id: "hundred-ratings",
    title: "Rating Regular",
    description: "Rate 100 movies, shows, seasons, or episodes.",
    category: "Ratings",
    icon: "🌟",
    metric: "ratings",
    target: 100,
    xp: 100,
  },
  {
    id: "two-hundred-fifty-ratings",
    title: "The Rating Archive",
    description: "Rate 250 movies, shows, seasons, or episodes.",
    category: "Ratings",
    icon: "🗂️",
    metric: "ratings",
    target: 250,
    xp: 175,
  },
  {
    id: "ten-high-ratings",
    title: "Standing Ovation",
    description: "Give 10 ratings of 9 or higher.",
    category: "Ratings",
    icon: "👏",
    metric: "highRatings",
    target: 10,
    xp: 40,
  },
  {
    id: "ten-low-ratings",
    title: "No Free Passes",
    description: "Give 10 ratings of 3 or lower.",
    category: "Ratings",
    icon: "🧐",
    metric: "lowRatings",
    target: 10,
    xp: 40,
  },
  {
    id: "seven-active-days",
    title: "A Week in Stories",
    description: "Log something on 7 different days.",
    category: "Watching",
    icon: "🗓️",
    metric: "activeDays",
    target: 7,
    xp: 20,
  },
  {
    id: "thirty-active-days",
    title: "Regular on the Reel",
    description: "Log something on 30 different days.",
    category: "Watching",
    icon: "📆",
    metric: "activeDays",
    target: 30,
    xp: 50,
  },
  {
    id: "hundred-active-days",
    title: "A Hundred-Day Story",
    description: "Log something on 100 different days.",
    category: "Watching",
    icon: "💯",
    metric: "activeDays",
    target: 100,
    xp: 100,
  },
  {
    id: "three-day-streak",
    title: "Three-Day Feature",
    description: "Log something on 3 consecutive days.",
    category: "Watching",
    icon: "🔥",
    metric: "longestStreak",
    target: 3,
    xp: 20,
  },
  {
    id: "seven-day-streak",
    title: "Weekly Watch Habit",
    description: "Log something on 7 consecutive days.",
    category: "Watching",
    icon: "🔥",
    metric: "longestStreak",
    target: 7,
    xp: 45,
  },
  {
    id: "thirty-day-streak",
    title: "One-Month Marathon",
    description: "Log something on 30 consecutive days.",
    category: "Watching",
    icon: "🏅",
    metric: "longestStreak",
    target: 30,
    xp: 150,
  },
  {
    id: "weekend-25",
    title: "Weekend Double Feature",
    description: "Log 25 movies or episodes on a weekend.",
    category: "Watching",
    icon: "🌤️",
    metric: "weekendWatches",
    target: 25,
    xp: 35,
  },
  {
    id: "weekend-100",
    title: "Weekend Regular",
    description: "Log 100 movies or episodes on a weekend.",
    category: "Watching",
    icon: "🍿",
    metric: "weekendWatches",
    target: 100,
    xp: 75,
  },
  {
    id: "all-months",
    title: "Every Season, Every Month",
    description: "Log something in all 12 months of the year.",
    category: "Watching",
    icon: "🌎",
    metric: "activeMonths",
    target: 12,
    xp: 60,
  },
  {
    id: "three-film-eras",
    title: "Time Traveler",
    description: "Watch movies or shows from 3 different decades.",
    category: "Discovery",
    icon: "⏳",
    metric: "filmEras",
    target: 3,
    xp: 35,
  },
  {
    id: "five-film-eras",
    title: "Across the Ages",
    description: "Watch movies or shows from 5 different decades.",
    category: "Discovery",
    icon: "🕰️",
    metric: "filmEras",
    target: 5,
    xp: 75,
  },
  {
    id: "watch-250",
    title: "Quarter-Thousand Club",
    description: "Log 250 movies and episodes.",
    category: "Watching",
    icon: "🎬",
    metric: "totalWatches",
    target: 250,
    xp: 100,
  },
  {
    id: "watch-10000",
    title: "Ten Thousand Screenings",
    description: "Log 10,000 movies and episodes.",
    category: "Watching",
    icon: "🌌",
    metric: "totalWatches",
    target: 10000,
    xp: 750,
  },
  {
    id: "rewatch-25",
    title: "Second Helping",
    description: "Rewatch 25 movies or episodes.",
    category: "Watching",
    icon: "🔁",
    metric: "rewatch",
    target: 25,
    xp: 40,
  },
  {
    id: "rewatch-100",
    title: "Certified Rewatch",
    description: "Rewatch 100 movies or episodes.",
    category: "Watching",
    icon: "♻️",
    metric: "rewatch",
    target: 100,
    xp: 90,
  },
  {
    id: "rewatch-500",
    title: "Glutton for Repeats",
    description: "Rewatch 500 movies or episodes.",
    category: "Watching",
    icon: "🧟",
    metric: "rewatch",
    target: 500,
    xp: 200,
  },
  {
    id: "longest-day-5",
    title: "Matinee Marathon",
    description: "Log 5 movies or episodes in a single day.",
    category: "Watching",
    icon: "📽️",
    metric: "longestDay",
    target: 5,
    xp: 30,
  },
  {
    id: "longest-day-10",
    title: "Projector Room",
    description: "Log 10 movies or episodes in a single day.",
    category: "Watching",
    icon: "🎞️",
    metric: "longestDay",
    target: 10,
    xp: 75,
  },
  {
    id: "longest-day-25",
    title: "All-Nighter at the Cinema",
    description: "Log 25 movies or episodes in a single day.",
    category: "Watching",
    icon: "🌙",
    metric: "longestDay",
    target: 25,
    xp: 150,
  },
  {
    id: "late-night-10",
    title: "Midnight Matinee",
    description: "Log 10 movies or episodes between midnight and 5 AM.",
    category: "Watching",
    icon: "🦉",
    metric: "lateNight",
    target: 10,
    xp: 35,
  },
  {
    id: "late-night-50",
    title: "Vampire's Schedule",
    description: "Log 50 movies or episodes between midnight and 5 AM.",
    category: "Watching",
    icon: "🧛",
    metric: "lateNight",
    target: 50,
    xp: 90,
  },
  {
    id: "active-years-2",
    title: "New Year, New Reel",
    description: "Log something in 2 different calendar years.",
    category: "Watching",
    icon: "🎇",
    metric: "activeYears",
    target: 2,
    xp: 40,
  },
  {
    id: "active-years-3",
    title: "Holiday Fixture",
    description: "Log something in 3 different calendar years.",
    category: "Watching",
    icon: "🗓️",
    metric: "activeYears",
    target: 3,
    xp: 80,
  },
  {
    id: "streak-60",
    title: "Two-Month Marathon",
    description: "Log something on 60 consecutive days.",
    category: "Watching",
    icon: "🔥",
    metric: "longestStreak",
    target: 60,
    xp: 250,
  },
  {
    id: "streak-100",
    title: "Unbroken Reel",
    description: "Log something on 100 consecutive days.",
    category: "Watching",
    icon: "⚡",
    metric: "longestStreak",
    target: 100,
    xp: 400,
  },
  {
    id: "weekend-250",
    title: "Weekend Warrior",
    description: "Log 250 movies or episodes on a weekend.",
    category: "Watching",
    icon: "🛡️",
    metric: "weekendWatches",
    target: 250,
    xp: 120,
  },
  {
    id: "active-days-365",
    title: "Year of Stories",
    description: "Log something on 365 different days.",
    category: "Watching",
    icon: "🗓️",
    metric: "activeDays",
    target: 365,
    xp: 200,
  },
  {
    id: "movies-500",
    title: "Half-Thousand Features",
    description: "Watch 500 different movies.",
    category: "Movies",
    icon: "🎬",
    metric: "movies",
    target: 500,
    xp: 250,
  },
  {
    id: "movies-1000",
    title: "Millennium of Movies",
    description: "Watch 1,000 different movies.",
    category: "Movies",
    icon: "🏆",
    metric: "movies",
    target: 1000,
    xp: 400,
  },
  {
    id: "episodes-1000",
    title: "Episode Millennium",
    description: "Log 1,000 TV episodes.",
    category: "TV",
    icon: "📺",
    metric: "episodes",
    target: 1000,
    xp: 300,
  },
  {
    id: "episodes-2500",
    title: "Box Set Connoisseur",
    description: "Log 2,500 TV episodes.",
    category: "TV",
    icon: "📦",
    metric: "episodes",
    target: 2500,
    xp: 500,
  },
  {
    id: "shows-100",
    title: "Channel Surfer Supreme",
    description: "Watch episodes from 100 different shows.",
    category: "TV",
    icon: "📡",
    metric: "tvShows",
    target: 100,
    xp: 200,
  },
  {
    id: "shows-250",
    title: "The Streaming Addict",
    description: "Watch episodes from 250 different shows.",
    category: "TV",
    icon: "🛜",
    metric: "tvShows",
    target: 250,
    xp: 350,
  },
  {
    id: "genres-15",
    title: "Genre Globetrotter",
    description: "Explore 15 different genres.",
    category: "Discovery",
    icon: "🧳",
    metric: "genres",
    target: 15,
    xp: 150,
  },
  {
    id: "film-eras-7",
    title: "Seven Decades Deep",
    description: "Watch movies or shows from 7 different decades.",
    category: "Discovery",
    icon: "🕰️",
    metric: "filmEras",
    target: 7,
    xp: 120,
  },
  {
    id: "film-eras-10",
    title: "Full Century of Cinema",
    description: "Watch movies or shows from 10 different decades.",
    category: "Discovery",
    icon: "🌍",
    metric: "filmEras",
    target: 10,
    xp: 300,
  },
  {
    id: "ratings-500",
    title: "Rating Machine",
    description: "Rate 500 movies, shows, seasons, or episodes.",
    category: "Ratings",
    icon: "⚙️",
    metric: "ratings",
    target: 500,
    xp: 250,
  },
  {
    id: "high-ratings-25",
    title: "Standing Ovation Encore",
    description: "Give 25 ratings of 9 or higher.",
    category: "Ratings",
    icon: "�",
    metric: "highRatings",
    target: 25,
    xp: 80,
  },
  {
    id: "low-ratings-25",
    title: "Harsh Critic",
    description: "Give 25 ratings of 3 or lower.",
    category: "Ratings",
    icon: "🧐",
    metric: "lowRatings",
    target: 25,
    xp: 80,
  },
  {
    id: "perfect-5",
    title: "Flawless Five",
    description: "Give 5 ratings of 9.5 or higher.",
    category: "Ratings",
    icon: "💎",
    metric: "perfectRatings",
    target: 5,
    xp: 60,
  },
  {
    id: "perfect-25",
    title: "Perfectionist's Cut",
    description: "Give 25 ratings of 9.5 or higher.",
    category: "Ratings",
    icon: "👑",
    metric: "perfectRatings",
    target: 25,
    xp: 150,
  },
  {
    id: "watchlist-10",
    title: "Future Night Stand",
    description: "Add 10 titles to your watchlist.",
    category: "Collection",
    icon: "🔖",
    metric: "watchlist",
    target: 10,
    xp: 30,
  },
  {
    id: "watchlist-50",
    title: "The Queue",
    description: "Add 50 titles to your watchlist.",
    category: "Collection",
    icon: "📋",
    metric: "watchlist",
    target: 50,
    xp: 90,
  },
  {
    id: "watchlist-100",
    title: "Insomniac's List",
    description: "Add 100 titles to your watchlist.",
    category: "Collection",
    icon: "🌙",
    metric: "watchlist",
    target: 100,
    xp: 160,
  },
];

const rankNames = [
  "Newcomer",
  "Screen Scout",
  "Movie Buff",
  "Episode Explorer",
  "Story Seeker",
  "Binge Buddy",
  "Reel Riser",
  "Series Scholar",
  "Spotlight Seeker",
  "Popcorn Pro",
  "Film Fanatic",
  "Screen Sage",
  "The Critic",
  "Cinephile",
  "Reel Royalty",
  "Story Legend",
  "Silver Screen Icon",
  "Hall of Fame",
  "Cinema Immortal",
  "Trakt Titan",
  "Silver Screen Virtuoso",
  "Story Weaver",
  "Star Chaser",
  "Cult Classic",
  "Reel Virtuoso",
  "Dream Director",
  "Genre Sage",
  "Midnight Icon",
  "Golden Reel",
  "Frame Master",
  "Screen Sovereign",
  "Story Architect",
  "Cinema Luminary",
  "Masterpiece Maker",
  "The Final Cut",
  "Grand Premiere",
  "Reel Sovereign",
  "Silver Orbit",
  "Story Supernova",
  "Cinema Deity",
  "Immortal Matinee",
  "Trakt Eternal",
];

export const MAX_LEVEL = rankNames.length;

export function getRankName(level: number) {
  return rankNames[Math.min(Math.max(level, 1), MAX_LEVEL) - 1] ?? "Newcomer";
}

const EARLY_LEVELS = 20;
const EARLY_LEVEL_XP = 100;
const LATE_LEVEL_XP = 300;
const EARLY_LEVEL_CAP_XP = EARLY_LEVEL_XP * EARLY_LEVELS;

function getLevelProgress(xp: number) {
  const cappedXp = Math.min(xp, Number.MAX_SAFE_INTEGER);
  const isPastEarlyLevels = cappedXp >= EARLY_LEVEL_CAP_XP;
  const level = isPastEarlyLevels
    ? Math.min(
        EARLY_LEVELS + 1 + Math.floor((cappedXp - EARLY_LEVEL_CAP_XP) / LATE_LEVEL_XP),
        MAX_LEVEL,
      )
    : Math.min(Math.floor(cappedXp / EARLY_LEVEL_XP) + 1, MAX_LEVEL);
  const isAtMaxLevel = level === MAX_LEVEL;
  const levelStartXp = isPastEarlyLevels
    ? EARLY_LEVEL_CAP_XP + (level - EARLY_LEVELS - 1) * LATE_LEVEL_XP
    : (level - 1) * EARLY_LEVEL_XP;
  const levelXpCost = isPastEarlyLevels ? LATE_LEVEL_XP : EARLY_LEVEL_XP;
  const progressInLevel = isAtMaxLevel
    ? levelXpCost
    : cappedXp - levelStartXp;

  return {
    level,
    isAtMaxLevel,
    progressInLevel,
    levelXpCost,
    xpForNextLevel: isAtMaxLevel ? 0 : levelXpCost - progressInLevel,
    progressPercent: isAtMaxLevel
      ? 100
      : Math.round((progressInLevel / levelXpCost) * 100),
  };
}

export function getAchievementSummary(
  stats: AchievementStats,
): AchievementSummary {
  const badges = achievementDefinitions.map((achievement) => {
    const value = stats[achievement.metric];

    return {
      ...achievement,
      progress: Math.min(value, achievement.target),
      earned: value >= achievement.target,
    };
  });
  const xp = badges.reduce(
    (total, badge) => total + (badge.earned ? badge.xp : 0),
    0,
  );
  const { level, progressInLevel, levelXpCost, xpForNextLevel, progressPercent } =
    getLevelProgress(xp);

  return {
    badges,
    earnedCount: badges.filter((badge) => badge.earned).length,
    totalBadges: badges.length,
    xp,
    level,
    rank: rankNames[level - 1] ?? "Newcomer",
    progressInLevel,
    xpForNextLevel,
    levelXpCost,
    progressPercent,
  };
}
