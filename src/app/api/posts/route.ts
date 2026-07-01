import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { PostType, Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const type = searchParams.get("type");
  const search = searchParams.get("q");
  const creatorAccountId = searchParams.get("creatorAccountId");
  const skip = (page - 1) * limit;

  const where: Prisma.PostWhereInput = { isPublished: true };
  if (type && type !== "all") {
    where.type = type.toUpperCase() as PostType;
  }
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { content: { contains: search, mode: "insensitive" } },
    ];
  }
  if (creatorAccountId) {
    where.creatorAccountId = creatorAccountId;
  }

  const [posts, total] = await Promise.all([
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
