# 🚀 PatronHub — Setup & Deployment Guide

A content platform for your Patreon community — share with members via a private link.
Automatically syncs your Patreon posts and serves video via Mux HLS streams.

---

## 📋 Prerequisites

- A **GitHub account** (you already have one)
- A **Vercel account** (free tier works — [sign up](https://vercel.com))
- A **PostgreSQL database** (see Step 1)
- Your **Patreon `session_id` cookie** (see Step 2)

---

## Step 1: Create a PostgreSQL Database

Pick one of these providers:

| Provider | Free Tier | Best For |
|---|---|---|
| **[Neon](https://neon.tech)** | ✅ 0.5 GB, serverless | Recommended — branches, good Prisma support |
| **[Supabase](https://supabase.com)** | ✅ 500 MB | If you also want auth/storage |
| **[Railway](https://railway.app)** | ❌ Starts at $5/mo | Simple provisioning |

After creating the database, copy your connection string:

```
postgresql://user:password@ep-cool-name.us-east-2.aws.neon.tech/patronhub?sslmode=require
```

> 💡 **Save this** — you'll need it for Vercel env vars and running migrations.

---

## Step 2: Get Your Patreon `session_id` Cookie

This is how the app imports your posts — it uses the same cookie your browser uses.

1. Open **Chrome** or **Firefox**
2. Go to [patreon.com](https://patreon.com) and **log in**
3. Open DevTools (`F12` → **Application** tab → **Cookies** → `patreon.com`)
4. Find the row named `session_id` and **copy its value**
5. **(Optional)** Also copy `__cf_bm` — helps bypass Cloudflare bot detection

> ⚠️ This cookie expires periodically. When sync stops working, repeat this step and paste the new cookie in the admin dashboard.

---

## Step 3: Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import** → select `zainaqdas/yukata`
3. Vercel auto-detects Next.js — no framework changes needed
4. Expand **Environment Variables** and add these:

| Key | Value |
|---|---|
| `DATABASE_URL` | Your PostgreSQL connection string from Step 1 |
| `CRON_SECRET` | Run `openssl rand -hex 32`, paste result |
| `PATREON_CF_BM_COOKIE` | (optional) Cloudflare cookie from Step 2 |
| `PATREON_CAMPAIGN_ID` | (optional) Explicit campaign ID if auto-detection fails |
| `HLS_REFRESH_INTERVAL_MINUTES` | (optional) Minutes before HLS expiry to trigger refresh (default: 30) |

5. Click **Deploy** 🚀

After deployment, Vercel gives you a URL like `https://patron-hub-abc123.vercel.app`.

---

## Step 4: Run Database Migrations

Run this from your terminal (replace the URL with your real one):

```bash
cd patron-hub
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require" \
  npx prisma migrate deploy
```

This creates all the tables (CreatorAccount, Post, Media, SyncState).

---

## Step 5: Connect Patreon Sync

The admin dashboard supports **multiple creator accounts** — both your own and followed creators.

### 5a. Add Your Own Account

1. Go to `/admin`
2. Under **Add Owned Account**, enter your creator name (e.g. `MyChannel`)
3. Click **Add** → your account appears with an **Owned** badge
4. Paste your `session_id` cookie (from Step 2) into the **Patreon Session** field
5. Click **Save**, then click **Sync**
6. The sync engine will:
   - Fetch all your Patreon posts
   - Extract thumbnails, embeds, and content
   - Auto-detect Mux HLS video URLs (via the `display` field)
   - Store everything in your database

### 5b. Discover Followed Creators

If you're subscribed to other creators:

1. Make sure your owned account has a valid `session_id`
2. Click **Discover Followed** on your owned account
3. Followed accounts appear with a **Followed** badge
4. Click **Sync** on each to pull in their posts

> 💡 Followed accounts share the parent's `session_id` — one active session syncs everything.

✅ Your content is now live. Share the link with your community.

---

## 🔄 Ongoing: Keeping Content Fresh

Vercel cron jobs handle this automatically:

- **Every 15 min** → Syncs new posts from all accounts
- **Every hour** → Checks for expiring HLS video URLs

Manual sync from `/admin`:
- **Sync All** → syncs every account
- **Sync** (per account) → syncs just that one

Mux HLS URLs expire based on JWT tokens (~24 hours). The `hlsExpiresAt` field tracks this. Re-sync to refresh tokens.

The `HLS_REFRESH_INTERVAL_MINUTES` env var (default: 30) controls how far in advance the cron job flags HLS URLs as expiring — lowering it reduces false positives, raising it gives more buffer.

---

## 🔧 Troubleshooting

| Problem | Fix |
|---|---|
| "Sync fails / session expired" | Your `session_id` cookie expired. Log into Patreon again, copy the new cookie, paste it in the account's **Session** field in `/admin`. |
| "Cloudflare CAPTCHA" | Add `__cf_bm` cookie or set `PATREON_CF_BM_COOKIE` env var. |
| "Build fails" | Check Vercel build logs. Make sure `DATABASE_URL` is set and `prisma generate` succeeds. |
| "Database migration fails" | Make sure your IP is allowed in the database provider's firewall. |
| "Can't find campaign ID" | Set `PATREON_CAMPAIGN_ID` in your env vars or add a campaign ID when creating the account. |
| "HLS refresh runs too often" | Increase `HLS_REFRESH_INTERVAL_MINUTES` (default: 30). |
| "Videos not playing" | The Mux HLS URL may have expired. Go to `/admin` → **Sync** on the relevant account. |

---

## 📁 Project Structure

```
patron-hub/
├── prisma/
│   └── schema.prisma          # Database models (CreatorAccount, Post, Media, SyncState)
├── src/
│   ├── app/
│   │   ├── (main)/             # Routes (posts, gallery, search, admin)
│   │   │   ├── admin/          # Admin dashboard (multi-account mgmt)
│   │   │   └── posts/          # Home feed with creator filter dropdown
│   │   ├── api/
│   │   │   ├── accounts/       # Creator account CRUD + discover followed
│   │   │   ├── session/        # Per-account session_id management
│   │   │   ├── sync/           # Manual sync (single + all accounts)
│   │   │   └── cron/           # Vercel cron jobs (sync-patreon, refresh-hls)
│   │   ├── layout.tsx          # Root layout with Navbar
│   │   └── page.tsx            # Landing page → redirects to /posts
│   ├── components/             # React components (Navbar, VideoPlayer, PostCard, CreatorFilter, etc.)
│   ├── lib/                    # Core logic (prisma.ts, patreon.ts, hls.ts)
│   └── globals.css
├── .env.example                # Environment variables template
├── vercel.json                 # Vercel config with cron jobs
└── SETUP.md                    # This file
```

---

## 🔐 Security Notes

- **Never commit `.env`** — it's in `.gitignore`
- **Rotate `CRON_SECRET`** periodically
- **The Patreon `session_id` is stored in your database** — it gives full access to your Patreon account. Keep your database credentials secure.
- **The site has no login/auth** — share the link only in trusted channels (e.g., private Discord). Anyone with the URL can access all content and admin controls.

---

## 📊 Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Video | video.js + hls.js + Mux HLS/MP4 |
| Styling | Tailwind CSS 4 |
| Hosting | Vercel (with cron jobs) |
