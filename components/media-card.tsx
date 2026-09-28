import {
  getPosterUrl,
  getMediaTitle,
  getMediaDate,
  getMediaType,
} from "@/lib/tmdb";
import type { TMDBMedia } from "@/lib/tmdb";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface MediaCardProps {
  media: TMDBMedia;
}

const GENRE_MAP: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Sci-Fi",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
};

export default function MediaCard({ media }: MediaCardProps) {
  const router = useRouter();
  const title = getMediaTitle(media);
  const date = getMediaDate(media);
  const mediaType = getMediaType(media);
  const posterUrl = getPosterUrl(media.poster_path);
  const rating =
    typeof media.vote_average === "number"
      ? media.vote_average.toFixed(1)
      : "N/A";
  const genres = (media.genre_ids ?? [])
    .slice(0, 3)
    .map((id) => GENRE_MAP[id])
    .filter(Boolean);

  const typeToUse = media.media_type || mediaType;

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/media/${media.id}?type=${typeToUse}`);
  };

  return (
    <Link
      href={`/media/${media.id}?type=${typeToUse}`}
      className="block bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 rounded-lg border border-zinc-700/50 backdrop-blur-sm overflow-hidden hover:border-violet-500/50 transition-all hover:shadow-lg hover:shadow-violet-500/10"
    >
      <div className="relative aspect-[2/3]">
        <img
          src={posterUrl}
          alt={title}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = "/placeholder-poster.svg";
          }}
        />
        <div className="absolute top-1 left-1 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-[10px] font-semibold text-violet-400 uppercase">
          {mediaType}
        </div>
      </div>

      <div className="p-3">
        <h3 className="text-sm font-bold text-white mb-1.5 line-clamp-1">
          <span
            onClick={handleTitleClick}
            className="hover:underline hover:text-violet-200 transition-colors cursor-pointer"
          >
            {title}
          </span>
        </h3>

        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="flex items-center gap-0.5">
            <span className="text-yellow-400 text-xs">★</span>
            <span className="text-zinc-300 text-xs">{rating}</span>
          </div>
          <span className="text-zinc-500 text-xs">•</span>
          <span className="text-zinc-400 text-xs">{date}</span>
        </div>

        <div className="flex flex-wrap gap-0.5">
          {genres.slice(0, 2).map((genre, index) => (
            <span
              key={`${genre}-${index}`}
              className="px-1.5 py-0.5 bg-zinc-700/50 text-zinc-300 text-[10px] rounded"
            >
              {genre}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
