"use client";

import { useState } from "react";
import Link from "next/link";

interface MediaGalleryProps {
  imagePosts: Array<{
    id: string;
    title: string;
    publishedAt: string;
    media: Array<{ thumbnailUrl: string | null; url: string | null }>;
  }>;
  videoMedia: Array<{
    id: string;
    postId: string;
    thumbnailUrl: string | null;
    post: { title: string; thumbnailUrl: string | null; publishedAt: Date };
  }>;
}

export function MediaGallery({ imagePosts, videoMedia }: MediaGalleryProps) {
  const [tab, setTab] = useState<"all" | "images" | "videos">("all");

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(["all", "images", "videos"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
              tab === t
                ? "bg-violet-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Grid */}
      {(tab === "all" || tab === "images") && imagePosts.length > 0 && (
        <>
          {tab === "all" && (
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
              Images
            </h2>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
            {imagePosts.flatMap((post) =>
              post.media
                .filter((m) => m.thumbnailUrl || m.url)
                .slice(0, 1)
                .map((media, i) => (
                  <Link
                    key={`${post.id}-${i}`}
                    href={`/posts/${post.id}`}
                    className="group relative aspect-square rounded-xl overflow-hidden bg-zinc-800 border border-zinc-700 hover:border-violet-500/50 transition-all"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={media.thumbnailUrl || media.url || ""}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-xs text-white truncate">{post.title}</p>
                    </div>
                  </Link>
                ))
            )}
          </div>
        </>
      )}

      {(tab === "all" || tab === "videos") && videoMedia.length > 0 && (
        <>
          {tab === "all" && (
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
              Videos
            </h2>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
            {videoMedia.map((media) => (
              <Link
                key={media.id}
                href={`/posts/${media.postId}`}
                className="group relative aspect-video rounded-xl overflow-hidden bg-zinc-800 border border-zinc-700 hover:border-violet-500/50 transition-all"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={media.thumbnailUrl || media.post.thumbnailUrl || ""}
                  alt={media.post.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-violet-600/80 flex items-center justify-center shadow-lg opacity-80 group-hover:opacity-100 transition-opacity">
                    <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
                <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-xs text-white truncate">{media.post.title}</p>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {imagePosts.length === 0 && videoMedia.length === 0 && (
        <div className="text-center py-20">
          <p className="text-zinc-500 text-lg">No media found.</p>
        </div>
      )}
    </div>
  );
}
