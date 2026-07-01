import { prisma } from "@/lib/prisma";

// ─── Types ────────────────────────────────────────────

const PATREON_BASE = "https://www.patreon.com";

interface PatreonIncluded {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
}

interface PatreonPostData {
  id: string;
  type: "post";
  attributes: {
    title: string;
    content?: string;
    published_at: string;
    post_type?: string;
    embed?: { url?: string; html?: string; description?: string };
    image?: { large_url?: string; url?: string };
    teaser_text?: string;
    url?: string;
    comment_count?: number;
    like_count?: number;
    current_user_can_view?: boolean;
    current_user_can_comment?: boolean;
    edited_at?: string;
    post_metadata?: Record<string, unknown>;
    change_visibility_at?: string | null;
  };
  relationships?: {
    campaign?: { data: { id: string; type: string } };
    media?: { data: Array<{ id: string; type: string }> };
    attachments?: { data: Array<{ id: string; type: string }> };
    user?: { data: { id: string; type: string } };
  };
}

interface PatreonResponse {
  data: PatreonPostData[];
  included?: PatreonIncluded[];
  links?: { next?: string };
  meta?: { pagination?: { cursors?: { next?: string }; total?: number } };
}

// ─── Cookie Auth ──────────────────────────────────────

async function getSessionCookie(): Promise<string | null> {
  const syncState = await prisma.syncState.findUnique({ where: { id: "main" } });
  return syncState?.patreonSessionId || null;
}

function buildCookieHeader(sessionId: string): string {
  // Include Cloudflare __cf_bm if available in env for bot-detection bypass
  const cfBm = process.env.PATREON_CF_BM_COOKIE;
  const cookies = [`session_id=${sessionId}`];
  if (cfBm) cookies.push(`__cf_bm=${cfBm}`);
  return cookies.join("; ");
}

async function patreonCookieFetch(path: string): Promise<PatreonResponse> {
  const sessionId = await getSessionCookie();
  if (!sessionId) {
    throw new Error(
      "No Patreon session_id configured. Add it in the admin dashboard."
    );
  }

  const url = path.startsWith("http") ? path : `${PATREON_BASE}${path}`;

  const response = await fetch(url, {
    headers: {
      Cookie: buildCookieHeader(sessionId),
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    },
  });

  if (response.status === 401 || response.status === 403) {
    await prisma.syncState.update({
      where: { id: "main" },
      data: { status: "session_expired", errorLog: `Patreon returned ${response.status}. Update your session_id.` },
    });
    throw new Error(`Patreon session expired (${response.status}). Update your session_id in admin.`);
  }

  // Cloudflare challenge page — not JSON
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(
      `Unexpected response type (${contentType}). Patreon may be showing a CAPTCHA. Try adding __cf_bm cookie via PATREON_CF_BM_COOKIE env var.`
    );
  }

  if (!response.ok) {
    throw new Error(`Patreon API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<PatreonResponse>;
}

// ─── Post Type Mapping ────────────────────────────────

function mapPostType(patreonType: string | undefined): string {
  switch (patreonType) {
    case "video":
    case "video_embed":
    case "video_external_file":
      return "VIDEO";
    case "image":
    case "image_file":
      return "IMAGE";
    case "audio":
    case "audio_file":
    case "audio_embed":
      return "AUDIO";
    case "link":
      return "LINK";
    case "file":
      return "FILE";
    default:
      return "TEXT";
  }
}

// ─── HLS URL Extraction ───────────────────────────────

/**
 * Extract a Mux playback ID from an embed HTML string.
 * Patreon native video uses Mux — the embed contains a playback ID
 * that can be used to construct the HLS manifest URL:
 *   https://stream.mux.com/{PLAYBACK_ID}.m3u8
 */
function extractMuxPlaybackId(html: string | null): string | null {
  if (!html) return null;

  // Pattern 1: data-playback-id attribute
  const dpMatch = html.match(/data-playback-id=["']([^"']+)["']/);
  if (dpMatch) return dpMatch[1];

  // Pattern 2: stream.mux.com/{id} in the embed
  const streamMatch = html.match(/stream\.mux\.com\/([a-zA-Z0-9]+)/);
  if (streamMatch) return streamMatch[1];

  // Pattern 3: mux.com URLs with path segments
  const muxMatch = html.match(/mux\.com\/embed\/([a-zA-Z0-9]+)/);
  if (muxMatch) return muxMatch[1];

  // Pattern 4: mux player src attribute — match 15-30 char alphanumeric IDs
  const srcMatch = html.match(/src=["']https?:\/\/[^"']*mux[^"']*["']/i);
  if (srcMatch) {
    const idMatch = srcMatch[0].match(/\/([a-zA-Z0-9]{15,30})\b/);
    if (idMatch) return idMatch[1];
  }

  return null;
}

/**
 * Build a Mux HLS manifest URL from a playback ID.
 * The standard Mux HLS URL format is: https://stream.mux.com/{PLAYBACK_ID}.m3u8
 */
function buildMuxHlsUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}

function extractHlsFromEmbed(embedHtml: string | null): string | null {
  if (!embedHtml) return null;

  // Direct .m3u8 link (rare but possible)
  const m3u8Match = embedHtml.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/i);
  if (m3u8Match) return m3u8Match[0];

  // Mux playback ID → construct HLS URL
  const playbackId = extractMuxPlaybackId(embedHtml);
  if (playbackId) return buildMuxHlsUrl(playbackId);

  return null;
}

function extractHlsFromIncluded(included: PatreonIncluded[]): string | null {
  for (const item of included) {
    const attrs = item.attributes as Record<string, unknown>;

    // Direct download URL — sometimes contains stream URLs for video media
    if (attrs.download_url && typeof attrs.download_url === "string") {
      const url = attrs.download_url;
      if (url.includes(".m3u8") || url.includes("mux.com")) {
        return url;
      }
    }

    // stream_url attribute (rare, but some media types expose it)
    if (attrs.stream_url && typeof attrs.stream_url === "string") {
      return attrs.stream_url;
    }

    // Check urls object for stream references
    const urls = attrs.urls as Record<string, string> | undefined;
    if (urls) {
      for (const key of Object.keys(urls)) {
        if (urls[key]?.includes(".m3u8") || urls[key]?.includes("mux.com")) {
          return urls[key];
        }
      }
    }
  }

  return null;
}

// ─── Fetch specific post for HLS details ──────────────

async function fetchPostDetails(postId: string): Promise<PatreonResponse> {
  return patreonCookieFetch(
    `/api/posts/${postId}?include=media,attachments,campaign,access_rules,user&fields[post]=title,content,published_at,post_type,embed,image,teaser_text,url,post_metadata&fields[media]=id,type,attributes,download_url,image_urls,urls`
  );
}

// ─── Fetch Campaign Posts ─────────────────────────────

async function fetchCampaignPosts(campaignId: string, cursor?: string): Promise<PatreonResponse> {
  const params = new URLSearchParams({
    "include": "media,attachments,access_rules,campaign,user,user_defined_tags",
    "sort": "-published_at",
    "filter[campaign_id]": campaignId,
    "filter[contains_exclusive_posts]": "true",
    "filter[is_draft]": "false",
    "page[count]": "20",
    "fields[post]":
      "title,content,published_at,post_type,embed,image,teaser_text,url,comment_count,like_count,edited_at,post_metadata",
    "fields[media]": "id,type,attributes,download_url,image_urls,urls",
  });

  if (cursor) {
    params.set("page[cursor]", cursor);
  }

  return patreonCookieFetch(`/api/posts?${params.toString()}`);
}

// ─── Find Campaign ID ─────────────────────────────────

async function findCampaignId(): Promise<string> {
  const envCampaignId = process.env.PATREON_CAMPAIGN_ID;
  if (envCampaignId) return envCampaignId;

  try {
    const data = await patreonCookieFetch(
      "/api/current_user/campaigns?include=null&fields[campaign]=id,creation_name"
    );
    if (data.data?.[0]) {
      return data.data[0].id;
    }
  } catch {
    // Fallback — the /api/current_user/campaigns endpoint may not be accessible to all accounts
  }

  throw new Error(
    "Could not determine campaign ID. Set PATREON_CAMPAIGN_ID in .env."
  );
}

// ─── Main Sync Function ───────────────────────────────

export async function syncPatreonPosts(): Promise<{
  syncedCount: number;
  total: number;
  nextCursor: string | null;
  hlsExtracted: number;
}> {
  const campaignId = await findCampaignId();

  const syncState = await prisma.syncState.findUnique({ where: { id: "main" } });
  const sessionId = await getSessionCookie();
  if (!sessionId) {
    throw new Error("No Patreon session_id configured. Go to Admin → add your session_id.");
  }

  await prisma.syncState.update({
    where: { id: "main" },
    data: { status: "running" },
  });

  let syncedCount = 0;
  let hlsExtracted = 0;
  let currentCursor: string | null = syncState?.cursor ?? null;
  let hasMore = true;
  let totalPosts = 0;

  try {
    while (hasMore) {
      const data = await fetchCampaignPosts(campaignId, currentCursor ?? undefined);
      const posts = data.data || [];
      const included = data.included || [];
      totalPosts += posts.length;

      for (const post of posts) {
        const attrs = post.attributes;

        // Skip future-scheduled posts
        if (attrs.change_visibility_at && new Date(attrs.change_visibility_at) > new Date()) {
          continue;
        }

        const postType = mapPostType(attrs.post_type);
        const thumbnailUrl = attrs.image?.large_url || attrs.image?.url || null;
        const embedHtml = attrs.embed?.html || null;

        // Try extracting HLS from batch response
        let hlsUrl: string | null = null;
        if (postType === "VIDEO") {
          hlsUrl =
            extractHlsFromIncluded(included) ||
            extractHlsFromEmbed(embedHtml);
        }

        // Upsert post record
        const existing = await prisma.post.findUnique({
          where: { patreonId: post.id },
        });

        let postRecord = existing;
        if (!existing) {
          postRecord = await prisma.post.create({
            data: {
              patreonId: post.id,
              title: attrs.title || "Untitled",
              content: attrs.content || attrs.teaser_text || "",
              contentHtml: embedHtml,
              type: postType as any,
              thumbnailUrl,
              embedHtml,
              publishedAt: new Date(attrs.published_at),
              isPublished: true,
            },
          });
          syncedCount++;
        }

        // For video posts, fetch individual post details to extract Mux HLS
        if (postType === "VIDEO" && !hlsUrl) {
          try {
            // Small delay to avoid rate-limiting on individual detail fetches
            await new Promise((r) => setTimeout(r, 200));
            const details = await fetchPostDetails(post.id);
            const detailEmbed = details.data?.[0]?.attributes?.embed?.html || null;
            hlsUrl =
              extractHlsFromIncluded(details.included || []) ||
              extractHlsFromEmbed(detailEmbed);
          } catch {
            // Individual post fetch failed — skip HLS
          }
        }

        // Store HLS URL if found
        if (hlsUrl && postType === "VIDEO" && postRecord) {
          const existingMedia = await prisma.media.findFirst({
            where: { postId: postRecord.id, type: "HLS_VIDEO" },
          });

          if (existingMedia) {
            await prisma.media.update({
              where: { id: existingMedia.id },
              data: {
                hlsManifestUrl: hlsUrl,
                hlsExpiresAt: new Date(Date.now() + 100 * 60 * 1000),
                hlsRefreshedAt: new Date(),
              },
            });
          } else {
            await prisma.media.create({
              data: {
                postId: postRecord.id,
                type: "HLS_VIDEO",
                hlsManifestUrl: hlsUrl,
                hlsExpiresAt: new Date(Date.now() + 100 * 60 * 1000),
                hlsRefreshedAt: new Date(),
                thumbnailUrl,
              },
            });
          }
          hlsExtracted++;
        }
      }

      // Pagination
      currentCursor = data.meta?.pagination?.cursors?.next || null;
      hasMore = !!currentCursor && posts.length > 0;

      await prisma.syncState.update({
        where: { id: "main" },
        data: { cursor: currentCursor || undefined },
      });

      // Cap pages per sync run to avoid timeouts (resumes from cursor next run)
      if (currentCursor && syncedCount > 100) {
        hasMore = false;
      }

      // Rate-limit: small delay between pages to avoid triggering Cloudflare
      if (hasMore) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    await prisma.syncState.update({
      where: { id: "main" },
      data: {
        lastSyncAt: new Date(),
        cursor: currentCursor || undefined,
        status: "success",
        errorLog: null,
      },
    });

    return { syncedCount, total: totalPosts, nextCursor: currentCursor, hlsExtracted };
  } catch (error: any) {
    await prisma.syncState.update({
      where: { id: "main" },
      data: {
        status: "error",
        errorLog: error.message,
      },
    });
    throw error;
  }
}

export async function getSyncStatus() {
  return prisma.syncState.findUnique({ where: { id: "main" } });
}

export async function savePatreonSessionId(sessionId: string): Promise<void> {
  await prisma.syncState.upsert({
    where: { id: "main" },
    update: {
      patreonSessionId: sessionId || null,
      sessionExpiresAt: sessionId
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        : null,
      status: "idle",
      errorLog: null,
    },
    create: {
      id: "main",
      patreonSessionId: sessionId || null,
      sessionExpiresAt: sessionId
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        : null,
      status: "idle",
    },
  });
}
