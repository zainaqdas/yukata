import { prisma } from "@/lib/prisma";

/**
 * HLS stream URLs from Patreon/Mux expire after a period of time.
 * This module manages storing, refreshing, and checking expiry of HLS URLs.
 */

export async function submitHlsUrl(postId: string, hlsManifestUrl: string, durationMinutes = 120) {
  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

  // Check if media already exists for this post
  const existing = await prisma.media.findFirst({
    where: { postId, type: "HLS_VIDEO" },
  });

  if (existing) {
    return prisma.media.update({
      where: { id: existing.id },
      data: {
        hlsManifestUrl,
        hlsExpiresAt: expiresAt,
        hlsRefreshedAt: new Date(),
      },
    });
  }

  return prisma.media.create({
    data: {
      postId,
      type: "HLS_VIDEO",
      hlsManifestUrl,
      hlsExpiresAt: expiresAt,
      hlsRefreshedAt: new Date(),
    },
  });
}

export async function getActiveHlsUrl(postId: string) {
  const media = await prisma.media.findFirst({
    where: {
      postId,
      type: "HLS_VIDEO",
      hlsManifestUrl: { not: null },
      hlsExpiresAt: { gt: new Date() },
    },
    orderBy: { hlsRefreshedAt: "desc" },
  });

  return media;
}

export async function getExpiredHlsMedia() {
  const raw = process.env.HLS_REFRESH_INTERVAL_MINUTES;
  const bufferMinutes = (raw && !isNaN(parseInt(raw))) ? parseInt(raw) : 30;
  const threshold = new Date(Date.now() + bufferMinutes * 60 * 1000);

  return prisma.media.findMany({
    where: {
      type: "HLS_VIDEO",
      hlsManifestUrl: { not: null },
      hlsExpiresAt: { lte: threshold },
    },
    include: { post: { select: { title: true, patreonId: true } } },
  });
}

export async function markHlsExpired(mediaId: string) {
  return prisma.media.update({
    where: { id: mediaId },
    data: { hlsExpiresAt: new Date(Date.now() - 1000) }, // Mark as expired
  });
}

export async function getAllVideos() {
  return prisma.media.findMany({
    where: { type: "HLS_VIDEO" },
    include: { post: { select: { title: true, thumbnailUrl: true, publishedAt: true } } },
    orderBy: { createdAt: "desc" },
  });
}
