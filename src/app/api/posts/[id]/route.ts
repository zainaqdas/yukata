import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveHlsUrl } from "@/lib/hls";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const post = await prisma.post.findUnique({
    where: { id },
    include: { media: true },
  });

  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fetch active HLS URL for video posts
  let hlsUrl = null;
  let hlsExpiresAt = null;
  if (post.type === "VIDEO") {
    const activeHls = await getActiveHlsUrl(id);
    if (activeHls) {
      hlsUrl = activeHls.hlsManifestUrl;
      hlsExpiresAt = activeHls.hlsExpiresAt;
    }
  }

  return NextResponse.json({ ...post, hlsUrl, hlsExpiresAt });
}
