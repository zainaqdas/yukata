import { PostGrid } from "@/components/PostGrid";
import { prisma } from "@/lib/prisma";
import { PostType } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function PostsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; type?: string }>;
}) {
  const { page = "1", type } = await searchParams;
  const pageNum = parseInt(page);
  const limit = 20;
  const skip = (pageNum - 1) * limit;

  const where: Record<string, unknown> = { isPublished: true };
  if (type && type !== "all") {
    where.type = type.toUpperCase();
  }

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where: where as any,
      orderBy: { publishedAt: "desc" },
      skip,
      take: limit,
      include: {
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
    prisma.post.count({ where: where as any }),
  ]);

  const totalPages = Math.ceil(total / limit);

  const types = Object.values(PostType);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Posts</h1>
          <p className="text-zinc-500 text-sm mt-1">{total} posts total</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="/posts"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              !type || type === "all"
                ? "bg-violet-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            All
          </a>
          {types.map((t) => (
            <a
              key={t}
              href={`/posts?type=${t.toLowerCase()}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                type === t.toLowerCase()
                  ? "bg-violet-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {t}
            </a>
          ))}
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-zinc-500 text-lg">No posts found.</p>
          {type && (
            <a href="/posts" className="text-violet-400 text-sm mt-2 inline-block hover:underline">
              Clear filters
            </a>
          )}
        </div>
      ) : (
        <PostGrid posts={posts as any} />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-10">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <a
              key={p}
              href={`/posts?page=${p}${type ? `&type=${type}` : ""}`}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                p === pageNum
                  ? "bg-violet-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {p}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
