interface WatchlistButtonProps {
  isInWatchlist: boolean;
  loading?: boolean;
  itemTitle: string;
  onClick: () => void;
}

export default function WatchlistButton({
  isInWatchlist,
  loading = false,
  itemTitle,
  onClick,
}: WatchlistButtonProps) {
  const action = isInWatchlist ? "Remove from" : "Add to";
  const label = loading
    ? `${isInWatchlist ? "Removing from" : "Adding to"} watchlist`
    : `${action} watchlist`;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-label={`${label}: ${itemTitle}`}
      title={`${action} watchlist`}
      className={`absolute right-2 top-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-lg backdrop-blur-sm transition disabled:cursor-not-allowed disabled:opacity-90 ${
        isInWatchlist
          ? "cursor-pointer border-violet-400 bg-violet-500 text-white hover:border-red-400 hover:bg-red-500/80"
          : "cursor-pointer border-white/20 bg-black/75 text-white hover:border-violet-400 hover:bg-violet-500/80"
      }`}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill={isInWatchlist ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-4-6 4V4.75Z" />
        </svg>
      )}
    </button>
  );
}
