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

## Core Architecture Decisions

### 1. Cookie-Based Patreon Sync (Like Kemono)
- **NOT** using the public Patreon OAuth API
- Uses `session_id` cookie (from browser) to hit Patreon's **internal REST API** at `/api/posts`
- The `session_id` is stored in the DB (`SyncState.patreonSessionId`) and entered via admin dashboard
- Also supports optional `__cf_bm` cookie for Cloudflare bypass
- Sync engine: `src/lib/patreon.ts`

### 2. Auto HLS Video Extraction
- Patreon hosts video through Mux.com
- The sync engine parses post HTML/embeds for Mux playback IDs
- Builds HLS manifest URLs: `https://stream.mux.com/{PLAYBACK_ID}.m3u8`
- These URLs expire periodically (~24h), cron job checks for expiry

### 3. Auth.js v5 Magic Links
- Not using passwords — email magic links only
- Gated by invite codes: users must provide a valid invite code to sign in
- On first sign-in with a valid code, the code is "claimed" (linked to user, `currentUses` incremented)
- Admin role controls access to sync, invites, and HLS management

### 4. Prisma 5 (Downgraded from Prisma 7)
- Prisma 7 had breaking changes (datasource URL moved to `prisma.config.ts`)
- We downgraded to stable Prisma 5 to avoid issues
- 8 models: User, InviteCode, Post, Media, SyncState, Account, Session, VerificationToken

### 5. Vercel Hosting with Cron Jobs
- `vercel.json` defines two cron jobs:
  - `*/15 * * * *` → sync Patreon posts
  - `0 * * * *` → check HLS URL expiry
- Cron endpoints protected by `CRON_SECRET` header check

## Key Files

| File | Purpose |
|---|---|
| `src/lib/patreon.ts` | Cookie-based sync engine — the most complex file. Handles pagination, rate limiting (500ms delay), Mux ID extraction, Cloudflare detection |
| `src/lib/auth.ts` | Auth.js v5 config with Nodemailer provider, type augmentation for `role` on Session/User |
| `src/lib/invites.ts` | Invite code CRUD + validation + claiming flow |
| `src/lib/hls.ts` | HLS URL storage and expiry tracking |
| `src/middleware.ts` | Route protection — public paths: `/api/auth/*`, `/api/invites/validate`, `/login` |
| `prisma/schema.prisma` | Database schema with 8 models |

## Environment Variables Required

```bash
DATABASE_URL          # PostgreSQL connection string
AUTH_SECRET           # Random 32-byte hex for Auth.js
AUTH_URL              # Deployed URL (https://your-app.vercel.app)
EMAIL_SERVER          # SMTP connection string for magic links
EMAIL_FROM            # Sender email address
CRON_SECRET           # Protects /api/cron/* endpoints
PATREON_CF_BM_COOKIE  # (optional) Cloudflare bypass cookie
```

## What's Been Done

- [x] Next.js 14 project initialized with TypeScript + Tailwind
- [x] Prisma schema with 8 models
- [x] Auth.js v5 with magic links + invite code gating
- [x] Cookie-based Patreon sync engine with Mux HLS auto-extraction
- [x] Admin dashboard with session management, sync controls, invite manager
- [x] Frontend: post feed, post detail, video player, media gallery, search
- [x] All API routes: auth, posts, sync, session, invites, hls, cron
- [x] `vercel.json` with cron jobs
- [x] `.env.example` template
- [x] `SETUP.md` deployment guide
- [x] `README.md` project overview
- [x] TypeScript typechecks clean, `npm run build` passes
- [x] Pushed to GitHub

## What's NOT Done / Future Work

- [ ] **Deployment:** Not yet deployed to Vercel — follow `SETUP.md`
- [ ] **Database:** Tables not created yet — needs `npx prisma migrate deploy`
- [ ] **First invite code:** Needs to be seeded manually in DB
- [ ] **Testing:** No automated tests written
- [ ] **HLS auto-refresh:** Cron job only alerts — doesn't auto-refresh (requires fresh session_id)
- [ ] **Patreon token refresh:** No OAuth refresh token flow (we use cookie auth)
- [ ] **Image optimization:** No Next.js Image component usage for thumbnails
- [ ] **Rate limiting on API routes:** Not implemented
- [ ] **Email templates:** Magic link emails use plain text
- [ ] **Member management UI:** No way to view/manage users from admin

## Patreon Sync Details (Important!)

### How It Works
1. Creator pastes `session_id` cookie in admin dashboard → stored in `SyncState`
2. Sync hits `https://www.patreon.com/api/posts?include=campaign,media,attachments,user&fields[post]=...`
3. Paginates with Patreon's cursor-based pagination, 500ms delay between pages
4. Limits to 100 new posts per run to avoid timeouts
5. For video posts, fetches post detail to extract Mux playback IDs from embed HTML
6. Constructs HLS URLs: `https://stream.mux.com/{ID}.m3u8`

### Mux Playback ID Extraction
- Pattern 1: `/mux.com/${id}` in embed URLs
- Pattern 2: `https://stream.mux.com/${id}` in HTML
- Pattern 3: inline data attributes with Mux IDs
- Pattern 4: fallback regex for `src=` attributes containing "mux"

### Cookie Expiry
- `session_id` cookies expire (hours to days) — sync will fail with 401/403
- When this happens, re-copy cookie from Patreon browser session and paste in admin

### Cloudflare Issues
- Patreon uses Cloudflare bot protection
- If sync returns HTML instead of JSON, Cloudflare is blocking
- Add `__cf_bm` cookie via env var `PATREON_CF_BM_COOKIE` or in admin

## Design System

- **Theme:** Dark (zinc-950 background)
- **Accent:** Violet (violet-500 through violet-700)
- **Font:** System font stack, no custom fonts
- **Layout:** Max-width container (7xl), responsive grid
- **Cards:** zinc-800/900 backgrounds, rounded-xl, subtle borders
- **Video player:** video.js with custom dark theme
- **Navbar:** Sticky, blur backdrop, with logo + nav links + user menu

## Git History

Most recent commits (master):
1. `docs: add deployment guide, vercel config, and env template`
2. `feat: cookie-based Patreon sync with auto HLS extraction`
3. `Initial commit: PatronHub`

---

**Last updated:** July 1, 2026  
**Session ended with:** All files written, typechecked, built, and pushed to GitHub. Ready for deployment.
