import { prisma } from "@/lib/prisma";

const PATREON_API = "https://www.patreon.com/api/oauth2/v2";

interface PatreonPost {
  id: string;
  type: string;
  attributes: {
    title: string;
    content?: string;
    published_at: string;
    post_type?: string;
    embed?: {
      url?: string;
      html?: string;
    };
    image?: {
      large_url?: string;
      url?: string;
    };
  };
  relationships?: {
    media?: {
      data: Array<{ id: string; type: string }>;
    };
  };
}

async function patreonFetch(endpoint: string) {
  const token = process.env.PATREON_CREATOR_ACCESS_TOKEN;
  if (!token) {
    throw new Error("PATREON_CREATOR_ACCESS_TOKEN not configured");
  }

  const response = await fetch(`${PATREON_API}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Patreon API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function mapPostType(patreonType: string | undefined) {
  switch (patreonType) {
    case "video":
    case "video_embed":
      return "VIDEO";
    case "image":
    case "image_file":
      return "IMAGE";
    case "audio":
    case "audio_file":
      return "AUDIO";
    case "link":
      return "LINK";
    case "file":
      return "FILE";
    default:
      return "TEXT";
  }
}

async function fetchCampaignPosts(campaignId: string, cursor?: string) {
  const fields = [
    "fields[post]=title,content, published_at,post_type,embed,image,url,is_paid",
    "include=media",
    "fields[media]=id,type,attributes",
    "sort=-published_at",
    "page[count]=20",
  ];

  if (cursor) {
    fields.push(`page[cursor]=${cursor}`);
  }

  const url = `/campaigns/${campaignId}/posts?${fields.join("&")}`;
  return patreonFetch(url);
}

export async function syncPatreonPosts() {
  const campaignId = process.env.PATREON_CAMPAIGN_ID;
  if (!campaignId) throw new Error("PATREON_CAMPAIGN_ID not set");

  const syncState = await prisma.syncState.findUnique({ where: { id: "main" } });

  const data = await fetchCampaignPosts(campaignId, syncState?.cursor ?? undefined);

  const posts: PatreonPost[] = data.data || [];
  let syncedCount = 0;

  for (const patreonPost of posts) {
    const existing = await prisma.post.findUnique({
      where: { patreonId: patreonPost.id },
    });

    if (!existing) {
      const postType = mapPostType(patreonPost.attributes.post_type);
      const thumbnailUrl =
        patreonPost.attributes.image?.large_url ||
        patreonPost.attributes.image?.url ||
        null;
      const embedHtml = patreonPost.attributes.embed?.html || null;

      await prisma.post.create({
        data: {
          patreonId: patreonPost.id,
          title: patreonPost.attributes.title || "Untitled",
          content: patreonPost.attributes.content || "",
          contentHtml: embedHtml,
          type: postType,
          thumbnailUrl,
          embedHtml,
          publishedAt: new Date(patreonPost.attributes.published_at),
          isPublished: true,
        },
      });

      syncedCount++;
    } else if (existing.title !== patreonPost.attributes.title) {
      // Update if title changed (Patreon may allow edits)
      await prisma.post.update({
        where: { id: existing.id },
        data: {
          title: patreonPost.attributes.title,
          content: patreonPost.attributes.content || existing.content,
          updatedAt: new Date(),
        },
      });
    }
  }

  // Update sync state
  const nextCursor = data.meta?.pagination?.cursors?.next || null;
  await prisma.syncState.upsert({
    where: { id: "main" },
    update: {
      lastSyncAt: new Date(),
      cursor: nextCursor || undefined,
      status: "success",
      errorLog: null,
    },
    create: {
      id: "main",
      lastSyncAt: new Date(),
      cursor: nextCursor || undefined,
      status: "success",
    },
  });

  return { syncedCount, total: posts.length, nextCursor };
}

export async function getSyncStatus() {
  return prisma.syncState.findUnique({ where: { id: "main" } });
}
