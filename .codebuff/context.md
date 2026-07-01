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

A private, members-only content platform for a Patreon creator to share their Patreon content with paying members. Only invited members get access. Supports multiple Patreon creator accounts, each with its own session_id and independent sync state.

---

## Core Architecture

### 1. Multi-Account Patreon Sync (Cookie-Based)
- Uses `session_id` cookie to hit Patreon's internal REST API at `/api/posts`
- Each `CreatorAccount` stores its own `session_id`, cursor, campaign ID, status, and error log
- `syncAccountPosts(accountId)` and `syncAllAccounts()` entry points
- Optional `__cf_bm` env var for Cloudflare bypass (shared across accounts)
- Engine: `src/lib/patreon.ts`

### 2. Mux Video — Two Patreon Formats (HLS + MP4)

Patreon serves video through Mux.com in two formats:

| Post Type | Embed HTML | Video Source | Format |
|---|---|---|---|
| `video` / `video_embed` | Yes | `embed.html` | Signed HLS .m3u8 |
| `video_external_file` | No | `included[].attributes.display` | Signed HLS .m3u8 |

**Critical discovery:** For `video_external_file` posts (the most common), the HLS URL is in `attrs.display` — a field we initially missed. Patreon's `attrs.download_url` contains an MP4 download (different Mux asset, different playback ID, different token). MP4 tokens are NOT valid for HLS (tested: returns 403).

#### Extraction Pipeline (priority order)

1. **`extractVideoFromIncluded()`** — iterates Patreon `included` media:
   - `attrs.display` (PRIMARY HLS source) — string or object, regex-matched
   - `attrs.mimetype` — `application/x-mpegURL` confirms HLS
   - `attrs.download_url` / `attrs.stream_url` / `attrs.urls` — fallbacks
   - Returns `ExtractedVideo { url, isHls }`

2. **`extractVideoFromEmbed()`** — embed HTML regex for `video`/`video_embed` types

3. **`storeVideoMedia()`** — stores HLS in `hlsManifestUrl`, MP4 in `url`, both with JWT expiry

#### JWT Token Handling
- `parseJwtExpiry(token)` — `Buffer.from(payload, "base64url")`, reads `exp`, 5-min buffer
- `getVideoExpiry(url)` — parses `?token=` from URL; falls back to 24h
- URLs are signed per-rendition: HLS token != MP4 token

### 3. Auth.js v5 Magic Links + Invite Codes
- Email magic links only, no passwords
- Gated by invite codes: validate + claim on sign-in
- Admin role controls sync, invites, HLS management
- Type augmentation adds `role` to Session/User

### 4. Prisma 5 + Vercel Cron
- 9 models: User, InviteCode, CreatorAccount, Post, Media, SyncState, Account, Session, VerificationToken
- Vercel cron: sync every 15 min, HLS check every hour

---

## Database Schema

| Model | Key Fields |
|---|---|
| **CreatorAccount** | name, patreonSessionId, sessionExpiresAt, patreonCampaignId, lastSyncAt, cursor, status, errorLog |
| **Post** | patreonId (@unique), title, type, content, embedHtml, thumbnailUrl, creatorAccountId (FK) |
| **Media** | postId (FK), type (HLS_VIDEO/IMAGE/ATTACHMENT/EMBED), hlsManifestUrl, url, hlsExpiresAt |

---

## Key Files

| File | Purpose |
|---|---|
| `src/lib/patreon.ts` | Multi-account sync engine. Cookie auth, pagination (500ms delay), Mux extraction pipeline, JWT parsing, account CRUD. |
| `src/lib/auth.ts` | Auth.js v5 with Nodemailer, invite-code claiming, role augmentation |
| `src/lib/hls.ts` | HLS/MP4 URL storage, active URL lookup, expiry checking |
| `src/components/VideoPlayer.tsx` | video.js player supporting both HLS (.m3u8) and direct MP4 |
| `prisma/schema.prisma` | 9 models |
| `src/app/(auth)/admin/` | Multi-account dashboard with per-account session, sync, add/delete |
| `src/app/api/accounts/route.ts` | Creator account CRUD |
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

## Mux JWT Token Format

```
https://stream.mux.com/{PLAYBACK_ID}.m3u8?token=eyJhbGci...{payload}...{sig}
```

JWT payload: `{ sub: PLAYBACK_ID, exp: unix_ts, aud: "v", playback_restriction_id: "..." }`

---

## What's Done

- [x] Next.js 14 + TypeScript + Tailwind
- [x] Prisma 5 with 9 models
- [x] Auth.js v5 magic links + invite codes
- [x] Multi-account cookie-based Patreon sync
- [x] Mux JWT token parsing with accurate expiry
- [x] Both HLS (.m3u8 from display/embed) and MP4 (.mp4 from download_url) video formats
- [x] Admin dashboard: account CRUD, per-account session & sync, invite manager
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

1. `fix: extract HLS URLs from media display field`
2. `fix: support both MP4 and HLS video formats from Mux`
3. `fix: preserve Mux JWT token in HLS URLs`
4. `feat: multi-creator-account support`
5. `docs: add README.md and AI context file`
6. `docs: add deployment guide, vercel config, and env template`
7. `feat: cookie-based Patreon sync with auto HLS extraction`
8. `Initial commit`

---

**Last updated:** July 1, 2026
**Session ended with:** Display field discovery — HLS extraction now works for all Patreon video formats. 7/7 posts tested successfully.
