"use client";

import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { PostGrid } from "./PostGrid";
import type { PostType } from "@prisma/client";

interface SearchResultsProps {
  query: string;
  type: string;
}

interface PostResponse {
  id: string;
  title: string;
  type: PostType;
  thumbnailUrl: string | null;
  publishedAt: string;
  creatorAccount?: { id: string; name: string } | null;
  media: Array<{
    id: string;
    type: string;
    thumbnailUrl: string | null;
    hlsExpiresAt: string | null;
    duration: number | null;
  }>;
}

interface ApiResponse {
  posts: PostResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function SearchResults({ query, type }: SearchResultsProps) {
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (type && type !== "all") params.set("type", type);
  params.set("page", String(page));

  const { data, isLoading, isFetching, error } = useQuery<ApiResponse>({
    queryKey: ["search", query, type, page],
    queryFn: async () => {
      const res = await fetch(`/api/posts?${params.toString()}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  // Loading state
  if (isLoading) {
    return (
      <div>
        <p className="text-zinc-500 mb-6">Searching...</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden animate-pulse">
              <div className="aspect-video bg-zinc-800" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-zinc-800 rounded w-3/4" />
                <div className="h-3 bg-zinc-800 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 text-lg">Search failed. Please try again.</p>
        <p className="text-zinc-600 text-sm mt-1">{(error as Error).message}</p>
      </div>
    );
  }

  const { posts, pagination } = data!;

  // Active search — no results
  if (posts.length === 0) {
    return (
      <div>
        <p className="text-zinc-400 mb-6">
          {pagination.total} results for &ldquo;{query}&rdquo;
          {type && type !== "all" && ` in ${type}`}
        </p>
        <div className="text-center py-20">
          <p className="text-zinc-500 text-lg">No results found.</p>
          <p className="text-zinc-600 text-sm mt-1">Try a different search term.</p>
        </div>
      </div>
    );
  }

  // Active search — has results
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-zinc-400">
          {pagination.total} result{pagination.total !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
          {type && type !== "all" && ` in ${type}`}
          {isFetching && <span className="text-zinc-600 ml-2 text-sm">(updating...)</span>}
        </p>
      </div>

      <div className={isFetching ? "opacity-60 transition-opacity" : ""}>
        <PostGrid posts={posts.map((p) => ({
          ...p,
          publishedAt: new Date(p.publishedAt),
          media: p.media.map((m) => ({
            ...m,
            hlsExpiresAt: m.hlsExpiresAt ? new Date(m.hlsExpiresAt) : null,
            duration: m.duration ?? null,
          })),
        }))} />
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-10">
          <button
            onClick={() => setPage(page - 1)}
            disabled={page <= 1}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Prev
          </button>
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                p === page
                  ? "bg-violet-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage(page + 1)}
            disabled={page >= pagination.totalPages}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
