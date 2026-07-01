# 🎬 PatronHub

A content platform that syncs your Patreon posts (including HLS video) for sharing via a private link.
Designed to share with your premium Discord community — no login, no invite codes.

## Features

- **🔄 Multi-account Patreon sync** — auto-imports posts from your own and followed creators via `session_id` cookie
- **🎥 HLS + MP4 video player** — Mux streams through video.js with JWT token-based expiry tracking
- **🖼️ Media gallery** — browse all images and videos in a responsive grid
- **🔍 Full-text search** — search across all posts with type filters
- **🛡️ Admin dashboard** — manage multiple creator accounts, per-account sync, discover followed creators
- **🏷️ Creator filter** — filter the home feed by creator name
- **⏱️ Vercel cron jobs** — auto-sync every 15 min, HLS refresh every hour
- **🔑 No auth** — share the link only in trusted channels (private Discord). Anyone with the URL can access.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Video | video.js + hls.js (Mux HLS/MP4) |
| Styling | Tailwind CSS 4 |
| Hosting | Vercel (with cron jobs) |

## Quick Start

```bash
# 1. Clone & install
git clone https://github.com/zainaqdas/yukata.git
cd yukata
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and CRON_SECRET
# Optional: PATREON_CAMPAIGN_ID, HLS_REFRESH_INTERVAL_MINUTES

# 3. Set up database
npx prisma migrate dev --name init

# 4. Run dev server
npm run dev
```

## Full Deployment Guide

See **[SETUP.md](./SETUP.md)** for the complete step-by-step deployment walkthrough, including:

- PostgreSQL setup (Neon, Supabase, Railway)
- Patreon `session_id` cookie extraction
- Vercel deployment + cron jobs
- Multi-account setup (owned + followed creators)
- Troubleshooting common issues

## Project Structure

```
patron-hub/
├── prisma/
│   └── schema.prisma          # 4 models: CreatorAccount, Post, Media, SyncState
├── src/
│   ├── app/
│   │   ├── (main)/             # Routes (posts, gallery, search, admin)
│   │   │   ├── posts/          # Home feed + detail pages + creator filter
│   │   │   ├── gallery/        # Media gallery
│   │   │   ├── search/         # Full-text search
│   │   │   └── admin/          # Multi-account dashboard, sync, discover
│   │   ├── api/                # REST API routes
│   │   │   ├── accounts/       # Creator account CRUD + discover followed
│   │   │   ├── posts/          # Post list + detail
│   │   │   ├── sync/           # Manual Patreon sync (single + all)
│   │   │   ├── session/        # Per-account session_id management
│   │   │   ├── hls/            # HLS URL submission
│   │   │   └── cron/           # Vercel cron endpoints
│   │   ├── layout.tsx          # Root layout with Navbar
│   │   └── page.tsx            # Landing page → redirects to /posts
│   ├── components/             # React components
│   │   ├── Navbar.tsx          # Navigation bar (Posts, Gallery, Search, Admin)
│   │   ├── VideoPlayer.tsx     # HLS + MP4 video.js player
│   │   ├── PostCard.tsx        # Post preview card with creator name
│   │   ├── PostGrid.tsx        # Post grid layout
│   │   ├── CreatorFilter.tsx   # Creator filter dropdown for /posts
│   │   ├── MediaGallery.tsx    # Media grid
│   │   ├── SearchBar.tsx       # Search input
│   │   └── Providers.tsx       # React Query provider
│   ├── lib/                    # Core business logic
│   │   ├── prisma.ts           # Prisma singleton
│   │   ├── patreon.ts          # Multi-account cookie-based sync engine
│   │   └── hls.ts              # HLS/MP4 URL management + expiry
│   └── globals.css
├── .env.example                # Environment template
├── vercel.json                 # Vercel config + cron jobs
├── SETUP.md                    # Deployment guide
└── README.md                   # This file
```

## API Routes

| Endpoint | Purpose |
|---|---|
| `GET /api/posts` | Paginated post list with type, search, creator filters |
| `GET /api/posts/[id]` | Post detail + active video URL |
| `POST /api/hls` | Submit/refresh video URL |
| `GET/POST /api/sync` | Manual sync (single account or all) |
| `GET/POST/DELETE /api/session` | Per-account `session_id` management |
| `GET/POST/DELETE /api/accounts` | Creator account CRUD |
| `POST /api/accounts/discover` | Discover followed Patreon campaigns |
| `GET /api/cron/sync-patreon` | Automated sync (CRON_SECRET) |
| `GET /api/cron/refresh-hls` | HLS expiry check (CRON_SECRET) |

## License

Private — for personal use with your Patreon community.
