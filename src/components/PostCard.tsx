"use client";

import Link from "next/link";
import { PostType } from "@prisma/client";
import { format } from "date-fns";

interface PostCardProps {
  id: string;
  title: string;
  type: PostType;
  thumbnailUrl: string | null;
  publishedAt: string;
  media: Array<{ id: string; type: string; thumbnailUrl: string | null; duration: number | null }>;
}

const typeIcons: Record<string, string> = {
  VIDEO: "🎬",
  IMAGE: "🖼️",
  AUDIO: "🎵",
  TEXT: "📝",
  LINK: "🔗",
  FILE: "📁",
};

export function PostCard({ id, title, type, thumbnailUrl, publishedAt, media }: PostCardProps) {
  const firstMedia = media?.[0];
  const displayThumb = thumbnailUrl || firstMedia?.thumbnailUrl;

  return (
    <Link
      href={`/posts/${id}`}
      className="group block rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all hover:shadow-xl hover:shadow-black/30 overflow-hidden"
    >
      <div className="aspect-video bg-zinc-800 relative overflow-hidden">
        {displayThumb ? (
          <img
            src={displayThumb}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl">{typeIcons[type] || "📄"}</span>
          </div>
        )}
        <div className="absolute top-3 left-3">
          <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-black/60 text-zinc-300 backdrop-blur-sm border border-white/10">
            {typeIcons[type]} {type}
          </span>
        </div>
        {type === "VIDEO" && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-14 h-14 rounded-full bg-violet-600/90 flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-medium text-zinc-100 group-hover:text-violet-300 transition-colors line-clamp-2">
          {title}
        </h3>
        <p className="text-sm text-zinc-500 mt-1.5">
          {format(new Date(publishedAt), "MMM d, yyyy")}
        </p>
      </div>
    </Link>
  );
}
