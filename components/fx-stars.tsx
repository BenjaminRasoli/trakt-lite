"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

type StarFx = {
  anim: string;
  count: number;
  glyph?: string;
  colors?: string[];
  sizeMin?: number;
  sizeMax?: number;
  leftMin?: number;
  leftMax?: number;
};

export const STAR_FX: Record<string, StarFx> = {
  "fx-starlight": {
    anim: "level-starlight",
    count: 2,
    colors: ["#d8b4fe", "#e9d5ff", "#c4b5fd", "#ede9fe", "#f5f3ff"],
    sizeMin: 0.6,
    sizeMax: 0.78,
  },
  "fx-comet": {
    anim: "fx-comet",
    count: 2,
    colors: ["#a5f3fc", "#e0f2fe", "#67e8f9", "#cffafe"],
    sizeMin: 0.55,
    sizeMax: 0.7,
  },
  "fx-celestial": {
    anim: "fx-drift",
    count: 2,
    glyph: "✧",
    colors: ["#ddd6fe", "#f0abfc", "#e9d5ff", "#f5d0fe"],
    sizeMin: 0.5,
    sizeMax: 0.62,
  },
  "fx-supernova": {
    anim: "fx-burst",
    count: 2,
    colors: ["#fde68a", "#fbcfe8", "#fef3c7", "#fed7aa", "#fff7ed"],
    sizeMin: 0.72,
    sizeMax: 0.9,
  },
  "fx-eclipse": {
    anim: "fx-ember-fall",
    count: 2,
    colors: ["#c4b5fd", "#f5d0fe", "#ddd6fe", "#e9d5ff"],
    sizeMin: 0.6,
    sizeMax: 0.75,
  },
};

const FALLBACK_COLORS = [
  "#e0e7ff",
  "#c7d2fe",
  "#a5b4fc",
  "#67e8f9",
  "#f0abfc",
  "#e9d5ff",
  "#ddd6fe",
  "#fbcfe8",
  "#fde68a",
];

const rnd = (min: number, max: number) =>
  Math.round((min + Math.random() * (max - min)) * 10) / 10;

type Star = {
  id: number;
  left: number;
  top: number;
  size: number;
  color: string;
};

function makeStars(
  count: number,
  colors: string[],
  sizeMin: number,
  sizeMax: number,
  leftMin: number,
  leftMax: number,
): Star[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: leftMin + Math.random() * (leftMax - leftMin),
    top: -0.45 - Math.random() * 0.65,
    size: rnd(sizeMin, sizeMax),
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
}

function buildFrames(kind: string): Keyframe[] {
  const dx1 = rnd(-4, 4);
  const dy1 = rnd(-4, 2);
  const dx2 = rnd(-5, 5);
  const dy2 = rnd(-6, 6);
  switch (kind) {
    case "level-starlight":
      return [
        {
          opacity: 0,
          transform: "translate3d(0,0,0) scale(0.25) rotate(0deg)",
        },
        {
          opacity: 1,
          transform: `translate3d(${dx1}px,${dy1}px,0) scale(1) rotate(45deg)`,
          offset: 0.18,
        },
        {
          opacity: 0.8,
          transform: `translate3d(${dx2}px,${dy2}px,0) scale(0.65) rotate(90deg)`,
          offset: 0.65,
        },
        {
          opacity: 0,
          transform: `translate3d(${dx2 * 0.6}px,${dy2 - 4}px,0) scale(0.3) rotate(135deg)`,
        },
      ];
    case "fx-comet":
      return [
        {
          opacity: 0,
          transform: `translate3d(${dx1}px,${dy1 + 4}px,0) scale(0.4) rotate(0deg)`,
        },
        { opacity: 1, offset: 0.25 },
        {
          opacity: 0,
          transform: `translate3d(${dx2}px,${dy2}px,0) scale(1) rotate(45deg)`,
        },
      ];
    case "fx-drift": {
      const ax = rnd(-3, 3);
      const ay = rnd(-1.5, 1.5);
      const bx = rnd(-4, 4);
      const by = rnd(-2, 2);
      return [
        {
          opacity: 0.2,
          transform: `translate3d(${ax}px,${ay}px,0) scale(0.7)`,
        },
        {
          opacity: 0.95,
          transform: `translate3d(${bx}px,${by}px,0) scale(1.05)`,
          offset: 0.5,
        },
        {
          opacity: 0.2,
          transform: `translate3d(${ax}px,${ay}px,0) scale(0.7)`,
        },
      ];
    }
    case "fx-ember-fall":
      return [
        {
          opacity: 0,
          transform: `translate3d(${rnd(-3, 3)}px,-4px,0) scale(0.5)`,
        },
        { opacity: 0.9, offset: 0.2 },
        {
          opacity: 0,
          transform: `translate3d(${rnd(-3, 3)}px,${rnd(6, 12)}px,0) scale(0.3)`,
        },
      ];
    default:
      return [
        { opacity: 0, transform: "translate3d(0,2px,0) scale(0.3)" },
        {
          opacity: 1,
          transform: `translate3d(${dx1}px,${dy1}px,0) scale(1.15)`,
          offset: 0.2,
        },
        {
          opacity: 0,
          transform: `translate3d(${dx2}px,${dy2}px,0) scale(0.5)`,
        },
      ];
  }
}

const EASING: Record<string, string> = {
  "level-starlight": "ease-out",
  "fx-comet": "linear",
  "fx-drift": "ease-in-out",
  "fx-ember-fall": "ease-in",
  "fx-burst": "ease-out",
};

export default function FxStars({
  count = 6,
  anim = "fx-burst",
  glyph = "✦",
  colors = FALLBACK_COLORS,
  sizeMin = 0.5,
  sizeMax = 0.85,
  leftMin = 8,
  leftMax = 92,
}: Partial<StarFx>) {
  const [stars, setStars] = useState<Star[]>([]);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    setStars(makeStars(count, colors, sizeMin, sizeMax, leftMin, leftMax));
  }, [count, colors, sizeMin, sizeMax, leftMin, leftMax]);

  useEffect(() => {
    if (stars.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    const els = wrapRef.current?.querySelectorAll("i");
    if (!els?.length) return;
    const cleanups: (() => void)[] = [];
    els.forEach((el) => {
      let cancelled = false;
      let timer: ReturnType<typeof setTimeout>;
      let current: Animation | undefined;
      const start = () => {
        if (cancelled) return;
        const duration = rnd(2.8, 5.2) * 1000;
        const a = el.animate(buildFrames(anim), {
          duration,
          easing: EASING[anim] ?? "ease-out",
          fill: "both",
        });
        current = a;
        a.onfinish = () => {
          if (!cancelled) start();
        };
      };
      timer = setTimeout(start, Math.random() * 2500);
      cleanups.push(() => {
        cancelled = true;
        clearTimeout(timer);
        current?.cancel();
      });
    });
    return () => cleanups.forEach((c) => c());
  }, [stars, anim]);

  return (
    <span ref={wrapRef} className="contents">
      {stars.map((s) => (
        <i
          key={s.id}
          className="fx-star-field"
          style={
            {
              left: `${s.left}%`,
              top: `${s.top}em`,
              fontSize: `${s.size}em`,
              color: s.color,
              opacity: 0,
            } as CSSProperties
          }
        >
          {glyph}
        </i>
      ))}
    </span>
  );
}
