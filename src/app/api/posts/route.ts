import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const type = searchParams.get("type");
  const search = searchParams.get("q");
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { isPublished: true };
  if (type && type !== "all") {
    where.type = type.toUpperCase();
  }
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { content: { contains: search, mode: "insensitive" } },
    ];
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

  return NextResponse.json({
    posts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
