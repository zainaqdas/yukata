import { prisma } from "@/lib/prisma";
import { getActiveHlsUrl } from "@/lib/hls";
import { VideoPlayer } from "@/components/VideoPlayer";
import { format } from "date-fns";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import HlsSubmitForm from "./HlsSubmitForm";

export const dynamic = "force-dynamic";

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;

  const post = await prisma.post.findUnique({
    where: { id },
    include: { media: true },
  });

  if (!post || !post.isPublished) notFound();

  // Get active HLS URL for video posts
  let hlsUrl: string | null = null;
  let hlsExpiresAt: Date | null = null;
  if (post.type === "VIDEO") {
    const activeHls = await getActiveHlsUrl(id);
    if (activeHls) {
      hlsUrl = activeHls.hlsManifestUrl;
      hlsExpiresAt = activeHls.hlsExpiresAt;
    }
  }

  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        href="/posts"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 mb-6 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to posts
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
            {post.type}
          </span>
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-violet-950/50 text-violet-300 border border-violet-900/30"
            >
              {tag}
            </span>
          ))}
        </div>
        <h1 className="text-3xl font-bold text-white leading-tight">{post.title}</h1>
        <p className="text-zinc-500 mt-2">
          Published {format(post.publishedAt, "MMMM d, yyyy 'at' h:mm a")}
        </p>
      </div>

      {/* Video player */}
      {post.type === "VIDEO" && (
        <div className="mb-8">
          <VideoPlayer
            hlsUrl={hlsUrl || ""}
            poster={post.thumbnailUrl || undefined}
            className="aspect-video"
          />
          {!hlsUrl && isAdmin && (
            <div className="mt-3 p-4 bg-amber-950/20 border border-amber-900/30 rounded-xl">
              <p className="text-sm text-amber-400 mb-2">
                HLS stream URL not set or expired. Submit a fresh HLS URL:
              </p>
              <HlsSubmitForm postId={post.id} />
            </div>
          )}
          {hlsExpiresAt && (
            <p className="text-xs text-zinc-600 mt-2">
              Stream expires: {format(hlsExpiresAt, "MMM d, h:mm a")}
            </p>
          )}
        </div>
      )}

      {/* Content */}
      {(post.content || post.contentHtml) && (
        <div className="prose prose-invert prose-zinc max-w-none mb-8">
          {post.contentHtml ? (
            <div dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
          ) : (
            <div className="whitespace-pre-wrap text-zinc-300 leading-relaxed">{post.content}</div>
          )}
        </div>
      )}

      {/* Media attachments */}
      {post.media.filter((m) => m.type === "IMAGE").length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">Images</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {post.media
              .filter((m) => m.type === "IMAGE")
              .map((media) => (
                <a
                  key={media.id}
                  href={media.url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl overflow-hidden bg-zinc-800 border border-zinc-700 hover:border-zinc-600 transition-all"
                >
                  <img
                    src={media.thumbnailUrl || media.url || ""}
                    alt=""
                    className="w-full aspect-square object-cover"
                  />
                </a>
              ))}
          </div>
        </div>
      )}

      {/* Attachments */}
      {post.media.filter((m) => m.type === "ATTACHMENT").length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">Attachments</h2>
          <div className="space-y-2">
            {post.media
              .filter((m) => m.type === "ATTACHMENT")
              .map((media) => (
                <a
                  key={media.id}
                  href={media.url || "#"}
                  className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 transition-all group"
                >
                  <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">
                    {media.filename || "Download file"}
                  </span>
                </a>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
