# Codebuff Session Context — PatronHub

> **For the AI assistant:** Read this file first in the next session to pick up where we left off.

---

## Project Identity

- **Name:** PatronHub
- **Repo:** `https://github.com/zainaqdas/yukata`
- **Branch:** `master`
- **Path on disk:** `/home/dgfrii1800/patron-hub`
- **Status:** Fully built, typechecked, builds clean, 53 unit tests passing — ready for deployment

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
- `listCreatorAccountsSafe()` — strips `patreonSessionId`/`sessionExpiresAt` for API responses
- `stripHtml(html)` — strips HTML tags, decodes entities, converts block tags to newlines for clean plain-text content
- Exported pure functions: `mapPostType`, `parseJwtExpiry`, `getVideoExpiry`, `extractVideoFromEmbed`, `extractVideoFromIncluded`, `MUX_HLS_RE`, `MUX_MP4_RE`

### 2. Mux Video — Multiple Patreon Formats

| Post Type | Source Field | Format |
|---|---|---|
| `video` / `video_embed` | `embed.html` | Signed HLS .m3u8 |
| `video_external_file` | `included[].attributes.download_url` | Signed MP4 (Mux) |
| all video types | `included[].attributes.display` | Signed HLS .m3u8 |
| all video types | `included[].attributes.stream_url` | Signed HLS .m3u8 |

**Extraction pipeline:** `display` → `mimetype` → `download_url`/`stream_url`/`urls` → embed HTML
**Regex constants:** `MUX_HLS_RE`, `MUX_MP4_RE` (module-level, exported)
**JWT:** `parseJwtExpiry()` with 5-min buffer

**API fieldset fix:** The `fields[media]` sparse fieldset now explicitly requests `display`, `mimetype`, `download_url`, `stream_url`, `urls`, and `image_urls` — ensuring all video extraction paths have the data they need.

### 3. No Auth — Public Link Access

- No login, no magic links, no invite codes, no user accounts
- Anyone with the URL can access all content + admin
- Share the link only in trusted channels (private Discord)
- Removed: Auth.js, Nodemailer, middleware, User/InviteCode/Account/Session models

### 4. Prisma 5 + Vercel Cron

- 4 models (CreatorAccount, Post, Media, SyncState)
- Cron: sync every 15 min, HLS check every hour
- API `/api/posts` includes `creatorAccount` in response for creator names

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
| `src/lib/hls.ts` | HLS/MP4 URL storage, active URL lookup, expiry checking (env var `HLS_REFRESH_INTERVAL_MINUTES`) |
| `src/components/Navbar.tsx` | Navigation bar with Posts, Gallery, Search, Admin links |
| `src/components/CreatorFilter.tsx` | Client dropdown to filter /posts feed by creator |
| `src/components/VideoPlayer.tsx` | video.js player (HLS + MP4) |
| `src/components/SearchBar.tsx` | Controlled search input (query/type props with callbacks) |
| `src/components/SearchResults.tsx` | Client-side search results via TanStack Query (`keepPreviousData`) |
| `prisma/schema.prisma` | 4 models: CreatorAccount, Post, Media, SyncState |
| `src/app/(main)/admin/` | Admin dashboard: owned/followed badges, per-account session/sync, discover, add/delete |
| `src/app/layout.tsx` | Root layout with Navbar (no Providers/SessionProvider) |
| `src/app/(main)/search/page.tsx` | Client component with 300ms debounced real-time search |
| `vitest.config.ts` | Vitest config with `@/` path alias |
| `src/lib/__tests__/patreon.test.ts` | 41 unit tests for pure sync functions |
| `src/lib/__tests__/hls.test.ts` | 12 unit tests for HLS management (mocked Prisma) |

---

## Environment Variables

```
DATABASE_URL                    # PostgreSQL
CRON_SECRET                     # openssl rand -hex 32
PATREON_CF_BM_COOKIE            # (optional) Cloudflare bypass
PATREON_CAMPAIGN_ID             # (optional) Explicit campaign ID if auto-detection fails
HLS_REFRESH_INTERVAL_MINUTES    # (optional) Minutes before HLS expiry to trigger refresh (default: 30)
```

---

## API Routes

| Endpoint | Purpose |
|---|---|
| `GET /api/posts` | Post list, optional `creatorAccountId` filter; includes `creatorAccount` + `media` |
| `GET /api/posts/[id]` | Post detail + active HLS/MP4 video URL |
| `POST /api/hls` | Submit/refresh video URL |
| `GET/POST /api/sync` | Sync single account or all |
| `GET/POST/DELETE /api/session` | Per-account session_id management |
| `GET/POST/DELETE /api/accounts` | Creator account CRUD (GET uses `listCreatorAccountsSafe` — no session leak) |
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
- [x] **Audit fixes (round 1)** — `patreonSessionId` leak fixed, 18 `as any` eliminated, `<a>`→`<Link>`, error types, env var validation
- [x] **53 unit tests** — Vitest + TanStack Query mocks for patreon.ts (41) and hls.ts (12), `npm test` / `npm run test:watch`
- [x] **Client-side real-time search** — debounced 300ms auto-search via `/api/posts`, TanStack Query with `keepPreviousData`, skeleton loading, internal pagination
- [x] **Env vars documented** — `PATREON_CAMPAIGN_ID`, `HLS_REFRESH_INTERVAL_MINUTES` in `.env.example`, `SETUP.md`, `README.md`
- [x] **Audit fixes (round 2)** — See full details below

---

## Git History (latest first)

1. `feat: client-side real-time search with debounce and TanStack Query`
2. `docs: add PATREON_CAMPAIGN_ID and HLS_REFRESH_INTERVAL_MINUTES to setup docs`
3. `test: add 53 unit tests for patreon.ts and hls.ts with Vitest`
4. `fix: e2e audit fixes - patreonSessionId leak, type safety, lint, and more`
5. `refactor: remove invite-based auth system, make site publicly accessible`
6. `docs: update SETUP.md for multi-account sync`
7. `docs: update context.md with creator filter feature`
8. `feat: add creator filter dropdown to /posts feed`
9. `feat: add home feed with creator names on post cards`
10. `feat: add followed creator discovery and sync`
11. `refactor: extract Mux HLS/MP4 regexes`
12. `fix: extract HLS URLs from media display field`
13. `fix: support both MP4 and HLS video formats`
14. `feat: multi-creator-account support`
15. `feat: cookie-based Patreon sync`
16. `Initial commit`

---

**Last updated:** July 1, 2026

**Session: E2E Audit + 8 Bugfixes**

- Ran full end-to-end audit across all files and the entire pipeline
- **Tested with real Patreon API** using provided session_id and __cf_bm cookies — fetched post "86 Episodes 21-23 (Free Version)" (type: `video_external_file`)
- Verified Mux URL extraction works: found `stream.mux.com/...720p.mp4?token=...` in `download_url` field

**8 fixes applied:**
1. **API sparse fieldsets** — Added `display`, `mimetype`, `stream_url` to `fields[media]` in both fetch functions so video extraction can access all sources
2. **HTML content** — Added `stripHtml()` that converts block tags + `<br>` to newlines, decodes HTML entities, stores clean plain text in `content`
3. **`.env.example` cleanup** — Removed unused `PATREON_SESSION_ID` env var
4. **Post detail HLS logic** — Replaced duplicate inline logic with shared `getActiveHlsUrl()` + MP4 fallback
5. **Gallery expiry filter** — `getAllVideos()` now excludes expired HLS videos
6. **SessionManager types** — Fixed `Date | null` → `string | null` for serialized props + `.toISOString()` in AdminPage
7. **DiscoverButton formatting** — Added missing newline
8. **HLS submit refresh** — Added `router.refresh()` after submitting HLS URL

**Tests:** 53/53 passing | **TypeScript:** Clean

**Next up:** CI workflow, integration tests, or deployment.
