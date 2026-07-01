# Codebuff Session Context — PatronHub

> **For the AI assistant:** Read this file first in the next session to pick up where we left off. This captures project state, decisions, and what's been built so far.

---

## Project Identity

- **Name:** PatronHub
- **Repo:** `https://github.com/zainaqdas/yukata`
- **Branch:** `master`
- **Path on disk:** `/home/dgfrii1800/patron-hub`
- **Status:** Fully built, typechecked, builds clean — ready for deployment

## What This Project Is

A private, members-only content platform for a Patreon creator to share their Patreon content with paying members in a better UI than Patreon's native interface. Only invited members get access. The creator uses it to give their community a fast, modern video/content experience without Patreon's laggy UI and buggy video player.

**Supports multiple Patreon accounts** — the creator can add multiple Patreon accounts (e.g., different content channels, different communities), each with its own `session_id` cookie, campaign ID, and independent sync state.

---

## Core Architecture Decisions

### 1. Multi-Account Patreon Sync (Cookie-Based, Like Kemono)
- **NOT** using the public Patreon OAuth API
- Uses `session_id` cookie (from browser) to hit Patreon's **internal REST API** at `/api/posts`
- **Each `CreatorAccount`** stores its own `session_id`, cursor, campaign ID, sync status, and error log
- The `session_id` is stored in the DB (`CreatorAccount.patreonSessionId`) and entered per-account via admin dashboard
- Also supports optional `__cf_bm` env var for Cloudflare bypass (shared across all accounts)
- Sync engine: `src/lib/patreon.ts`
- Two sync modes: `syncAccountPosts(accountId)` for a single account, `syncAllAccounts()` iterates all accounts with saved sessions

### 2. Mux HLS Video with JWT Signed URLs
- Patreon hosts video through Mux.com with **signed HLS URLs**
- Real URLs look like: `https://stream.mux.com/{PLAYBACK_ID}.m3u8?token=eyJ...`
- The `?token=` parameter is a JWT with an `exp` claim (Unix timestamp) — **required** for playback
- `parseJwtExpiry()` decodes the JWT `exp` claim via `Buffer.from(payload, "base64url")` 
- `getHlsExpiry()` reads the `?token=` param and uses real JWT expiry (minus 5 min buffer); falls back to 24h default
- `extractHlsFromEmbed()` uses a dedicated regex for signed URLs: `stream.mux.com/[a-zA-Z0-9_-]+.m3u8?token=[^"'\s<>]+`
- Bare playback IDs without tokens are useless — we removed `buildMuxHlsUrl` and `extractMuxPlaybackId`
- Expiry is set per-media record in `hlsExpiresAt`; cron job alerts on approaching expiry

### 3. Auth.js v5 Magic Links
- Not using passwords — email magic links only
- Gated by invite codes: users must provide a valid invite code to sign in
- On first sign-in with a valid code, the code is "claimed" (linked to user, `currentUses` incremented)
- Admin role controls access to sync, invites, and HLS management
- Type augmentation adds `role` to both `next-auth` Session and User types

### 4. Prisma 5 (Downgraded from Prisma 7)
- Prisma 7 had breaking changes (datasource URL moved to `prisma.config.ts`)
- We downgraded to stable Prisma 5 to avoid issues
- **9 models:** User, InviteCode, CreatorAccount, Post, Media, SyncState, Account, Session, VerificationToken
- `SyncState` is now minimal (just `id` + `updatedAt`) — all sync data moved to `CreatorAccount`

### 5. Vercel Hosting with Cron Jobs
- `vercel.json` defines two cron jobs:
  - `*/15 * * * *` → sync Patreon posts (now syncs all accounts via `syncAllAccounts`)
  - `0 * * * *` → check HLS URL expiry (JWT-based)
- Cron endpoints protected by `CRON_SECRET` header check

---

## Database Schema (9 Models)

| Model | Key Fields | Notes |
|---|---|---|
| **CreatorAccount** | `name`, `patreonSessionId`, `sessionExpiresAt`, `patreonCampaignId`, `lastSyncAt`, `cursor`, `status`, `errorLog` | One per Patreon account. Stores per-account sync state and session cookie. |
| **User** | `email`, `role` (ADMIN/MEMBER), `inviteCodeId` | Auth.js user. Linked to invite code used at sign-up. |
| **InviteCode** | `code`, `maxUses`, `currentUses`, `isActive`, `note`, `pendingEmail` | Invite-code gating for sign-in. |
| **Post** | `patreonId` (@unique), `title`, `type`, `content`, `contentHtml`, `thumbnailUrl`, `embedHtml`, `creatorAccountId` | Posts attributed to a creator account via FK. |
| **Media** | `postId` (FK), `type` (HLS_VIDEO/IMAGE/ATTACHMENT/EMBED), `hlsManifestUrl`, `hlsExpiresAt`, `hlsRefreshedAt`, `thumbnailUrl` | HLS URLs stored with JWT-based expiry. |
| **SyncState** | `id` ("main"), `updatedAt` | Legacy/minimal — sync data moved to CreatorAccount. |
| **Account** | Auth.js provider account linking | |
| **Session** | Auth.js session tokens | |
| **VerificationToken** | Auth.js magic-link tokens | |

---

## Key Files

| File | Purpose |
|---|---|
| `src/lib/patreon.ts` | **The most complex file.** Multi-account sync engine. Cookie auth, pagination, rate limiting (500ms delay), Mux JWT token extraction, JWT `exp` parsing, account CRUD. Two entry points: `syncAccountPosts(id)` and `syncAllAccounts()`. |
| `src/lib/auth.ts` | Auth.js v5 config with Nodemailer provider. Type augmentation for `role` on Session/User. Invite-code claiming in `signIn` callback. |
| `src/lib/invites.ts` | Invite code CRUD + validation + claiming flow |
| `src/lib/hls.ts` | HLS URL storage, active URL lookup, expiry checking |
| `src/middleware.ts` | Route protection — public paths: `/api/auth/*`, `/api/invites/validate`, `/login` |
| `prisma/schema.prisma` | Database schema with 9 models including CreatorAccount |
| `src/app/(auth)/admin/page.tsx` | Admin dashboard: stats, multi-account list with per-account session, sync, and delete |
| `src/app/(auth)/admin/SessionManager.tsx` | Per-account session_id input (client component) |
| `src/app/(auth)/admin/SyncButton.tsx` | Per-account sync + sync-all button (client component) |
| `src/app/(auth)/admin/AddAccountForm.tsx` | Create new creator account form (client component) |
| `src/app/(auth)/admin/DeleteAccountButton.tsx` | Delete account with confirmation (client component) |
| `src/app/api/accounts/route.ts` | GET/POST/DELETE for creator accounts |
| `src/app/api/session/route.ts` | GET/POST/DELETE per-account session_id (requires `accountId` param) |
| `src/app/api/sync/route.ts` | POST syncs single account (`{accountId}`) or all accounts (`{}`) |
| `src/app/api/cron/sync-patreon/route.ts` | Cron endpoint — calls `syncAllAccounts()` |

---

## Mux JWT Token Details (Critical!)

### Real URL Format
```
https://stream.mux.com/{PLAYBACK_ID}.m3u8?token=eyJhbGciOiJSUzI1NiIs...{payload}...{signature}
```

### JWT Payload Structure
```json
{
  "sub": "{PLAYBACK_ID}",
  "exp": 1775437200,          // Unix timestamp (seconds) — when token expires
  "aud": "v",                  // "v" for video
  "playback_restriction_id": "{RESTRICTION_ID}"
}
```

### How We Handle It
1. `extractHlsFromEmbed()` — dedicated regex matches `stream.mux.com/[ID].m3u8?token=[JWT]` first, then generic `.m3u8`
2. `extractHlsFromIncluded()` — checks `download_url`, `stream_url`, and `urls` object on Patreon `included` items
3. `getHlsExpiry(hlsUrl)` — parses `?token=` from URL, decodes JWT `exp`, subtracts 5 min buffer; falls back to 24h
4. `parseJwtExpiry(token)` — splits JWT by `.`, `Buffer.from(parts[1], "base64url")`, reads `exp`, converts to Date
5. The full signed URL is stored as `hlsManifestUrl` in the Media table with accurate `hlsExpiresAt`

### Why Bare Playback IDs Don't Work
Constructing `https://stream.mux.com/{ID}.m3u8` without `?token=` will return a 403 from Mux. The token is Mux's signed URL mechanism — it authorizes playback for a specific time window. We removed `buildMuxHlsUrl` and `extractMuxPlaybackId` because they produced broken URLs.

---

## Environment Variables Required

```bash
DATABASE_URL          # PostgreSQL connection string
AUTH_SECRET           # Random 32-byte hex for Auth.js
AUTH_URL              # Deployed URL (https://your-app.vercel.app)
EMAIL_SERVER          # SMTP connection string for magic links
EMAIL_FROM            # Sender email address
CRON_SECRET           # Protects /api/cron/* endpoints
PATREON_CAMPAIGN_ID   # (optional) Default campaign ID — can override per-account
PATREON_CF_BM_COOKIE  # (optional) Cloudflare bypass cookie (shared across accounts)
```

---

## API Routes

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET/POST /api/auth/*` | Public | Magic-link authentication |
| `GET /api/posts` | Member | Paginated post list, optional `creatorAccountId` filter |
| `GET /api/posts/[id]` | Member | Post detail + active HLS URL |
| `GET /api/invites/validate` | Public | Validate & claim invite codes |
| `GET/POST/DELETE /api/invites` | Admin | CRUD invite codes |
| `POST /api/hls` | Admin | Submit/refresh HLS manifest URL |
| `GET /api/sync` | Admin | List all creator accounts |
| `POST /api/sync` | Admin | Sync single (`{accountId}`) or all (`{}`) |
| `GET /api/session?accountId=` | Admin | Check session status for an account |
| `POST /api/session` | Admin | Save session_id (`{accountId, sessionId}`) |
| `DELETE /api/session?accountId=` | Admin | Remove session for an account |
| `GET /api/accounts` | Admin | List all creator accounts |
| `POST /api/accounts` | Admin | Create account (`{name, campaignId?}`) |
| `DELETE /api/accounts?id=` | Admin | Delete an account |
| `GET /api/cron/sync-patreon` | CRON_SECRET | Automated sync of all accounts |
| `GET /api/cron/refresh-hls` | CRON_SECRET | HLS expiry check (JWT-based) |

---

## Patreon Sync Details

### Sync Flow (per account)
1. Reads account's `session_id` from `CreatorAccount`
2. Determines campaign ID: account override → `PATREON_CAMPAIGN_ID` env → API discovery
3. Fetches `/api/posts?filter[campaign_id]=...&sort=-published_at&page[count]=20`
4. Paginates with Patreon's cursor-based pagination, 500ms delay between pages
5. For each post: upserts post record (attributed to `creatorAccountId`)
6. For video posts: extracts signed HLS URL from embed/included data
7. If no HLS found in batch: fetches individual post detail with 200ms delay
8. Stores HLS URL with JWT-based expiry in Media table
9. Caps at 100 new posts per run (resumes from cursor next run)
10. Updates account's `lastSyncAt`, `cursor`, `status`, `errorLog`

### Session Cookie Expiry
- `session_id` cookies expire (hours to days) — sync fails with 401/403
- When expired, status changes to `session_expired` and error is logged
- Creator re-copies cookie from browser and pastes in admin per-account

### Cloudflare Issues
- Patreon uses Cloudflare bot protection
- If sync returns HTML instead of JSON, Cloudflare is blocking
- Add `__cf_bm` cookie via env var `PATREON_CF_BM_COOKIE` (shared across all accounts)

---

## What's Been Done

- [x] Next.js 14 project initialized with TypeScript + Tailwind
- [x] Prisma schema with 9 models (including CreatorAccount)
- [x] Auth.js v5 with magic links + invite code gating
- [x] Cookie-based multi-account Patreon sync engine
- [x] Mux JWT token parsing — signed HLS URLs with accurate expiry
- [x] Admin dashboard: account CRUD, per-account session & sync, invite manager
- [x] Frontend: post feed, post detail, video player, media gallery, search
- [x] All API routes: auth, posts, sync, accounts, session, invites, hls, cron
- [x] `vercel.json` with cron jobs (syncs all accounts)
- [x] `.env.example` template
- [x] `SETUP.md` deployment guide
- [x] `README.md` project overview
- [x] `context.md` (this file)
- [x] TypeScript typechecks clean, `npm run build` passes
- [x] Pushed to GitHub

## What's NOT Done / Future Work

- [ ] **Deployment:** Not yet deployed to Vercel — follow `SETUP.md`
- [ ] **Database:** Tables not created yet — needs `npx prisma migrate deploy`
- [ ] **First invite code:** Needs to be seeded manually in DB
- [ ] **Seeding first CreatorAccount:** After deployment, add accounts via admin UI
- [ ] **Testing:** No automated tests written
- [ ] **HLS auto-refresh:** Cron job only alerts — doesn't auto-refresh (needs fresh sync)
- [ ] **Account filter on frontend:** `/posts` and `/gallery` don't filter by creator account yet
- [ ] **Image optimization:** No Next.js Image component usage for thumbnails
- [ ] **Rate limiting on API routes:** Not implemented
- [ ] **Email templates:** Magic link emails use plain text
- [ ] **Member management UI:** No way to view/manage users from admin

---

## Design System

- **Theme:** Dark (zinc-950 background)
- **Accent:** Violet (violet-500 through violet-700)
- **Font:** System font stack, no custom fonts
- **Layout:** Max-width container (7xl), responsive grid
- **Cards:** zinc-800/900 backgrounds, rounded-xl, subtle borders
- **Video player:** video.js with custom dark theme
- **Navbar:** Sticky, blur backdrop, with logo + nav links + user menu

---

## Git History

Most recent commits (master, latest first):
1. `fix: preserve Mux JWT token in HLS URLs and parse exp for accurate expiry`
2. `feat: multi-creator-account support`
3. `docs: add README.md and AI context file`
4. `docs: add deployment guide, vercel config, and env template`
5. `feat: cookie-based Patreon sync with auto HLS extraction`
6. `Initial commit: PatronHub`

---

**Last updated:** July 1, 2026  
**Session ended with:** Multi-account support, Mux JWT token fix, all typechecked and pushed. Ready for deployment.
