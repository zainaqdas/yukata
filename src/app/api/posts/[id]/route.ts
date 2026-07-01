import { prisma } from "@/lib/prisma";
import { getActiveHlsUrl } from "@/lib/hls";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const post = await prisma.post.findUnique({
    where: { id },
    include: { media: true },
  });

  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch active video URLs for video posts (HLS + direct MP4)
  let hlsUrl = null;
  let directUrl = null;
  let hlsExpiresAt = null;
  if (post.type === "VIDEO") {
    // Check for active HLS first
    const activeHls = await getActiveHlsUrl(id);
    if (activeHls) {
      hlsUrl = activeHls.hlsManifestUrl;
      directUrl = activeHls.url;
      hlsExpiresAt = activeHls.hlsExpiresAt;
    } else {
      // Fallback: find any non-expired video media (direct MP4)
      const directMedia = post.media.find(
        (m) => m.url && (!m.hlsExpiresAt || m.hlsExpiresAt > new Date())
      );
      if (directMedia) {
        directUrl = directMedia.url;
      }
    }
  }

  return NextResponse.json({ ...post, hlsUrl, directUrl, hlsExpiresAt });
}
