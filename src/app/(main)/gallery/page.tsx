import { prisma } from "@/lib/prisma";
import { getAllVideos } from "@/lib/hls";
import { MediaGallery } from "@/components/MediaGallery";

export const dynamic = "force-dynamic";

interface ImagePostForGallery {
  id: string;
  title: string;
  publishedAt: string;
  media: Array<{ thumbnailUrl: string | null; url: string | null }>;
}

interface VideoMediaForGallery {
  id: string;
  postId: string;
  thumbnailUrl: string | null;
  post: { title: string; thumbnailUrl: string | null; publishedAt: Date };
}

export default async function GalleryPage() {
  const [imagePosts, videos] = await Promise.all([
    prisma.post.findMany({
      where: { type: "IMAGE", isPublished: true },
      orderBy: { publishedAt: "desc" },
      take: 60,
      include: {
        media: {
          where: { type: "IMAGE" },
          select: { thumbnailUrl: true, url: true },
        },
      },
    }),
    getAllVideos(),
  ]);

  const imagePostsForGallery: ImagePostForGallery[] = imagePosts.map((p) => ({
    id: p.id,
    title: p.title,
    publishedAt: p.publishedAt.toISOString(),
    media: p.media.map((m) => ({
      thumbnailUrl: m.thumbnailUrl,
      url: m.url,
    })),
  }));

  const videosForGallery: VideoMediaForGallery[] = videos.map((v) => ({
    id: v.id,
    postId: v.postId,
    thumbnailUrl: v.thumbnailUrl,
    post: {
      title: v.post.title,
      thumbnailUrl: v.post.thumbnailUrl,
      publishedAt: v.post.publishedAt,
    },
  }));

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Media Gallery</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Browse all media across posts
        </p>
      </div>

      <MediaGallery imagePosts={imagePostsForGallery} videoMedia={videosForGallery} />
    </div>
  );
}
