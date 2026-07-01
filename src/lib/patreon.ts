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

// ─── Account CRUD ─────────────────────────────────────

export async function listCreatorAccounts() {
  return prisma.creatorAccount.findMany({ orderBy: { createdAt: "asc" } });
}

export async function getAccount(accountId: string) {
  return prisma.creatorAccount.findUnique({ where: { id: accountId } });
}

export async function createAccount(name: string, campaignId?: string) {
  return prisma.creatorAccount.create({
    data: {
      name,
      patreonCampaignId: campaignId || null,
      status: "idle",
    },
  });
}

export async function deleteAccount(accountId: string) {
  return prisma.creatorAccount.delete({ where: { id: accountId } });
}

// ─── Cookie Auth ──────────────────────────────────────

async function getSessionCookie(accountId: string): Promise<string | null> {
  const account = await prisma.creatorAccount.findUnique({ where: { id: accountId } });
  return account?.patreonSessionId || null;
}

function buildCookieHeader(sessionId: string): string {
  const cfBm = process.env.PATREON_CF_BM_COOKIE;
  const cookies = [`session_id=${sessionId}`];
  if (cfBm) cookies.push(`__cf_bm=${cfBm}`);
  return cookies.join("; ");
}

async function patreonCookieFetch(accountId: string, path: string): Promise<PatreonResponse> {
  const sessionId = await getSessionCookie(accountId);
  if (!sessionId) {
    throw new Error(
      `No Patreon session_id configured for account. Add it in the admin dashboard.`
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
    await prisma.creatorAccount.update({
      where: { id: accountId },
      data: { status: "session_expired", errorLog: `Patreon returned ${response.status}. Update your session_id.` },
    });
    throw new Error(`Patreon session expired (${response.status}). Update your session_id in admin.`);
  }

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
 * Decode a JWT payload (no verification) to extract the `exp` claim.
 * Returns the expiry date, or null if not found / invalid.
 */
function parseJwtExpiry(token: string): Date | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
    if (payload.exp && typeof payload.exp === "number") {
      // exp is in seconds; give a 5-min buffer so we refresh before actual expiry
      return new Date((payload.exp - 300) * 1000);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * If the HLS URL has a JWT `?token=` param, parse it to get the real
 * expiry time. Otherwise fall back to a default duration.
 */
function getHlsExpiry(hlsUrl: string): Date {
  try {
    const url = new URL(hlsUrl);
    const token = url.searchParams.get("token");
    if (token) {
      const jwtExpiry = parseJwtExpiry(token);
      if (jwtExpiry) return jwtExpiry;
    }
  } catch {
    // not a valid URL — use default
  }
  // Fallback: 24 hours from now (Mux tokens typically last 12-24h)
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

function extractHlsFromEmbed(embedHtml: string | null): string | null {
  if (!embedHtml) return null;

  // Pattern 1: Full signed Mux URL with ?token= JWT
  // Matches: https://stream.mux.com/{ID}.m3u8?token=eyJ...
  const signedMatch = embedHtml.match(
    /https?:\/\/stream\.mux\.com\/[a-zA-Z0-9_-]+\.m3u8\?token=[^"'\s<>]+/i
  );
  if (signedMatch) return signedMatch[0];

  // Pattern 2: Any .m3u8 URL (signed or unsigned)
  const m3u8Match = embedHtml.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/i);
  if (m3u8Match) return m3u8Match[0];

  return null;
}

function extractHlsFromIncluded(included: PatreonIncluded[]): string | null {
  for (const item of included) {
    const attrs = item.attributes as Record<string, unknown>;

    // download_url — often contains the full signed Mux URL
    if (attrs.download_url && typeof attrs.download_url === "string") {
      const url = attrs.download_url;
      if (url.includes(".m3u8") || url.includes("mux.com")) return url;
    }

    // stream_url — direct stream link if exposed
    if (attrs.stream_url && typeof attrs.stream_url === "string") {
      return attrs.stream_url;
    }

    // urls object — check all keys for stream references
    const urls = attrs.urls as Record<string, string> | undefined;
    if (urls) {
      for (const key of Object.keys(urls)) {
        const val = urls[key];
        if (val?.includes(".m3u8") || val?.includes("mux.com")) {
          return val;
        }
      }
    }
  }
  return null;
}

// ─── Fetch helpers ────────────────────────────────────

async function fetchPostDetails(accountId: string, postId: string): Promise<PatreonResponse> {
  return patreonCookieFetch(
    accountId,
    `/api/posts/${postId}?include=media,attachments,campaign,access_rules,user&fields[post]=title,content,published_at,post_type,embed,image,teaser_text,url,post_metadata&fields[media]=id,type,attributes,download_url,image_urls,urls`
  );
}

async function fetchCampaignPosts(accountId: string, campaignId: string, cursor?: string): Promise<PatreonResponse> {
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
  if (cursor) params.set("page[cursor]", cursor);
  return patreonCookieFetch(accountId, `/api/posts?${params.toString()}`);
}

// ─── Find Campaign ID ─────────────────────────────────

async function findCampaignId(accountId: string): Promise<string> {
  // Check account-level override first
  const account = await prisma.creatorAccount.findUnique({ where: { id: accountId } });
  if (account?.patreonCampaignId) return account.patreonCampaignId;

  // Check env var
  const envCampaignId = process.env.PATREON_CAMPAIGN_ID;
  if (envCampaignId) return envCampaignId;

  // Try to discover from Patreon API
  try {
    const data = await patreonCookieFetch(
      accountId,
      "/api/current_user/campaigns?include=null&fields[campaign]=id,creation_name"
    );
    if (data.data?.[0]) return data.data[0].id;
  } catch {
    // Fallback
  }

  throw new Error(
    `Could not determine campaign ID for account. Set a campaign_id on the account or PATREON_CAMPAIGN_ID in .env.`
  );
}

// ─── Main Sync Function ───────────────────────────────

export async function syncAccountPosts(accountId: string): Promise<{
  accountId: string;
  accountName: string;
  syncedCount: number;
  total: number;
  nextCursor: string | null;
  hlsExtracted: number;
}> {
  const account = await prisma.creatorAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new Error(`Account not found: ${accountId}`);

  const sessionId = await getSessionCookie(accountId);
  if (!sessionId) {
    throw new Error(`No session_id configured for "${account.name}". Go to Admin → add session_id.`);
  }

  const campaignId = await findCampaignId(accountId);

  await prisma.creatorAccount.update({
    where: { id: accountId },
    data: { status: "running" },
  });

  let syncedCount = 0;
  let hlsExtracted = 0;
  let currentCursor: string | null = account.cursor ?? null;
  let hasMore = true;
  let totalPosts = 0;

  try {
    while (hasMore) {
      const data = await fetchCampaignPosts(accountId, campaignId, currentCursor ?? undefined);
      const posts = data.data || [];
      const included = data.included || [];
      totalPosts += posts.length;

      for (const post of posts) {
        const attrs = post.attributes;

        if (attrs.change_visibility_at && new Date(attrs.change_visibility_at) > new Date()) continue;

        const postType = mapPostType(attrs.post_type);
        const thumbnailUrl = attrs.image?.large_url || attrs.image?.url || null;
        const embedHtml = attrs.embed?.html || null;

        let hlsUrl: string | null = null;
        if (postType === "VIDEO") {
          hlsUrl = extractHlsFromIncluded(included) || extractHlsFromEmbed(embedHtml);
        }

        let postRecord = await prisma.post.findUnique({ where: { patreonId: post.id } });
        if (!postRecord) {
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
              creatorAccountId: accountId,
            },
          });
          syncedCount++;
        } else if (!postRecord.creatorAccountId) {
          // Backfill: associate orphaned posts with this account
          await prisma.post.update({
            where: { id: postRecord.id },
            data: { creatorAccountId: accountId },
          });
        }

        if (postType === "VIDEO" && !hlsUrl) {
          try {
            await new Promise((r) => setTimeout(r, 200));
            const details = await fetchPostDetails(accountId, post.id);
            const detailEmbed = details.data?.[0]?.attributes?.embed?.html || null;
            hlsUrl = extractHlsFromIncluded(details.included || []) || extractHlsFromEmbed(detailEmbed);
          } catch {
            // skip
          }
        }

        if (hlsUrl && postType === "VIDEO" && postRecord) {
          const expiry = getHlsExpiry(hlsUrl);
          const existingMedia = await prisma.media.findFirst({
            where: { postId: postRecord.id, type: "HLS_VIDEO" },
          });

          if (existingMedia) {
            await prisma.media.update({
              where: { id: existingMedia.id },
              data: {
                hlsManifestUrl: hlsUrl,
                hlsExpiresAt: expiry,
                hlsRefreshedAt: new Date(),
              },
            });
          } else {
            await prisma.media.create({
              data: {
                postId: postRecord.id,
                type: "HLS_VIDEO",
                hlsManifestUrl: hlsUrl,
                hlsExpiresAt: expiry,
                hlsRefreshedAt: new Date(),
                thumbnailUrl,
              },
            });
          }
          hlsExtracted++;
        }
      }

      currentCursor = data.meta?.pagination?.cursors?.next || null;
      hasMore = !!currentCursor && posts.length > 0;

      await prisma.creatorAccount.update({
        where: { id: accountId },
        data: { cursor: currentCursor || undefined },
      });

      if (currentCursor && syncedCount > 100) hasMore = false;
      if (hasMore) await new Promise((r) => setTimeout(r, 500));
    }

    await prisma.creatorAccount.update({
      where: { id: accountId },
      data: {
        lastSyncAt: new Date(),
        cursor: currentCursor || undefined,
        status: "success",
        errorLog: null,
      },
    });

    return { accountId, accountName: account.name, syncedCount, total: totalPosts, nextCursor: currentCursor, hlsExtracted };
  } catch (error: any) {
    await prisma.creatorAccount.update({
      where: { id: accountId },
      data: { status: "error", errorLog: error.message },
    });
    throw error;
  }
}

export async function syncAllAccounts(): Promise<Awaited<ReturnType<typeof syncAccountPosts>>[]> {
  const accounts = await prisma.creatorAccount.findMany({ where: { patreonSessionId: { not: null } } });
  const results: Awaited<ReturnType<typeof syncAccountPosts>>[] = [];

  for (const account of accounts) {
    try {
      const result = await syncAccountPosts(account.id);
      results.push(result);
    } catch (error: any) {
      results.push({
        accountId: account.id,
        accountName: account.name,
        syncedCount: 0,
        total: 0,
        nextCursor: null,
        hlsExtracted: 0,
        error: error.message || "Sync failed",
      } as any);
    }
  }

  return results;
}

// ─── Session Management ───────────────────────────────

export async function savePatreonSessionId(accountId: string, sessionId: string): Promise<void> {
  await prisma.creatorAccount.update({
    where: { id: accountId },
    data: {
      patreonSessionId: sessionId || null,
      sessionExpiresAt: sessionId
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        : null,
      status: "idle",
      errorLog: null,
    },
  });
}

export async function getSyncStatus(accountId: string) {
  return prisma.creatorAccount.findUnique({ where: { id: accountId } });
}

// ─── Legacy compat (for old code that calls these) ────

export async function getGlobalSyncStatus() {
  return prisma.syncState.findUnique({ where: { id: "main" } });
}
