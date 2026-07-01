# Codebuff Session Context — PatronHub

> **For the AI assistant:** Read this file first in the next session to pick up where we left off.

---

## Project Identity

- **Name:** PatronHub
- **Repo:** `https://github.com/zainaqdas/yukata`
- **Branch:** `master`
- **Path on disk:** `/home/dgfrii1800/patron-hub`
- **Status:** Fully built, typechecked, builds clean — ready for deployment

## What This Project Is

A private, members-only content platform for a Patreon creator to share their Patreon content with paying members. Only invited members get access. Supports multiple Patreon creator accounts (both owned and followed), each with independent sync state.

---

## Core Architecture

### 1. Multi-Account Patreon Sync (Cookie-Based)

**Two types of CreatorAccount:**
- **Owned** (`isOwned=true`) — has its own `session_id` cookie. The creator's own Patreon account.
- **Followed** (`isOwned=false`, `parentAccountId` set) — uses the parent's session_id. Created via discovery.

**Key functions:**
- `resolveAuthAccount(accountId)` — walks up `parentAccountId` chain to find an owned account with a session
- `discoverFollowedCampaigns(parentId)` — hits `/api/campaigns?filter[is_following]=true`, creates `CreatorAccount` records with `isOwned=false` + `parentAccountId`
- `syncAccountPosts(accountId)` — works for both types; followed accounts use parent's session via `resolveAuthAccount`
- `syncAllAccounts()` — iterates owned accounts (with session) + followed accounts (with campaign ID)
- Engine: `src/lib/patreon.ts`

### 2. Mux Video — Two Patreon Formats (HLS + MP4)

| Post Type | Embed HTML | Video Source | Format |
|---|---|---|---|
| `video` / `video_embed` | Yes | `embed.html` | Signed HLS .m3u8 |
| `video_external_file` | No | `included[].attributes.display` | Signed HLS .m3u8 |

**Critical discovery:** HLS URL lives in `attrs.display` (not `download_url` — that's a different Mux asset for downloading).

#### Extraction Pipeline
1. `extractVideoFromIncluded()` — checks `attrs.display` first, then `mimetype`, then `download_url`/`stream_url`/`urls`
2. `extractVideoFromEmbed()` — embed HTML regex fallback
3. `storeVideoMedia()` — stores HLS in `hlsManifestUrl`, MP4 in `url`
4. Returns `ExtractedVideo { url, isHls }`

#### JWT Token Handling
- `MUX_HLS_RE` / `MUX_MP4_RE` — module-level signed URL regex constants
- `parseJwtExpiry(token)` — `Buffer.from(payload, "base64url")`, 5-min buffer
- `getVideoExpiry(url)` — parses `?token=`; falls back to 24h

### 3. Auth.js v5 Magic Links + Invite Codes
- Email magic links, invite-code gated
- `signIn` callback claims invite codes automatically
- Type augmentation adds `role` to Session/User

### 4. Prisma 5 + Vercel Cron
- 9 models, Vercel cron: sync every 15 min, HLS check every hour

---

## Database Schema

| Model | Key Fields |
|---|---|
| **CreatorAccount** | name, patreonSessionId, patreonCampaignId, lastSyncAt, cursor, status, errorLog, **isOwned** (default true), **parentAccountId** (self-relation FK) |
| **Post** | patreonId (@unique), title, type, content, embedHtml, thumbnailUrl, creatorAccountId (FK) |
| **Media** | postId (FK), type (HLS_VIDEO/IMAGE/ATTACHMENT/EMBED), hlsManifestUrl, url, hlsExpiresAt |

---

## Key Files

| File | Purpose |
|---|---|
| `src/lib/patreon.ts` | Multi-account sync engine. Cookie auth, pagination, Mux extraction, JWT parsing, account CRUD, followed-campaign discovery. |
| `src/lib/auth.ts` | Auth.js v5 with Nodemailer, invite-code claiming, role augmentation |
| `src/lib/hls.ts` | HLS/MP4 URL storage, active URL lookup, expiry checking |
| `src/components/VideoPlayer.tsx` | video.js player supporting HLS and direct MP4 |
| `prisma/schema.prisma` | 9 models including CreatorAccount self-relation |
| `src/app/(auth)/admin/` | Admin dashboard with owned/followed badges, per-account session/sync, discover followed, add/delete |
| `src/app/api/accounts/route.ts` | Creator account CRUD |
| `src/app/api/accounts/discover/route.ts` | Discover followed campaigns from Patreon |
| `src/app/api/session/route.ts` | Per-account session_id management |
| `src/app/api/sync/route.ts` | Single-account or sync-all |

---

## Environment Variables

```
DATABASE_URL          # PostgreSQL
AUTH_SECRET           # openssl rand -hex 32
AUTH_URL              # https://your-app.vercel.app
EMAIL_SERVER          # SMTP for magic links
EMAIL_FROM            # noreply@yourdomain.com
CRON_SECRET           # openssl rand -hex 32
PATREON_CAMPAIGN_ID   # (optional) default campaign
PATREON_CF_BM_COOKIE  # (optional) Cloudflare bypass
```

---

## API Routes

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET/POST /api/auth/*` | Public | Magic-link auth |
| `GET /api/posts` | Member | Post list, optional `creatorAccountId` filter |
| `GET /api/posts/[id]` | Member | Post detail + active video URL |
| `GET /api/invites/validate` | Public | Validate & claim invite codes |
| `GET/POST/DELETE /api/invites` | Admin | CRUD invite codes |
| `POST /api/hls` | Admin | Submit/refresh video URL |
| `GET/POST /api/sync` | Admin | Sync single account or all |
| `GET/POST/DELETE /api/session` | Admin | Per-account session_id |
| `GET/POST/DELETE /api/accounts` | Admin | Creator account CRUD |
| `POST /api/accounts/discover` | Admin | Discover followed creators |
| `GET /api/cron/sync-patreon` | CRON_SECRET | Auto sync all accounts |
| `GET /api/cron/refresh-hls` | CRON_SECRET | HLS expiry check |

---

## Mux JWT Token Format

```
https://stream.mux.com/{PLAYBACK_ID}.m3u8?token=eyJhbGci...{payload}...{sig}
```

JWT payload: `{ sub: PLAYBACK_ID, exp: unix_ts, aud: "v", playback_restriction_id: "..." }`

---

## What's Done

- [x] Next.js 14 + TypeScript + Tailwind
- [x] Prisma 5 with 9 models (CreatorAccount self-relation)
- [x] Auth.js v5 magic links + invite codes
- [x] Multi-account cookie-based Patreon sync (owned + followed)
- [x] Followed creator discovery via Patreon API
- [x] Mux JWT token parsing with accurate expiry
- [x] Both HLS (.m3u8 from display/embed) and MP4 (.mp4 from download_url) video formats
- [x] Admin dashboard: account CRUD, per-account session & sync, discover followed, invite manager
- [x] Frontend: posts, gallery, search, video player
- [x] All API routes + Vercel cron
- [x] SETUP.md, README.md, .env.example, vercel.json
- [x] Tested against 7 real Patreon posts — 7/7 HLS extraction from display field
- [x] Typechecks clean, builds clean, pushed to GitHub

## What's NOT Done

- [ ] Deployment — follow SETUP.md
- [ ] Database — needs `npx prisma migrate deploy`
- [ ] First invite code — seed manually in DB
- [ ] Automated tests
- [ ] Account filter on /posts and /gallery
- [ ] Image optimization (Next.js Image)
- [ ] Rate limiting
- [ ] Member management UI

---

## Git History (latest first)

1. `feat: add followed creator discovery and sync`
2. `refactor: extract Mux HLS/MP4 regexes to module-level constants`
3. `fix: extract HLS URLs from media display field`
4. `fix: support both MP4 and HLS video formats from Mux`
5. `fix: preserve Mux JWT token in HLS URLs`
6. `feat: multi-creator-account support`
7. `docs: add README.md and AI context file`
8. `docs: add deployment guide, vercel config, and env template`
9. `feat: cookie-based Patreon sync with auto HLS extraction`
10. `Initial commit`

---

**Last updated:** July 1, 2026
**Session ended with:** Followed creator discovery — can now sync posts from creators you follow on Patreon. All video formats handled correctly.
