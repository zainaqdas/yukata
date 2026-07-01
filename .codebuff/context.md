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

A content platform that syncs Patreon posts (including video) for sharing via a private link inside a premium Discord. **No auth system** — access is controlled by who has the link (shared only in trusted channels). Supports multiple Patreon creator accounts (owned + followed).

---

## Core Architecture

### 1. Multi-Account Patreon Sync (Cookie-Based)

**Two types of CreatorAccount:**
- **Owned** (`isOwned=true`) — has its own `session_id` cookie
- **Followed** (`isOwned=false`, `parentAccountId` set) — uses the parent's session_id

**Key functions in `src/lib/patreon.ts`:**
- `resolveAuthAccount(accountId)` — walks up chain to find owned account with session
- `discoverFollowedCampaigns(parentId)` — `/api/campaigns?filter[is_following]=true`
- `syncAccountPosts(accountId)` — works for both types
- `syncAllAccounts()` — iterates all accounts

### 2. Mux Video — Two Patreon Formats

| Post Type | Source Field | Format |
|---|---|---|
| `video` / `video_embed` | `embed.html` | Signed HLS .m3u8 |
| `video_external_file` | `included[].attributes.display` | Signed HLS .m3u8 |

**Extraction pipeline:** `display` → `mimetype` → `download_url`/`stream_url`/`urls` → embed HTML
**Regex constants:** `MUX_HLS_RE`, `MUX_MP4_RE` (module-level)
**JWT:** `parseJwtExpiry()` with 5-min buffer

### 3. No Auth — Public Link Access

- No login, no magic links, no invite codes, no user accounts
- Anyone with the URL can access all content + admin
- Share the link only in trusted channels (private Discord)
- Removed: Auth.js, Nodemailer, middleware, User/InviteCode/Account/Session models

### 4. Prisma 5 + Vercel Cron

- 4 models (CreatorAccount, Post, Media, SyncState)
- Cron: sync every 15 min, HLS check every hour

---

## Database Schema

| Model | Key Fields |
|---|---|
| **CreatorAccount** | name, patreonSessionId, patreonCampaignId, lastSyncAt, cursor, status, errorLog, isOwned, parentAccountId (self-relation) |
| **Post** | patreonId (@unique), title, type, content, embedHtml, thumbnailUrl, creatorAccountId (FK) |
| **Media** | postId (FK), type (HLS_VIDEO/IMAGE/ATTACHMENT/EMBED), hlsManifestUrl, url, hlsExpiresAt |

---

## Key Files

| File | Purpose |
|---|---|
| `src/lib/patreon.ts` | Multi-account sync engine, cookie auth, Mux extraction, JWT parsing, account CRUD, discovery |
| `src/lib/hls.ts` | HLS/MP4 URL storage, active URL lookup, expiry checking |
| `src/components/Navbar.tsx` | Navigation bar with Posts, Gallery, Search, Admin links |
| `src/components/CreatorFilter.tsx` | Client dropdown to filter /posts feed by creator |
| `src/components/VideoPlayer.tsx` | video.js player (HLS + MP4) |
| `prisma/schema.prisma` | 4 models: CreatorAccount, Post, Media, SyncState |
| `src/app/(main)/admin/` | Admin dashboard: owned/followed badges, per-account session/sync, discover, add/delete |
| `src/app/layout.tsx` | Root layout with Navbar (no Providers/SessionProvider) |

---

## Environment Variables

```
DATABASE_URL          # PostgreSQL
CRON_SECRET           # openssl rand -hex 32
PATREON_CF_BM_COOKIE  # (optional) Cloudflare bypass
```

---

## API Routes

| Endpoint | Purpose |
|---|---|
| `GET /api/posts` | Post list, optional `creatorAccountId` filter |
| `GET /api/posts/[id]` | Post detail + active video URL |
| `POST /api/hls` | Submit/refresh video URL |
| `GET/POST /api/sync` | Sync single account or all |
| `GET/POST/DELETE /api/session` | Per-account session_id management |
| `GET/POST/DELETE /api/accounts` | Creator account CRUD |
| `POST /api/accounts/discover` | Discover followed creators |
| `GET /api/cron/sync-patreon` | Auto sync all accounts (CRON_SECRET) |
| `GET /api/cron/refresh-hls` | HLS expiry check (CRON_SECRET) |

---

## What's Done

- [x] Next.js 16 + TypeScript + Tailwind
- [x] Multi-account cookie-based Patreon sync (owned + followed)
- [x] Followed creator discovery via Patreon API
- [x] Both HLS (.m3u8 from display/embed) and MP4 video formats
- [x] Mux JWT token parsing with accurate expiry
- [x] Admin dashboard: account CRUD, session, sync, discover, delete
- [x] Frontend: posts feed with creator names + filter dropdown, gallery, search, video player
- [x] All API routes + Vercel cron
- [x] SETUP.md, README.md, .env.example, vercel.json
- [x] 7/7 real Patreon posts verified — HLS extraction from display field
- [x] Typechecks clean, builds clean
- [x] **Auth removed** — no login, no invite codes, public link access

---

## Git History (latest first)

1. `refactor: remove invite-based auth system, make site publicly accessible`
2. `docs: update SETUP.md for multi-account sync`
3. `docs: update context.md with creator filter feature`
4. `feat: add creator filter dropdown to /posts feed`
5. `feat: add home feed with creator names on post cards`
6. `feat: add followed creator discovery and sync`
7. `refactor: extract Mux HLS/MP4 regexes`
8. `fix: extract HLS URLs from media display field`
9. `fix: support both MP4 and HLS video formats`
10. `feat: multi-creator-account support`
11. `feat: cookie-based Patreon sync`
12. `Initial commit`

---

**Last updated:** July 1, 2026
**Session ended with:** Auth system removed — no login, invite codes, or user accounts. Site is accessible to anyone with the link. All API auth checks stripped. Simplified to 4 Prisma models. Route group renamed from `(auth)` to `(main)`. README.md and all docs updated. 13 commits total.
