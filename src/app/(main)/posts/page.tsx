import Link from "next/link";
import { PostGrid } from "@/components/PostGrid";
import { CreatorFilter } from "@/components/CreatorFilter";
import { prisma } from "@/lib/prisma";
import { PostType, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function PostsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; type?: string; creator?: string }>;
}) {
  const { page = "1", type, creator } = await searchParams;
  const pageNum = parseInt(page);
  const limit = 20;
  const skip = (pageNum - 1) * limit;

  const where: Prisma.PostWhereInput = { isPublished: true };
  if (type && type !== "all") {
    where.type = type.toUpperCase() as PostType;
  }
  if (creator) {
    where.creatorAccountId = creator;
  }

  const [posts, total, accounts] = await Promise.all([
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
    prisma.creatorAccount.findMany({
      where: { posts: { some: {} } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalPages = Math.ceil(total / limit);
  const types = Object.values(PostType);

  const filterParams = (overrides: Record<string, string>) => {
    const params = new URLSearchParams();
    if (type && type !== "all") params.set("type", type);
    if (creator) params.set("creator", creator);
    Object.entries(overrides).forEach(([k, v]) => {
      if (v) params.set(k, v);
      else params.delete(k);
    });
    return params.toString();
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Posts</h1>
          <p className="text-zinc-500 text-sm mt-1">{total} posts total</p>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <CreatorFilter accounts={accounts} selected={creator} />

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/posts?${filterParams({ type: "", page: "" })}`}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              !type || type === "all"
                ? "bg-violet-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            All
          </Link>
          {types.map((t) => (
            <Link
              key={t}
              href={`/posts?${filterParams({ type: t.toLowerCase(), page: "" })}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                type === t.toLowerCase()
                  ? "bg-violet-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t}
            </Link>
          ))}
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-zinc-500 text-lg">No posts found.</p>
          {(type || creator) && (
            <Link href="/posts" className="text-violet-400 text-sm mt-2 inline-block hover:underline">
              Clear filters
            </Link>
          )}
        </div>
      ) : (
        <PostGrid posts={posts} />
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-10">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/posts?${filterParams({ page: p === 1 ? "" : String(p) })}`}
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
