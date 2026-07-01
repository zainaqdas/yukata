import { prisma } from "@/lib/prisma";
import { getAllVideos } from "@/lib/hls";
import { MediaGallery } from "@/components/MediaGallery";

export const dynamic = "force-dynamic";

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

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Media Gallery</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Browse all media across posts
        </p>
      </div>

      <MediaGallery imagePosts={imagePosts as any} videoMedia={videos as any} />
    </div>
  );
}
