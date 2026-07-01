import { getExpiredHlsMedia } from "@/lib/hls";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const expired = await getExpiredHlsMedia();

    // Return the list of media that needs refreshing
    // The admin can then re-submit fresh HLS URLs
    return NextResponse.json({
      success: true,
      expiredCount: expired.length,
      expired: expired.map((m) => ({
        id: m.id,
        postId: m.postId,
        postTitle: m.post.title,
        patreonPostId: m.post.patreonId,
        expiresAt: m.hlsExpiresAt,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
