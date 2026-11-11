export type CosmeticSlot =
  | "nameEffect"
  | "usernameEffect"
  | "nameColor"
  | "avatarRing"
  | "badgeShine";

export type Cosmetic = {
  id: string;
  slot: CosmeticSlot;
  name: string;
  description: string;
  unlockLevel: number;
  value: string;
};

export const COSMETICS_METADATA_KEY = "trakt_lite_cosmetics";
export const RANK_NAME_METADATA_KEY = "trakt_lite_rank_name_level";

export const SLOT_LABELS: Record<CosmeticSlot, string> = {
  nameEffect: "Level tag effect",
  usernameEffect: "Username effect",
  nameColor: "Name color",
  avatarRing: "Avatar ring",
  badgeShine: "Badge shine",
};

export const SLOT_DESCRIPTIONS: Record<CosmeticSlot, string> = {
  nameEffect: "Animated effect on your level tag in the navbar and profile.",
  usernameEffect:
    "Animated effect on your username in the navbar and profile.",
  nameColor: "Color for your username in the navbar and profile.",
  avatarRing: "Color or gradient ring around your avatar.",
  badgeShine: "Special finish on badges you have unlocked.",
};

export const cosmetics: Cosmetic[] = [
  {
    id: "shine-none",
    slot: "badgeShine",
    name: "None",
    description: "Standard badge cards.",
    unlockLevel: 1,
    value: "",
  },
  {
    id: "shine-shimmer",
    slot: "badgeShine",
    name: "Badge Sheen",
    description: "Unlocked badges get a subtle, static highlight.",
    unlockLevel: 2,
    value: "fx-badge-sheen",
  },
  {
    id: "shine-glow",
    slot: "badgeShine",
    name: "Earned Glow",
    description: "Unlocked badges emit a soft violet aura.",
    unlockLevel: 22,
    value: "fx-badge-glow",
  },
  {
    id: "shine-frame",
    slot: "badgeShine",
    name: "Gilded Frame",
    description: "Unlocked badges get a golden border.",
    unlockLevel: 37,
    value: "fx-badge-frame",
  },
  {
    id: "shine-legend",
    slot: "badgeShine",
    name: "Legendary Aura",
    description: "Unlocked badges shimmer with a legendary gradient.",
    unlockLevel: 42,
    value: "fx-badge-legend",
  },

  {
    id: "color-none",
    slot: "nameColor",
    name: "Default",
    description: "Standard white username.",
    unlockLevel: 1,
    value: "",
  },
  {
    id: "color-rose",
    slot: "nameColor",
    name: "Rose Quartz",
    description: "A soft rose tint for your username.",
    unlockLevel: 3,
    value: "#fda4af",
  },
  {
    id: "color-gold",
    slot: "nameColor",
    name: "Marquee Gold",
    description: "A warm gold fit for a headliner.",
    unlockLevel: 6,
    value: "#fbbf24",
  },
  {
    id: "color-cyan",
    slot: "nameColor",
    name: "Neon Cyan",
    description: "A cool cinema-marquee cyan.",
    unlockLevel: 9,
    value: "#22d3ee",
  },
  {
    id: "color-emerald",
    slot: "nameColor",
    name: "Emerald City",
    description: "A rich green for a discerning viewer.",
    unlockLevel: 12,
    value: "#34d399",
  },
  {
    id: "color-amber",
    slot: "nameColor",
    name: "Popcorn Amber",
    description: "The color of freshly popped popcorn.",
    unlockLevel: 15,
    value: "#f59e0b",
  },
  {
    id: "color-crimson",
    slot: "nameColor",
    name: "Crimson Reel",
    description: "A dramatic red straight out of the projection booth.",
    unlockLevel: 18,
    value: "#f87171",
  },
  {
    id: "color-ice",
    slot: "nameColor",
    name: "Glacier Ice",
    description: "A pale, frosty blue.",
    unlockLevel: 21,
    value: "#93c5fd",
  },
  {
    id: "color-copper",
    slot: "nameColor",
    name: "Copper Kettle",
    description: "A warm, vintage copper tone.",
    unlockLevel: 25,
    value: "#d97706",
  },
  {
    id: "color-lime",
    slot: "nameColor",
    name: "Lime Light",
    description: "A sharp, electric lime.",
    unlockLevel: 26,
    value: "#a3e635",
  },
  {
    id: "color-sky",
    slot: "nameColor",
    name: "Open Sky",
    description: "A soft daytime blue.",
    unlockLevel: 29,
    value: "#7dd3fc",
  },
  {
    id: "color-magenta",
    slot: "nameColor",
    name: "Magenta Fade",
    description: "A bold retro-magenta.",
    unlockLevel: 30,
    value: "#e879f9",
  },
  {
    id: "color-orchid",
    slot: "nameColor",
    name: "Night Orchid",
    description: "A deep, velvety purple.",
    unlockLevel: 32,
    value: "#c084fc",
  },
  {
    id: "color-silver",
    slot: "nameColor",
    name: "Silver Screen",
    description: "Polished silver for the silver screen.",
    unlockLevel: 34,
    value: "fx-color-silver",
  },
  {
    id: "color-teal",
    slot: "nameColor",
    name: "Teal Wave",
    description: "A calm, deep teal.",
    unlockLevel: 40,
    value: "#2dd4b6",
  },
  {
    id: "color-blush",
    slot: "nameColor",
    name: "Blush Hour",
    description: "A rosy pink for golden hour.",
    unlockLevel: 41,
    value: "#fb7185",
  },
  {
    id: "color-royal",
    slot: "nameColor",
    name: "Royal Purple",
    description: "A majestic violet worthy of the final cut.",
    unlockLevel: 42,
    value: "#a78bfa",
  },
  {
    id: "color-aurora",
    slot: "nameColor",
    name: "Aurora",
    description: "A shifting northern-lights gradient on your name.",
    unlockLevel: 24,
    value: "fx-color-aurora",
  },
  {
    id: "color-sunset",
    slot: "nameColor",
    name: "Sunset Boulevard",
    description: "A warm ember-to-orchid sunset gradient.",
    unlockLevel: 28,
    value: "fx-color-sunset",
  },
  {
    id: "color-ocean",
    slot: "nameColor",
    name: "Abyssal",
    description: "A deep ocean-blue gradient that slowly drifts.",
    unlockLevel: 33,
    value: "fx-color-ocean",
  },
  {
    id: "color-gilded",
    slot: "nameColor",
    name: "Gilded",
    description: "A molten gold shimmer for your username.",
    unlockLevel: 36,
    value: "fx-color-gold",
  },
  {
    id: "color-candy",
    slot: "nameColor",
    name: "Candy Floss",
    description: "A playful pink-violet-cyan gradient swirl.",
    unlockLevel: 39,
    value: "fx-color-candy",
  },
  {
    id: "color-void",
    slot: "nameColor",
    name: "Eventide",
    description: "A slow-breathing deep-space gradient.",
    unlockLevel: 42,
    value: "fx-color-void",
  },

  {
    id: "ring-default",
    slot: "avatarRing",
    name: "Default",
    description: "The standard violet gradient ring.",
    unlockLevel: 1,
    value: "",
  },
  {
    id: "ring-gold",
    slot: "avatarRing",
    name: "Gold Band",
    description: "A gilded ring for a star on the rise.",
    unlockLevel: 5,
    value: "#fbbf24",
  },
  {
    id: "ring-crimson",
    slot: "avatarRing",
    name: "Crimson Band",
    description: "A bold red ring.",
    unlockLevel: 8,
    value: "#ef4444",
  },
  {
    id: "ring-emerald",
    slot: "avatarRing",
    name: "Emerald Band",
    description: "A deep green ring.",
    unlockLevel: 11,
    value: "#10b981",
  },
  {
    id: "ring-cyan",
    slot: "avatarRing",
    name: "Cyan Band",
    description: "A bright projector-beam cyan.",
    unlockLevel: 14,
    value: "#06b6d4",
  },
  {
    id: "ring-rose",
    slot: "avatarRing",
    name: "Rose Band",
    description: "A soft pink ring.",
    unlockLevel: 17,
    value: "#f472b6",
  },
  {
    id: "ring-amber",
    slot: "avatarRing",
    name: "Amber Band",
    description: "A warm amber ring.",
    unlockLevel: 20,
    value: "#f59e0b",
  },
  {
    id: "ring-silver",
    slot: "avatarRing",
    name: "Silver Band",
    description: "A cool metallic silver ring.",
    unlockLevel: 23,
    value: "#cbd5e1",
  },
  {
    id: "ring-lime",
    slot: "avatarRing",
    name: "Lime Band",
    description: "A vivid lime ring.",
    unlockLevel: 27,
    value: "#84cc16",
  },
  {
    id: "ring-magenta",
    slot: "avatarRing",
    name: "Magenta Band",
    description: "A neon magenta ring.",
    unlockLevel: 31,
    value: "#d946ef",
  },
  {
    id: "ring-orchid",
    slot: "avatarRing",
    name: "Orchid Band",
    description: "A royal orchid ring.",
    unlockLevel: 32,
    value: "#a855f7",
  },
  {
    id: "ring-ocean",
    slot: "avatarRing",
    name: "Ocean Gradient",
    description: "A deep blue-to-teal gradient ring.",
    unlockLevel: 35,
    value: "linear-gradient(135deg, #1e3a8a, #06b6d4)",
  },
  {
    id: "ring-rainbow",
    slot: "avatarRing",
    name: "Rainbow Spin",
    description: "An animated rainbow ring that slowly rotates.",
    unlockLevel: 36,
    value: "conic-gradient(from var(--ring-angle, 0deg), #f472b6, #fbbf24, #34d399, #22d3ee, #818cf8, #f472b6)",
  },
  {
    id: "ring-ember",
    slot: "avatarRing",
    name: "Ember Band",
    description: "A burning orange ring.",
    unlockLevel: 39,
    value: "#f97316",
  },
  {
    id: "ring-pearl",
    slot: "avatarRing",
    name: "Pearl Band",
    description: "A soft, lustrous pearl ring.",
    unlockLevel: 40,
    value: "linear-gradient(135deg, #f5f5f4, #d6d3d1)",
  },
  {
    id: "ring-forge",
    slot: "avatarRing",
    name: "Forge Gradient",
    description: "A molten ember-to-gold gradient ring.",
    unlockLevel: 41,
    value: "linear-gradient(135deg, #dc2626, #f59e0b)",
  },
  {
    id: "ring-midnight",
    slot: "avatarRing",
    name: "Midnight Band",
    description: "A deep indigo ring for night owls.",
    unlockLevel: 42,
    value: "#6366f1",
  },
  {
    id: "ring-gilded",
    slot: "avatarRing",
    name: "Gilded Flow",
    description: "A river of liquid gold circles your avatar.",
    unlockLevel: 30,
    value: "fx-ring-gold",
  },
  {
    id: "ring-inferno",
    slot: "avatarRing",
    name: "Inferno Band",
    description: "Molten embers crawl around your avatar.",
    unlockLevel: 34,
    value: "fx-ring-fire",
  },
  {
    id: "ring-glacier",
    slot: "avatarRing",
    name: "Glacier Band",
    description: "A slow drift of ice-blue light.",
    unlockLevel: 37,
    value: "fx-ring-frost",
  },
  {
    id: "ring-plasma",
    slot: "avatarRing",
    name: "Plasma Ring",
    description: "A spinning ring of pure neon plasma.",
    unlockLevel: 40,
    value: "fx-ring-plasma",
  },

  {
    id: "fx-none",
    slot: "nameEffect",
    name: "None",
    description: "No animation on your level tag.",
    unlockLevel: 1,
    value: "",
  },
  {
    id: "fx-neon",
    slot: "nameEffect",
    name: "Neon Pulse",
    description: "A breathing neon glow around your level tag.",
    unlockLevel: 4,
    value: "fx-neon",
  },
  {
    id: "fx-ember",
    slot: "nameEffect",
    name: "Ember Flicker",
    description: "A warm flicker like coals in the projector.",
    unlockLevel: 7,
    value: "fx-ember",
  },
  {
    id: "fx-glitch",
    slot: "nameEffect",
    name: "Glitch Rift",
    description: "An occasional VHS-style glitch.",
    unlockLevel: 10,
    value: "fx-glitch",
  },
  {
    id: "fx-aurora",
    slot: "nameEffect",
    name: "Aurora Drift",
    description: "Colors slowly drift like the northern lights.",
    unlockLevel: 13,
    value: "fx-aurora",
  },
  {
    id: "fx-rainbow",
    slot: "nameEffect",
    name: "Prism Flow",
    description: "A continuous rainbow hue shift.",
    unlockLevel: 16,
    value: "fx-rainbow",
  },
  {
    id: "fx-chrome",
    slot: "nameEffect",
    name: "Chrome Sheen",
    description: "A metallic sheen sweeps across your level tag.",
    unlockLevel: 19,
    value: "fx-chrome",
  },
  {
    id: "fx-starlight",
    slot: "nameEffect",
    name: "Starlight",
    description:
      "The classic ✦ sparkle that once appeared automatically at level 20.",
    unlockLevel: 20,
    value: "fx-starlight",
  },
  {
    id: "fx-scan",
    slot: "nameEffect",
    name: "Afterlight Scan",
    description: "A subtle scanning flicker, straight off the reel.",
    unlockLevel: 24,
    value: "fx-scan",
  },
  {
    id: "fx-comet",
    slot: "nameEffect",
    name: "Comet Trail",
    description: "Swift sparks streak across your level tag.",
    unlockLevel: 28,
    value: "fx-comet",
  },
  {
    id: "fx-supernova",
    slot: "nameEffect",
    name: "Supernova",
    description: "A bright pulse with sparks bursting outward.",
    unlockLevel: 33,
    value: "fx-supernova",
  },
  {
    id: "fx-vortex",
    slot: "nameEffect",
    name: "Eventide",
    description: "Colors spiral through the spectrum at high speed.",
    unlockLevel: 36,
    value: "fx-vortex",
  },
  {
    id: "fx-eclipse",
    slot: "nameEffect",
    name: "Event Horizon",
    description: "Your level tag dims and flares like an eclipse.",
    unlockLevel: 38,
    value: "fx-eclipse",
  },
  {
    id: "fx-matrix",
    slot: "nameEffect",
    name: "Data Storm",
    description: "Hue flickers in hard digital steps like a bad signal.",
    unlockLevel: 40,
    value: "fx-matrix",
  },
  {
    id: "fx-rgb",
    slot: "nameEffect",
    name: "Prism Rift",
    description: "A smooth chromatic split ripples through the text.",
    unlockLevel: 41,
    value: "fx-rgb",
  },
  {
    id: "fx-void",
    slot: "nameEffect",
    name: "The Void",
    description: "Sparse, slow embers from deep space.",
    unlockLevel: 42,
    value: "fx-void",
  },

  {
    id: "uname-none",
    slot: "usernameEffect",
    name: "None",
    description: "No animation on your username.",
    unlockLevel: 1,
    value: "",
  },
  {
    id: "uname-neon",
    slot: "usernameEffect",
    name: "Neon Sign",
    description: "A breathing neon glow around your username.",
    unlockLevel: 5,
    value: "fx-neon",
  },
  {
    id: "uname-ember",
    slot: "usernameEffect",
    name: "Ember Glow",
    description: "A warm flicker like coals in the projector.",
    unlockLevel: 10,
    value: "fx-ember",
  },
  {
    id: "uname-glitch",
    slot: "usernameEffect",
    name: "Signal Glitch",
    description: "An occasional VHS-style glitch on your name.",
    unlockLevel: 15,
    value: "fx-glitch",
  },
  {
    id: "uname-aurora",
    slot: "usernameEffect",
    name: "Aurora Name",
    description: "Colors slowly drift like the northern lights.",
    unlockLevel: 20,
    value: "fx-aurora",
  },
  {
    id: "uname-starlight",
    slot: "usernameEffect",
    name: "Starlight Name",
    description: "Sparkles drift above your username.",
    unlockLevel: 25,
    value: "fx-starlight",
  },
  {
    id: "uname-rainbow",
    slot: "usernameEffect",
    name: "Prism Name",
    description: "A continuous rainbow hue shift on your name.",
    unlockLevel: 30,
    value: "fx-rainbow",
  },
  {
    id: "uname-comet",
    slot: "usernameEffect",
    name: "Comet Name",
    description: "Swift sparks streak across your username.",
    unlockLevel: 35,
    value: "fx-comet",
  },
  {
    id: "uname-celestial",
    slot: "usernameEffect",
    name: "Celestial Name",
    description: "A gentle field of twinkling stars on your name.",
    unlockLevel: 38,
    value: "fx-celestial",
  },
  {
    id: "uname-rgb",
    slot: "usernameEffect",
    name: "Chromatic Name",
    description: "A smooth chromatic split ripples through your name.",
    unlockLevel: 41,
    value: "fx-rgb",
  },
  {
    id: "uname-vortex",
    slot: "usernameEffect",
    name: "Void Vortex",
    description: "Colors spiral through the spectrum at high speed.",
    unlockLevel: 42,
    value: "fx-vortex",
  },
];

export type ActiveCosmetics = Partial<Record<CosmeticSlot, string>>;

const cosmeticsById = new Map(cosmetics.map((c) => [c.id, c]));
const cosmeticsBySlot = new Map<CosmeticSlot, Cosmetic[]>();
for (const cosmetic of cosmetics) {
  const list = cosmeticsBySlot.get(cosmetic.slot) ?? [];
  list.push(cosmetic);
  cosmeticsBySlot.set(cosmetic.slot, list);
}
for (const list of cosmeticsBySlot.values()) {
  list.sort((a, b) => a.unlockLevel - b.unlockLevel);
}

export function getCosmeticById(id: string | null | undefined) {
  return id ? cosmeticsById.get(id) : undefined;
}

export function getSlotCosmetics(slot: CosmeticSlot) {
  return cosmeticsBySlot.get(slot) ?? [];
}

export function isCosmeticUnlocked(cosmetic: Cosmetic, level: number) {
  return level >= cosmetic.unlockLevel;
}

export function parseActiveCosmetics(
  metadata: unknown,
): ActiveCosmetics {
  if (!metadata || typeof metadata !== "object") return {};
  const raw = (metadata as Record<string, unknown>)[COSMETICS_METADATA_KEY];
  if (!raw || typeof raw !== "object") return {};

  const result: ActiveCosmetics = {};
  for (const [slot, id] of Object.entries(raw as Record<string, unknown>)) {
    if (
      (slot === "nameEffect" ||
        slot === "usernameEffect" ||
        slot === "nameColor" ||
        slot === "avatarRing" ||
        slot === "badgeShine") &&
      typeof id === "string" &&
      getCosmeticById(id)?.slot === slot
    ) {
      result[slot] = id;
    }
  }
  return result;
}

export function parseActiveRankNameLevel(metadata: unknown, level: number) {
  if (!metadata || typeof metadata !== "object") return level;
  const rankLevel = (metadata as Record<string, unknown>)[
    RANK_NAME_METADATA_KEY
  ];
  return typeof rankLevel === "number" &&
    Number.isInteger(rankLevel) &&
    rankLevel >= 1 &&
    rankLevel <= level
    ? rankLevel
    : level;
}

export type ResolvedCosmetics = Record<CosmeticSlot, Cosmetic | null>;

export function resolveCosmetics(
  metadata: unknown,
  level: number,
): ResolvedCosmetics {
  const active = parseActiveCosmetics(metadata);
  const resolved = {} as ResolvedCosmetics;

  for (const slot of Object.keys(SLOT_LABELS) as CosmeticSlot[]) {
    const id = active[slot];
    const cosmetic = getCosmeticById(id);
    resolved[slot] =
      cosmetic && isCosmeticUnlocked(cosmetic, level) ? cosmetic : null;
  }

  return resolved;
}


