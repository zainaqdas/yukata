import { prisma } from "@/lib/prisma";
import { PostType } from "@prisma/client";

// ─── Types ────────────────────────────────────────────

type PostTypeEnum = keyof typeof PostType;

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

interface ExtractedVideo {
  url: string;
  isHls: boolean; // true = .m3u8, false = .mp4 (direct)
}

// ─── Account CRUD ─────────────────────────────────────

export async function listCreatorAccounts() {
  return prisma.creatorAccount.findMany({ orderBy: { createdAt: "asc" } });
}

/** Safe version that strips sensitive fields for API responses */
export async function listCreatorAccountsSafe() {
  const accounts = await prisma.creatorAccount.findMany({ orderBy: { createdAt: "asc" } });
  return accounts.map(({ id, name, patreonCampaignId, lastSyncAt, cursor, status, errorLog, isOwned, parentAccountId, createdAt, updatedAt }) => ({
    id, name, patreonCampaignId, lastSyncAt, cursor, status, errorLog, isOwned, parentAccountId, createdAt, updatedAt,
  }));
}

export async function getAccount(accountId: string) {
  return prisma.creatorAccount.findUnique({ where: { id: accountId } });
}

export async function createAccount(name: string, campaignId?: string) {
  return prisma.creatorAccount.create({
    data: { name, patreonCampaignId: campaignId || null, status: "idle" },
  });
}

export async function deleteAccount(accountId: string) {
  return prisma.creatorAccount.delete({ where: { id: accountId } });
}

// ─── Resolve auth account (walk up to owned parent) ──

async function resolveAuthAccount(accountId: string) {
  const account = await prisma.creatorAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new Error(`Account not found: ${accountId}`);
  // If this is a followed account, use the parent's session
  if (!account.isOwned && account.parentAccountId) {
    const parent = await prisma.creatorAccount.findUnique({ where: { id: account.parentAccountId } });
    if (!parent?.patreonSessionId) {
      throw new Error(`Parent account "${parent?.name}" has no session_id configured.`);
    }
    return parent;
  }
  if (!account.patreonSessionId) {
    throw new Error(`No session_id configured for "${account.name}". Add it in the admin dashboard.`);
  }
  return account;
}

// ─── Cookie Auth ──────────────────────────────────────

async function getSessionCookie(accountId: string): Promise<string | null> {
  const auth = await resolveAuthAccount(accountId);
  return auth.patreonSessionId || null;
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
    throw new Error("No Patreon session_id configured for account. Add it in the admin dashboard.");
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

export function mapPostType(patreonType: string | undefined): PostTypeEnum {
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

// ─── JWT Expiry Parsing ───────────────────────────────

export function parseJwtExpiry(token: string): Date | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
    if (payload.exp && typeof payload.exp === "number") {
      return new Date((payload.exp - 300) * 1000); // 5-min buffer
    }
    return null;
  } catch {
    return null;
  }
}

export function getVideoExpiry(url: string): Date {
  try {
    const parsed = new URL(url);
    const token = parsed.searchParams.get("token");
    if (token) {
      const jwtExpiry = parseJwtExpiry(token);
      if (jwtExpiry) return jwtExpiry;
    }
  } catch { /* not a valid URL */ }
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
}

// ─── Video URL Extraction (HLS + MP4) ─────────────────

// Signed Mux HLS URL: stream.mux.com/{ID}.m3u8?token=eyJ...
export const MUX_HLS_RE = /https?:\/\/stream\.mux\.com\/[a-zA-Z0-9_-]+\.m3u8\?token=[^"'\s<>]+/i;
// Signed Mux MP4 URL: stream.mux.com/{ID}/{quality}.mp4?token=eyJ...
export const MUX_MP4_RE = /https?:\/\/stream\.mux\.com\/[a-zA-Z0-9_-]+\/[^"'\s<>]*\.mp4\?token=[^"'\s<>]+/i;

export function extractVideoFromEmbed(embedHtml: string | null): ExtractedVideo | null {
  if (!embedHtml) return null;

  // Try signed HLS URL
  const signedHls = embedHtml.match(MUX_HLS_RE);
  if (signedHls) return { url: signedHls[0], isHls: true };

  // Try signed MP4 URL
  const signedMp4 = embedHtml.match(MUX_MP4_RE);
  if (signedMp4) return { url: signedMp4[0], isHls: false };

  // Any .m3u8 URL
  const m3u8Match = embedHtml.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/i);
  if (m3u8Match) return { url: m3u8Match[0], isHls: true };

  return null;
}

export function extractVideoFromIncluded(included: PatreonIncluded[]): ExtractedVideo | null {
  for (const item of included) {
    const attrs = item.attributes as Record<string, unknown>;

    // display — often contains the HLS manifest URL (e.g., for video_external_file posts)
    // This is the PRIMARY source for HLS URLs on Patreon!
    const display = attrs.display as string | Record<string, unknown> | undefined;
    if (display) {
      const displayStr = typeof display === "string" ? display : JSON.stringify(display);
      // Check for signed HLS URL in display
      const hlsMatch = displayStr.match(MUX_HLS_RE);
      if (hlsMatch) return { url: hlsMatch[0], isHls: true };
      // Check for signed MP4 URL in display
      const mp4Match = displayStr.match(MUX_MP4_RE);
      if (mp4Match) return { url: mp4Match[0], isHls: false };
    }

    // mimetype — application/x-mpegURL indicates HLS
    const mimetype = typeof attrs.mimetype === "string" ? attrs.mimetype : "";

    const dl = typeof attrs.download_url === "string" ? attrs.download_url : "";
    const stream = typeof attrs.stream_url === "string" ? attrs.stream_url : "";

    const candidates = [dl, stream];
    const urls = attrs.urls as Record<string, string> | undefined;
    if (urls) {
      for (const key of Object.keys(urls)) {
        const val = urls[key];
        if (val && (val.includes(".m3u8") || val.includes(".mp4") || val.includes("stream.mux.com"))) {
          candidates.push(val);
        }
      }
    }

    for (const url of candidates) {
      if (!url || !url.includes("mux.com")) continue;
      // If mimetype says HLS, prioritize .m3u8
      if (mimetype.includes("mpegurl") || url.includes(".m3u8")) return { url, isHls: true };
      if (url.includes(".mp4")) return { url, isHls: false };
      return { url, isHls: true };
    }
  }
  return null;
}

// ─── HTML content helper ──────────────────────────────

/** Strip HTML tags and decode common entities for plain text display */
function stripHtml(html: string): string {
  return html
    // Convert block-level closing tags to newlines for paragraph separation
    .replace(/<\/(?:p|div|h[1-6]|blockquote|li|tr|th|td)\s*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")   // Convert <br> to newlines
    .replace(/<[^>]*>/g, "")          // Remove remaining HTML tags
    .replace(/&nbsp;/gi, " ")         // Replace &nbsp; with space
    .replace(/&amp;/gi, "&")           // Replace &amp; with &
    .replace(/&lt;/gi, "<")            // Replace &lt; with <
    .replace(/&gt;/gi, ">")            // Replace &gt; with >
    .replace(/&quot;/gi, '"')          // Replace &quot; with "
    .replace(/&#39;/gi, "'")           // Replace &#39; with '
    .replace(/\s+\n/g, "\n")         // Clean up whitespace before newlines
    .replace(/\n{3,}/g, "\n\n")       // Max one blank line
    .trim();
}

// ─── Fetch helpers ────────────────────────────────────

async function fetchPostDetails(accountId: string, postId: string): Promise<PatreonResponse> {
  return patreonCookieFetch(
    accountId,
    `/api/posts/${postId}?include=media,attachments,campaign,access_rules,user&fields[post]=title,content,published_at,post_type,embed,image,teaser_text,url,post_metadata&fields[media]=id,type,display,mimetype,download_url,stream_url,urls,image_urls`
  );
}

async function fetchCampaignPosts(accountId: string, campaignId: string, cursor?: string): Promise<PatreonResponse> {
  const params = new URLSearchParams({
    include: "media,attachments,access_rules,campaign,user,user_defined_tags",
    sort: "-published_at",
    "filter[campaign_id]": campaignId,
    "filter[contains_exclusive_posts]": "true",
    "filter[is_draft]": "false",
    "page[count]": "20",
    "fields[post]":
      "title,content,published_at,post_type,embed,image,teaser_text,url,comment_count,like_count,edited_at,post_metadata",
    "fields[media]": "id,type,display,mimetype,download_url,stream_url,urls,image_urls",
  });
  if (cursor) params.set("page[cursor]", cursor);
  return patreonCookieFetch(accountId, `/api/posts?${params.toString()}`);
}

// ─── Find Campaign ID ─────────────────────────────────

async function findCampaignId(accountId: string): Promise<string> {
  const account = await prisma.creatorAccount.findUnique({ where: { id: accountId } });
  if (account?.patreonCampaignId) return account.patreonCampaignId;

  // Only try API discovery for owned accounts
  if (!account?.isOwned) {
    throw new Error(`No campaign ID set for followed account "${account?.name}".`);
  }

  const envCampaignId = process.env.PATREON_CAMPAIGN_ID;
  if (envCampaignId) return envCampaignId;

  try {
    const data = await patreonCookieFetch(accountId,
      "/api/current_user/campaigns?include=null&fields[campaign]=id,creation_name"
    );
    if (data.data?.[0]) return data.data[0].id;
  } catch { /* fallback */ }

  throw new Error("Could not determine campaign ID. Set a campaign_id on the account or PATREON_CAMPAIGN_ID in .env.");
}

// ─── Discover followed campaigns ──────────────────────

export async function discoverFollowedCampaigns(parentAccountId: string): Promise<{
  discovered: number;
  campaigns: Array<{ id: string; name: string }>;
}> {
  const parent = await prisma.creatorAccount.findUnique({ where: { id: parentAccountId } });
  if (!parent?.isOwned) throw new Error("Only owned accounts can discover followed creators.");

  const data = await patreonCookieFetch(
    parentAccountId,
    "/api/campaigns?filter[is_following]=true&include=null&fields[campaign]=creation_name,avatar_photo_url"
  );

  const campaigns = (data.data || []) as Array<{ id: string; attributes?: { creation_name?: string } }>;
  let discovered = 0;
  const result: Array<{ id: string; name: string }> = [];

  for (const c of campaigns) {
    // Skip if it's the parent's own campaign (try stored ID or env fallback)
    const parentCampaignId = parent.patreonCampaignId || process.env.PATREON_CAMPAIGN_ID;
    if (parentCampaignId && c.id === parentCampaignId) continue;

    const name = c.attributes?.creation_name || `Creator ${c.id.slice(0, 8)}`;

    // Check if already exists
    const existing = await prisma.creatorAccount.findFirst({
      where: { patreonCampaignId: c.id },
    });
    if (existing) {
      result.push({ id: existing.id, name: existing.name });
      continue;
    }

    // Create followed account
    const created = await prisma.creatorAccount.create({
      data: {
        name,
        patreonCampaignId: c.id,
        isOwned: false,
        parentAccountId,
        status: "idle",
      },
    });
    discovered++;
    result.push({ id: created.id, name: created.name });
  }

  return { discovered, campaigns: result };
}

async function storeVideoMedia(
  postId: string,
  video: ExtractedVideo,
  thumbnailUrl: string | null
): Promise<void> {
  const expiry = getVideoExpiry(video.url);

  const existing = await prisma.media.findFirst({
    where: { postId, type: "HLS_VIDEO" },
  });

  const data = {
    hlsManifestUrl: video.isHls ? video.url : null,
    url: video.isHls ? null : video.url,
    hlsExpiresAt: expiry,
    hlsRefreshedAt: new Date(),
    ...(!existing ? { thumbnailUrl } : {}),
  };

  if (existing) {
    await prisma.media.update({ where: { id: existing.id }, data });
  } else {
    await prisma.media.create({
      data: { postId, type: "HLS_VIDEO", ...data },
    });
  }
}

// ─── Main Sync Function ───────────────────────────────

export interface SyncResult {
  accountId: string;
  accountName: string;
  syncedCount: number;
  total: number;
  nextCursor: string | null;
  hlsExtracted: number;
  error?: string;
}

export async function syncAccountPosts(accountId: string): Promise<SyncResult> {
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

        let video: ExtractedVideo | null = null;
        if (postType === "VIDEO") {
          video = extractVideoFromIncluded(included) || extractVideoFromEmbed(embedHtml);
        }

        let postRecord = await prisma.post.findUnique({ where: { patreonId: post.id } });
        if (!postRecord) {
          postRecord = await prisma.post.create({
            data: {
              patreonId: post.id,
              title: attrs.title || "Untitled",
              content: stripHtml(attrs.content || "") || attrs.teaser_text || "",
              contentHtml: embedHtml,
              type: postType,
              thumbnailUrl,
              embedHtml,
              publishedAt: new Date(attrs.published_at),
              isPublished: true,
              creatorAccountId: accountId,
            },
          });
          syncedCount++;
        } else if (!postRecord.creatorAccountId) {
          await prisma.post.update({
            where: { id: postRecord.id },
            data: { creatorAccountId: accountId },
          });
        }

        // For video posts without a URL yet, fetch individual post details
        if (postType === "VIDEO" && !video) {
          try {
            await new Promise((r) => setTimeout(r, 200));
            const details = await fetchPostDetails(accountId, post.id);
            const detailEmbed = details.data?.[0]?.attributes?.embed?.html || null;
            video = extractVideoFromIncluded(details.included || []) || extractVideoFromEmbed(detailEmbed);
          } catch { /* skip */ }
        }

        if (video && postType === "VIDEO" && postRecord) {
          await storeVideoMedia(postRecord.id, video, thumbnailUrl);
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown sync error";
    await prisma.creatorAccount.update({
      where: { id: accountId },
      data: { status: "error", errorLog: message },
    });
    throw error;
  }
}

export async function syncAllAccounts(): Promise<SyncResult[]> {
  // Get owned accounts with session_id + all followed accounts (which use their parent's session)
  const owned = await prisma.creatorAccount.findMany({
    where: { isOwned: true, patreonSessionId: { not: null } },
  });
  const followed = await prisma.creatorAccount.findMany({
    where: { isOwned: false, patreonCampaignId: { not: null } },
  });
  const allAccounts = [...owned, ...followed];
  const results: SyncResult[] = [];

  for (const account of allAccounts) {
    try {
      results.push(await syncAccountPosts(account.id));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Sync failed";
      results.push({
        accountId: account.id,
        accountName: account.name,
        syncedCount: 0,
        total: 0,
        nextCursor: null,
        hlsExtracted: 0,
        error: message,
      });
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
      sessionExpiresAt: sessionId ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
      status: "idle",
      errorLog: null,
    },
  });
}

export async function getSyncStatus(accountId: string) {
  return prisma.creatorAccount.findUnique({ where: { id: accountId } });
}

export async function getGlobalSyncStatus() {
  return prisma.syncState.findUnique({ where: { id: "main" } });
}
