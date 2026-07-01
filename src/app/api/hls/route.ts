import { submitHlsUrl } from "@/lib/hls";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const { postId, hlsManifestUrl, durationMinutes } = body;

  if (!postId || !hlsManifestUrl) {
    return NextResponse.json(
      { error: "postId and hlsManifestUrl are required" },
      { status: 400 }
    );
  }

  // Verify post exists and is video type
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const media = await submitHlsUrl(postId, hlsManifestUrl, durationMinutes || 120);

  return NextResponse.json(media, { status: 201 });
}
