"use client";

import { useLayoutEffect, useRef, useState } from "react";

export type MediaFilterValue = "all" | "movie" | "tv";

const FILTER_OPTIONS: Array<{
  value: MediaFilterValue;
  label: string;
  icon: React.ReactNode;
}> = [
  {
    value: "all",
    label: "All",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    value: "tv",
    label: "TV",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
        <polyline points="17 2 12 7 7 2" />
      </svg>
    ),
  },
  {
    value: "movie",
    label: "Movies",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
        <line x1="7" y1="2" x2="7" y2="22" />
        <line x1="17" y1="2" x2="17" y2="22" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <line x1="2" y1="7" x2="7" y2="7" />
        <line x1="2" y1="17" x2="7" y2="17" />
        <line x1="17" y1="17" x2="22" y2="17" />
        <line x1="17" y1="7" x2="22" y2="7" />
      </svg>
    ),
  },
];

interface MediaFilterTabsProps {
  value: MediaFilterValue;
  onChange: (value: MediaFilterValue) => void;
  className?: string;
}

export default function MediaFilterTabs({
  value,
  onChange,
  className = "",
}: MediaFilterTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<
    Partial<Record<MediaFilterValue, HTMLButtonElement | null>>
  >({});
  const [indicator, setIndicator] = useState<{
    left: number;
    width: number;
  } | null>(null);

  useLayoutEffect(() => {
    const updateIndicator = () => {
      const button = buttonRefs.current[value];
      if (!button) return;
      setIndicator({ left: button.offsetLeft, width: button.offsetWidth });
    };

    updateIndicator();

    const container = containerRef.current;
    const resizeObserver =
      typeof ResizeObserver !== "undefined" && container
        ? new ResizeObserver(updateIndicator)
        : null;
    if (container && resizeObserver) {
      resizeObserver.observe(container);
    }
    window.addEventListener("resize", updateIndicator);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateIndicator);
    };
  }, [value]);

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/80 p-1 ${className}`}
    >
      {indicator && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1 bottom-1 rounded-full bg-violet-500/20 transition-[transform,width] duration-300 ease-out"
          style={{
            left: 0,
            width: indicator.width,
            transform: `translateX(${indicator.left}px)`,
          }}
        />
      )}
      {FILTER_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          ref={(el) => {
            buttonRefs.current[option.value] = el;
          }}
          onClick={() => onChange(option.value)}
          className={`relative flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-200 ${
            value === option.value
              ? "text-violet-200"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}
