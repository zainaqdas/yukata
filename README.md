# 🎬 PatronHub

A private, members-only content platform for your Patreon community. Automatically syncs your Patreon posts and serves video via Mux HLS streams — no more laggy Patreon UI.

## Features

- **🔐 Magic-link authentication** — invite-code gated sign-in for your paying members
- **🔄 Automatic Patreon sync** — posts auto-import using `session_id` cookie auth against Patreon's internal API
- **🎥 HLS video player** — Mux HLS streams served through a custom video.js player (no Patreon UI)
- **🖼️ Media gallery** — browse all images and videos in a responsive grid
- **🔍 Full-text search** — search across all posts with type filters
- **🛡️ Admin dashboard** — manage invite codes, Patreon session, and manual sync controls
- **⏱️ Vercel cron jobs** — auto-sync every 15 min, HLS refresh every hour
- **🌙 Dark theme** — zinc-950 + violet accents, responsive layout

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Auth | Auth.js v5 (Nodemailer magic links) |
| Video | video.js + hls.js (Mux HLS) |
| Styling | Tailwind CSS 4 |
| Hosting | Vercel |

## Quick Start

```bash
# 1. Clone & install
git clone https://github.com/zainaqdas/yukata.git
cd yukata
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your real values (see SETUP.md)

# 3. Set up database
npx prisma migrate dev --name init

# 4. Run dev server
npm run dev
```

## Full Deployment Guide

See **[SETUP.md](./SETUP.md)** for the complete step-by-step deployment walkthrough, including:

- PostgreSQL setup (Neon, Supabase, Railway)
- Email provider configuration (Resend, SendGrid, Brevo)
- Patreon `session_id` cookie extraction
- Vercel deployment + cron jobs
- First invite code seeding
- Admin promotion
- Troubleshooting common issues

## Project Structure

```
patron-hub/
├── prisma/
│   └── schema.prisma          # 8 models: User, InviteCode, Post, Media, SyncState, etc.
├── src/
│   ├── app/
│   │   ├── (auth)/             # Protected routes
│   │   │   ├── posts/          # Post feed + detail pages
│   │   │   ├── gallery/        # Media gallery
│   │   │   ├── search/         # Full-text search
│   │   │   └── admin/          # Dashboard, sync, invite management
│   │   ├── api/                # REST API routes
│   │   │   ├── auth/           # Auth.js handlers
│   │   │   ├── posts/          # Post CRUD
│   │   │   ├── sync/           # Manual Patreon sync
│   │   │   ├── session/        # Patreon session_id management
│   │   │   ├── invites/        # Invite code CRUD + validation
│   │   │   ├── hls/            # HLS URL submission
│   │   │   └── cron/           # Vercel cron endpoints
│   │   └── login/              # Login page
│   ├── components/             # React components
│   │   ├── Navbar.tsx          # Navigation bar
│   │   ├── VideoPlayer.tsx     # HLS video.js player
│   │   ├── PostCard.tsx        # Post preview card
│   │   ├── PostGrid.tsx        # Post grid layout
│   │   ├── MediaGallery.tsx    # Media grid
│   │   ├── SearchBar.tsx       # Search input
│   │   ├── LoginForm.tsx       # Email + invite code form
│   │   ├── InviteManager.tsx   # Admin invite code UI
│   │   └── Providers.tsx       # React Query provider
│   ├── lib/                    # Core business logic
│   │   ├── auth.ts             # Auth.js config + type augmentation
│   │   ├── prisma.ts           # Prisma singleton
│   │   ├── patreon.ts          # Cookie-based Patreon sync engine
│   │   ├── hls.ts              # HLS URL management
│   │   └── invites.ts          # Invite code logic
│   └── middleware.ts           # Route protection
├── .env.example                # Environment template
├── vercel.json                 # Vercel config + cron jobs
├── SETUP.md                    # Deployment guide
└── README.md                   # This file
```

## API Routes

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET/POST /api/auth/*` | Public | Magic-link authentication |
| `GET /api/posts` | Member | Paginated post list with filters |
| `GET /api/posts/[id]` | Member | Post detail + active HLS URL |
| `GET /api/invites/validate` | Public | Validate & claim invite codes |
| `GET/POST/DELETE /api/invites` | Admin | CRUD invite codes |
| `POST /api/hls` | Admin | Submit/refresh HLS manifest URL |
| `GET/POST /api/sync` | Admin | Manual Patreon sync |
| `GET/POST /api/session` | Admin | Manage Patreon `session_id` |
| `GET /api/cron/sync-patreon` | CRON_SECRET | Automated Patreon sync |
| `GET /api/cron/refresh-hls` | CRON_SECRET | HLS expiry check |

## License

Private — for personal use with your Patreon community.
