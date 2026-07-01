import Link from "next/link";
import { SearchBar } from "@/components/SearchBar";
import { PostGrid } from "@/components/PostGrid";
import { prisma } from "@/lib/prisma";
import { Suspense } from "react";
import { PostType, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; page?: string }>;
}) {
  const { q, type, page = "1" } = await searchParams;
  const pageNum = parseInt(page);
  const limit = 20;
  const skip = (pageNum - 1) * limit;

  const where: Prisma.PostWhereInput = { isPublished: true };
  if (type && type !== "all") {
    where.type = type.toUpperCase() as PostType;
  }
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { content: { contains: q, mode: "insensitive" } },
    ];
  }

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip,
      take: limit,
      include: {
        creatorAccount: { select: { id: true, name: true } },
        media: {
          select: {
            id: true,
            type: true,
            thumbnailUrl: true,
            hlsExpiresAt: true,
            duration: true,
          },
        },
      },
    }),
    prisma.post.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-4">Search</h1>
        <Suspense>
          <SearchBar />
        </Suspense>
      </div>

      {q && (
        <p className="text-zinc-400 mb-6">
          {total} results for &ldquo;{q}&rdquo;
          {type && type !== "all" && ` in ${type}`}
        </p>
      )}

      {q && posts.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-zinc-500 text-lg">No results found.</p>
          <p className="text-zinc-600 text-sm mt-1">Try a different search term.</p>
        </div>
      ) : q ? (
        <PostGrid posts={posts} />
      ) : (
        <div className="text-center py-20">
          <p className="text-zinc-500 text-lg">Enter a search term to find posts.</p>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-10">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/search?q=${q || ""}${type ? `&type=${type}` : ""}&page=${p}`}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                p === pageNum
                  ? "bg-violet-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
